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
    }

    /*
     * DockView renders into light DOM inside this element.
     * Override its internal CSS vars to bridge into the nc token system.
     * DockView uses --dv-* custom properties for its own theming.
     */
    #dockview-host {
      --dv-background-color:              var(--nc-dock-panel-bg);
      --dv-tabs-and-actions-container-background-color: var(--nc-dock-tab-bg);
      --dv-activegroup-visiblepanel-tab-background-color: var(--nc-dock-tab-active-bg);
      --dv-activegroup-hiddenpanel-tab-background-color:  var(--nc-dock-tab-bg);
      --dv-inactivegroup-visiblepanel-tab-background-color: var(--nc-dock-tab-bg);
      --dv-tab-divider-color:             var(--nc-dock-border);
      --dv-separator-border:              var(--nc-dock-sash-color);
      --dv-pane-border-color:             var(--nc-dock-border);
      --dv-font-family:                   var(--nc-font-family);
      --dv-font-size:                     var(--nc-text-sm);
      --dv-tab-color:                     var(--nc-dock-tab-text);
      --dv-activegroup-visiblepanel-tab-color: var(--nc-dock-tab-active-text);
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

    const { DockviewComponent } = await import('dockview-core');

    const dock = new (DockviewComponent as unknown as new (
      el: HTMLElement,
      opts: unknown
    ) => DockviewComponent)(host, {
      createComponent: (options: { id: string; name: string }) => {
        return this._createPanelComponent(options.name);
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
