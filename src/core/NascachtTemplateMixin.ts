import { consume } from '@lit/context';
import { property, state } from 'lit/decorators.js';
import { html, nothing } from 'lit';
import type { LitElement, TemplateResult, PropertyValues } from 'lit';
import { nascachtConfigContext } from '../context.js';
import { loadModule, clearModuleCache as _clearModuleCache } from '../ai/module-loader.js';
import { compileTemplate, safeRender } from '../ai/template-compiler.js';
import type { NascachtConfig, TemplateFunction, TemplateSaveResponse } from '../types.js';

// Re-export so consumers can reset cache in tests.
export { _clearModuleCache as clearModuleCache };

// ── Mixin constructor type (must use any[] per TS mixin spec) ─────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Constructor<T = object> = new (...args: any[]) => T;

/**
 * Mixin that adds template-loading, design-mode editing, and fallback rendering
 * to any LitElement subclass.
 *
 * Template resolution order:
 *
 *   1. Design mode preview (new Function, transient — only if design-mode attr set)
 *   2. Server-compiled module (import() from templateApiUrl)
 *   3. fallbackTemplate() — shown on network/import failure
 *   4. defaultTemplate() — shown when no templateApiUrl is configured
 *
 *                     ┌─ design-mode attr? ─┐
 *                     │                     │
 *                  yes│                     │no
 *                     ▼                     ▼
 *             preview render      templateApiUrl set?
 *             (new Function)          │         │
 *                                   yes        no
 *                                    ▼          ▼
 *                              import(moduleUrl) defaultTemplate()
 *                                    │
 *                          ┌─────────┴──────────┐
 *                       success              failure
 *                          ▼                    ▼
 *                   server template      fallbackTemplate()
 */
export interface NascachtTemplateMixinInterface {
  templateApiUrl: string | undefined;
  templateType: string | undefined;
  readonly designMode: boolean;

  fallbackTemplate(): TemplateResult;
  defaultTemplate(): TemplateResult;
  refreshTemplate(): Promise<void>;
  setTemplate(fn: TemplateFunction): void;
  renderTemplate(): TemplateResult | typeof nothing;
}

export const NascachtTemplateMixin = <T extends Constructor<LitElement>>(
  superClass: T
): T & Constructor<NascachtTemplateMixinInterface> => {
  class NascachtTemplateElement extends superClass {
    // ── Context ──────────────────────────────────────────────────────────────

    @consume({ context: nascachtConfigContext, subscribe: true })
    @state()
    protected _config: NascachtConfig = {};

    // ── Public observed attributes ────────────────────────────────────────────

    @property({ attribute: 'template-api-url' })
    templateApiUrl: string | undefined;

    @property({ attribute: 'template-type' })
    templateType: string | undefined;

    // ── Internal state ────────────────────────────────────────────────────────

    @state() private _activeTemplate: TemplateFunction | null = null;
    @state() private _loadError: string | null = null;
    @state() private _previewTemplate: TemplateFunction | null = null;
    @state() private _previewError: string | null = null;
    @state() private _editorSource: string = '';
    @state() private _saving: boolean = false;
    @state() private _saveError: string | null = null;

    get designMode(): boolean {
      return this.closest('[design-mode]') !== null;
    }

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    override connectedCallback(): void {
      super.connectedCallback();
      void this._loadTemplate();
    }

    override updated(changed: PropertyValues): void {
      super.updated(changed);
      if (
        changed.has('templateApiUrl' as keyof this) ||
        changed.has('templateType' as keyof this) ||
        changed.has('_config' as keyof this)
      ) {
        void this._loadTemplate();
      }
    }

    // ── Public API ────────────────────────────────────────────────────────────

    async refreshTemplate(): Promise<void> {
      this._activeTemplate = null;
      await this._loadTemplate();
    }

    setTemplate(fn: TemplateFunction): void {
      this._activeTemplate = fn;
      this._loadError = null;
    }

    // ── Template hooks (override in subclasses) ───────────────────────────────

    defaultTemplate(): TemplateResult {
      return html`<slot></slot>`;
    }

    fallbackTemplate(): TemplateResult {
      return html`<div role="alert" style="color:var(--nc-color-error,red)">
        Widget unavailable
      </div>`;
    }

    renderTemplate(): TemplateResult | typeof nothing {
      if (this.designMode && this._previewError) {
        return html`<pre style="color:var(--nc-color-error,red);white-space:pre-wrap"
          >Syntax error: ${this._previewError}</pre
        >`;
      }

      const fn = this._previewTemplate ?? this._activeTemplate;
      if (fn) {
        return safeRender(fn, this as unknown as LitElement);
      }

      if (this._loadError) {
        return this.fallbackTemplate();
      }

      const apiUrl = this.templateApiUrl ?? this._config.templateApiUrl;
      if (!apiUrl) {
        return this.defaultTemplate();
      }

      // Loading — subclass can override render() to show a spinner here.
      return nothing;
    }

    // ── Design mode ───────────────────────────────────────────────────────────

    protected _onEditorChange(source: string): void {
      this._editorSource = source;
      const result = compileTemplate(source);
      if (result.ok) {
        this._previewTemplate = result.fn;
        this._previewError = null;
      } else {
        this._previewTemplate = null;
        this._previewError = result.error;
      }
    }

    protected async _saveTemplate(): Promise<void> {
      const apiUrl = this.templateApiUrl ?? this._config.templateApiUrl;
      if (!apiUrl) return;

      this._saving = true;
      this._saveError = null;

      try {
        const res = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prefix: this._prefix,
            templateType: this.templateType ?? 'default',
            source: this._editorSource,
          }),
        });

        if (!res.ok) {
          const body = await res.text();
          throw new Error(`Save failed (${res.status}): ${body}`);
        }

        const data = (await res.json()) as TemplateSaveResponse;
        const fn = await loadModule(data.moduleUrl);
        this.setTemplate(fn);
        this._previewTemplate = null;
        this._previewError = null;
      } catch (err) {
        this._saveError = err instanceof Error ? err.message : String(err);
      } finally {
        this._saving = false;
      }
    }

    // ── Internals ─────────────────────────────────────────────────────────────

    /**
     * Template namespace prefix — defaults to the element's class name.
     * IMPORTANT: bundler must preserve class names, or override this getter.
     */
    protected get _prefix(): string {
      return this.constructor.name;
    }

    private async _loadTemplate(): Promise<void> {
      const apiUrl = this.templateApiUrl ?? this._config.templateApiUrl;
      if (!apiUrl) return;

      try {
        const url = new URL(apiUrl, location.href);
        url.searchParams.set('prefix', this._prefix);
        url.searchParams.set('type', this.templateType ?? 'default');

        const res = await fetch(url.toString());
        if (!res.ok) {
          if (res.status === 404) {
            // No server template — render defaultTemplate().
            return;
          }
          throw new Error(`Template fetch failed (${res.status})`);
        }

        const data = (await res.json()) as { moduleUrl: string };
        const fn = await loadModule(data.moduleUrl);
        this._activeTemplate = fn;
        this._loadError = null;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.warn(`[nascacht] Template load failed for ${this._prefix}:`, message);
        this._loadError = message;
        this._activeTemplate = null;
      }
    }
  }

  return NascachtTemplateElement as unknown as T & Constructor<NascachtTemplateMixinInterface>;
};
