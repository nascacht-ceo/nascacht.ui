import { LitElement, html, css, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { provide } from '@lit/context';
import { ContextRoot } from '@lit/context';
import type { TemplateResult } from 'lit';
import type { DockLayout, NascachtConfig, PanelDescriptor } from '../types.js';
import { nascachtConfigContext } from '../context.js';
import { LocalStoragePersistenceAdapter } from './dock-persistence.js';

// DockView types — imported at runtime so the bundle is optional.
// Consumers using the esm build must have dockview-core in their deps.
type DockviewApi = import('dockview-core').DockviewApi;
type DockviewComponent = import('dockview-core').DockviewComponent;

// DockView renders inside nc-dock's shadow root, so its CSS must be injected
// there — not into document.head, which cannot cross the shadow boundary.
// A <link> inside a shadow root is supported in all target browsers (Chrome 73+).
function injectDockviewCss(shadowRoot: ShadowRoot, url: string): void {
  if (shadowRoot.querySelector('link[data-nc-dockview]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.setAttribute('data-nc-dockview', '');
  link.href = url;
  shadowRoot.appendChild(link);
}

// Injected AFTER the DockView <link> so document order gives us cascade priority
// without needing !important. Lit's adoptedStyleSheets run before <link>/<style>
// elements, so tab overrides must live here rather than in static styles.
function injectNcTabStyles(shadowRoot: ShadowRoot): void {
  if (shadowRoot.querySelector('style[data-nc-tabs]')) return;
  const style = document.createElement('style');
  style.setAttribute('data-nc-tabs', '');
  style.textContent = `
    /*
     * Group panel: all four corners rounded.
     * overflow:hidden (set by DockView) clips all children to this pill shape —
     * the tab bar gets rounded top corners, content gets rounded bottom corners.
     */
    .dv-groupview {
      border-radius: var(--nc-radius-md, 8px) !important;
    }

    /*
     * Content area: square top-left (sits flush under the active tab),
     * rounded everywhere else for the card look.
     * overflow:hidden clips widget content to this shape.
     *
     * --nc-widget-radius override: widgets inside a dock panel inherit flat-top
     * rounding so they don't double-round against the content container's own
     * corners. No changes needed in widget files — the variable cascades in.
     */
    .dv-content-container {
      border-radius: 0 var(--nc-radius-md, 8px) var(--nc-radius-md, 8px) var(--nc-radius-md, 8px) !important;
      overflow: hidden;
      --nc-widget-radius: 0 0 var(--nc-radius-md, 8px) var(--nc-radius-md, 8px);
    }

    /* All tabs: rounded top-right only by default */
    .dv-tab {
      border-radius: 0 var(--nc-radius-sm, 4px) 0 0 !important;
    }

    /* First tab: also round the top-left to match the group's corner */
    .dv-tabs-container .dv-tab:first-child {
      border-radius: var(--nc-radius-sm, 4px) var(--nc-radius-sm, 4px) 0 0 !important;
    }

    /* Active tab: primary-colored bottom indicator makes the active tab legible */
    .dv-tab.dv-active-tab {
      border-bottom: 2px solid var(--nc-color-primary, #4f8ef7) !important;
    }

    /* Subtle divider between tabs */
    .dv-tab + .dv-tab {
      border-left: 1px solid var(--nc-border, rgba(0,0,0,0.12)) !important;
    }
  `;
  shadowRoot.appendChild(style);
}

/**
 * <nc-dock> — VS Code-style docking container.
 *
 * Wraps DockView and bridges between the nascacht JSON Layout DSL and
 * DockView's panel model. Provides NascachtConfig context to all panels
 * via @lit/context ContextRoot (crosses DockView's DOM boundaries).
 *
 *   ┌─────────────────────────────────────────────┐
 *   │ <nc-dock>                                   │
 *   │   ┌─────────────────────────────────────┐  │
 *   │   │ DockView host div                   │  │
 *   │   │  ┌──────────┐  ┌──────────────────┐ │  │
 *   │   │  │ Panel A  │  │ Panel B          │ │  │
 *   │   │  │ <kpi>    │  │ <markdown>       │ │  │
 *   │   │  └──────────┘  └──────────────────┘ │  │
 *   │   └─────────────────────────────────────┘  │
 *   └─────────────────────────────────────────────┘
 *
 * Context flows: ContextRoot installed at document level ensures context
 * reaches widget elements even inside DockView's shadow DOM panels.
 */
@customElement('nc-dock')
export class NascachtDock extends LitElement {
  /**
   * CDN URL for the DockView ES module. Override before any <nc-dock> element
   * is connected to pin a different version or use a local copy.
   *
   *   NascachtDock.dockviewUrl = 'https://esm.sh/dockview-core@4';
   */
  static dockviewUrl = 'https://esm.sh/dockview-core@4.13.1';

  /**
   * CDN URL for DockView's base stylesheet. Defaults to the same CDN and
   * version as dockviewUrl. Override independently if needed.
   *
   *   NascachtDock.dockviewCssUrl = 'https://esm.sh/dockview-core@4/dist/styles/dockview.css';
   */
  static dockviewCssUrl = 'https://esm.sh/dockview-core@4.13.1/dist/styles/dockview.css';

  static override styles = css`
    :host {
      display: block;
      width: 100%;
      height: 100%;

      /* Component tokens — tier 3 */
      --nc-dock-bg:               var(--nc-surface-raised);
      --nc-dock-border:           var(--nc-border);

      --nc-dock-tab-bg:           var(--nc-surface-overlay);
      --nc-dock-tab-active-bg:    var(--nc-surface);
      --nc-dock-tab-text:         var(--nc-text-secondary);
      --nc-dock-tab-active-text:  var(--nc-text-primary);
      --nc-dock-tab-active-line:  var(--nc-color-primary);
      --nc-dock-tab-height:       var(--nc-space-10);

      --nc-dock-panel-bg:         var(--nc-surface);
      --nc-dock-sash-color:       var(--nc-border);
      --nc-dock-sash-hover:       var(--nc-color-primary);
      --nc-dock-sash-width:       4px;

      background: var(--nc-dock-bg);
    }

    #dockview-host {
      width: 100%;
      height: 100%;
      /* Inherited by all DockView children — DockView's own CSS never sets font-family */
      font-family: var(--nc-font-family);
      font-size: var(--nc-text-sm);
    }

    /*
     * Full --dv-* → --nc-* bridge.
     *
     * We pass theme: { className: 'dockview-theme-nc' } to DockviewComponent.
     * That class has no rules in DockView's CSS, so it sets no --dv-* values.
     * These #dockview-host rules are the only source — nc tokens always win.
     */
    #dockview-host {
      /* Backgrounds */
      --dv-background-color:                              var(--nc-dock-panel-bg);
      --dv-group-view-background-color:                   var(--nc-dock-panel-bg);

      /* Tab bar */
      --dv-tabs-and-actions-container-background-color:   var(--nc-dock-tab-bg);
      --dv-tabs-and-actions-container-font-size:          var(--nc-text-sm);
      --dv-tabs-and-actions-container-height:             var(--nc-dock-tab-height);

      /* Tab backgrounds */
      --dv-activegroup-visiblepanel-tab-background-color:   var(--nc-dock-tab-active-bg);
      --dv-activegroup-hiddenpanel-tab-background-color:    var(--nc-dock-tab-bg);
      --dv-inactivegroup-visiblepanel-tab-background-color: var(--nc-dock-tab-bg);
      --dv-inactivegroup-hiddenpanel-tab-background-color:  var(--nc-dock-tab-bg);

      /* Tab text */
      --dv-tab-color:                                     var(--nc-dock-tab-text);
      --dv-tab-font-size:                                 var(--nc-text-sm);
      --dv-activegroup-visiblepanel-tab-color:            var(--nc-dock-tab-active-text);
      --dv-activegroup-hiddenpanel-tab-color:             var(--nc-text-secondary);
      --dv-inactivegroup-visiblepanel-tab-color:          var(--nc-dock-tab-text);
      --dv-inactivegroup-hiddenpanel-tab-color:           var(--nc-text-disabled);
      --dv-tab-divider-color:                             var(--nc-dock-border);
      --dv-tab-margin:                                    0;

      /* Borders & separators */
      --dv-separator-border:                              var(--nc-dock-sash-color);
      --dv-pane-border-color:                             var(--nc-dock-border);
      --dv-pane-view-header-border-color:                 var(--nc-dock-border);
      --dv-paneview-header-border-color:                  var(--nc-dock-border);
      --dv-paneview-active-outline-color:                 var(--nc-color-primary);
      --dv-border-radius:                                 0;

      /* Sash (resize handles) */
      --dv-sash-color:                                    transparent;
      --dv-active-sash-color:                             var(--nc-dock-sash-hover);
      --dv-active-sash-transition-duration:               var(--nc-duration-fast);
      --dv-active-sash-transition-delay:                  0.5s;

      /* Drag-over overlay */
      --dv-drag-over-background-color:                    color-mix(in oklch, var(--nc-color-primary) 25%, transparent);
      --dv-drag-over-border-color:                        var(--nc-color-primary);

      /* Floating panels */
      --dv-floating-box-shadow:                           var(--nc-shadow-lg);
      --dv-overlay-z-index:                               var(--nc-z-overlay);

      /* Misc UI */
      --dv-tabs-container-scrollbar-color:                var(--nc-text-disabled);
      --dv-icon-hover-background-color:                   color-mix(in oklch, var(--nc-text-primary) 10%, transparent);

      /* Typography */
      --dv-font-family:                                   var(--nc-font-family);
      --dv-font-size:                                     var(--nc-text-sm);
    }

  `;

  // ── Context provision ─────────────────────────────────────────────────────

  @provide({ context: nascachtConfigContext })
  config: NascachtConfig = {};

  // ── Public attributes ─────────────────────────────────────────────────────

  /** Key used to load/save layout via the PersistenceAdapter. */
  @property({ attribute: 'layout-key' }) layoutKey = 'nc-layout';

  /** When present, enables design-mode for all child widgets. */
  @property({ type: Boolean, reflect: true, attribute: 'design-mode' })
  designModeEnabled = false;

  // ── Internals ─────────────────────────────────────────────────────────────

  private _dockApi: DockviewApi | null = null;
  private _contextRoot: ContextRoot | null = null;
  private _currentLayout: DockLayout | null = null;

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  override connectedCallback(): void {
    super.connectedCallback();
    // ContextRoot at document level — ensures context crosses DockView's DOM.
    this._contextRoot = new ContextRoot();
    this._contextRoot.attach(document.body);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this._contextRoot = null;
  }

  override async firstUpdated(): Promise<void> {
    injectDockviewCss(this.renderRoot as ShadowRoot, NascachtDock.dockviewCssUrl);
    injectNcTabStyles(this.renderRoot as ShadowRoot);
    await this._initDockView();
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Apply a partial layout patch from AI output or external state.
   *
   *   dock.applyPatch({ panels: [{ id: 'p1', widgetType: 'kpi', ... }] })
   *
   * Merges the patch into the current layout and re-renders affected panels.
   */
  applyPatch(patch: Partial<DockLayout>): void {
    if (!this._dockApi) return;
    if (!patch.root) return;

    this._currentLayout = { ...this._currentLayout, ...patch } as DockLayout;
    this._syncLayoutToDockView(this._currentLayout);
    void this._persistLayout(this._currentLayout);
  }

  // ── Rendering ─────────────────────────────────────────────────────────────

  override render(): TemplateResult {
    return html`<div id="dockview-host"></div>`;
  }

  // ── DockView bridge ───────────────────────────────────────────────────────

  private async _initDockView(): Promise<void> {
    const host = this.renderRoot.querySelector<HTMLElement>('#dockview-host');
    if (!host) return;

    const { DockviewComponent } = await import(/* @vite-ignore */ NascachtDock.dockviewUrl) as typeof import('dockview-core');

    const dock = new (DockviewComponent as unknown as new (
      el: HTMLElement,
      opts: unknown
    ) => DockviewComponent)(host, {
      // Custom theme class has no CSS rules in DockView's stylesheet, so DockView
      // sets no --dv-* variables from it. Our #dockview-host rules (which map
      // --nc-* tokens to --dv-* vars) become the only source — nc tokens win.
      theme: { name: 'nc', className: 'dockview-theme-nc' },
      createComponent: (options: { id: string; name: string }) => {
        const el = this._createPanelComponent(options.name);
        return {
          element: el,
          // init() receives the params passed to addPanel — apply them as
          // element properties so widgets render with their configured data.
          init: (parameters: { params?: Record<string, unknown> }) => {
            const config = parameters.params;
            if (config) {
              for (const [key, value] of Object.entries(config)) {
                (el as unknown as Record<string, unknown>)[key] = value;
              }
            }
          },
        };
      },
    });

    this._dockApi = (dock as unknown as { api: DockviewApi }).api;

    this._dockApi.onDidLayoutChange(() => {
      if (this._currentLayout) {
        void this._persistLayout(this._currentLayout);
      }
    });

    const layout = await this._loadLayout();
    if (layout) {
      this._currentLayout = layout;
      this._syncLayoutToDockView(layout);
    }
  }

  private _createPanelComponent(widgetType: string): HTMLElement {
    const tagName = `nc-${widgetType}`;
    const el = customElements.get(tagName)
      ? document.createElement(tagName)
      : this._createPlaceholder(widgetType);
    return el;
  }

  private _createPlaceholder(widgetType: string): HTMLElement {
    const el = document.createElement('div');
    el.setAttribute('role', 'status');
    el.textContent = `Unknown widget type: "${widgetType}"`;
    el.style.cssText = 'padding:1rem;color:var(--nc-color-error,red)';
    return el;
  }

  private _syncLayoutToDockView(layout: DockLayout): void {
    if (!this._dockApi) return;
    const panels = this._flattenPanels(layout.root);
    for (const panel of panels) {
      if (!this._dockApi.getPanel(panel.id)) {
        this._addPanel(panel);
      }
    }
  }

  private _addPanel(descriptor: PanelDescriptor): void {
    if (!this._dockApi) return;
    this._dockApi.addPanel({
      id: descriptor.id,
      component: descriptor.widgetType,
      title: descriptor.title,
      params: descriptor.config,
    });
  }

  private _flattenPanels(group: DockLayout['root']): PanelDescriptor[] {
    const results: PanelDescriptor[] = [];
    if (group.panels) results.push(...group.panels);
    if (group.children) {
      for (const child of group.children) {
        results.push(...this._flattenPanels(child));
      }
    }
    return results;
  }

  // ── Persistence ───────────────────────────────────────────────────────────

  private async _loadLayout(): Promise<DockLayout | null> {
    const adapter =
      this.config.persistenceAdapter ?? new LocalStoragePersistenceAdapter();
    try {
      return await adapter.load(this.layoutKey);
    } catch {
      console.warn('[nascacht] Layout load failed — using default');
      return null;
    }
  }

  private async _persistLayout(layout: DockLayout): Promise<void> {
    const adapter =
      this.config.persistenceAdapter ?? new LocalStoragePersistenceAdapter();
    try {
      await adapter.save(this.layoutKey, layout);
    } catch {
      console.warn('[nascacht] Layout save failed');
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'nc-dock': NascachtDock;
  }
}
