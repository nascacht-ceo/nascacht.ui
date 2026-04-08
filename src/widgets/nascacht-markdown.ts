import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { NascachtTemplateMixin } from '../core/NascachtTemplateMixin.js';
import type { TemplateResult } from 'lit';

// Minimal type — only what we use from marked
type MarkedModule = { parse(src: string): string };

/**
 * Lazy loader for marked.
 *
 * marked is loaded once on first use from a CDN — zero bundle impact.
 * The URL is configurable via NascachtMarkdown.markedUrl so consumers
 * can pin a version, use a local copy, or satisfy strict CSP rules.
 *
 *   NascachtMarkdown.markedUrl = 'https://esm.sh/marked@15';
 *
 * The promise is cached after the first call; concurrent requests share it.
 */
let _markedPromise: Promise<MarkedModule> | null = null;

function loadMarked(url: string): Promise<MarkedModule> {
  if (!_markedPromise) {
    _markedPromise = import(/* @vite-ignore */ url)
      .then((mod: unknown) => {
        const m = mod as Record<string, unknown>;
        if (typeof m['parse'] !== 'function' && typeof (m['marked'] as Record<string, unknown>)?.['parse'] !== 'function') {
          throw new Error('[nascacht] marked module has no parse() export');
        }
        // marked exports `parse` directly OR as `marked.parse`
        return (typeof m['parse'] === 'function' ? m : m['marked']) as MarkedModule;
      })
      .catch((err: unknown) => {
        _markedPromise = null; // allow retry on next render
        throw err;
      });
  }
  return _markedPromise;
}

/**
 * <nc-markdown> — Markdown rendering widget.
 *
 * Accepts raw markdown in the `content` property. Rendered via marked,
 * loaded lazily from CDN on first use.
 *
 * Usage:
 *   <nc-markdown content="# Hello\n\nWorld"></nc-markdown>
 *
 * Custom marked URL (version pin, private CDN, CSP):
 *   NascachtMarkdown.markedUrl = 'https://esm.sh/marked@15';
 *
 * CSP note: if using the default CDN URL, add to your policy:
 *   script-src 'self' https://esm.sh;
 */
@customElement('nc-markdown')
export class NascachtMarkdown extends NascachtTemplateMixin(LitElement) {
  /**
   * CDN URL for marked. Override before any <nc-markdown> element
   * is connected to the DOM to use a different version or source.
   */
  static markedUrl = 'https://esm.sh/marked@15';

  static override styles = css`
    :host {
      /* Layout & chrome — tier 2 (widget-level) */
      display: block;
      padding:       var(--nc-md-padding,     var(--nc-widget-padding));
      background:    var(--nc-md-bg,          var(--nc-widget-bg));
      border:        var(--nc-md-border,      var(--nc-widget-border));
      border-radius: var(--nc-md-radius,      var(--nc-widget-radius));
      box-shadow:    var(--nc-md-shadow,      var(--nc-widget-shadow));

      /* Component tokens — tier 3 */
      --nc-md-font-family:    var(--nc-font-family);
      --nc-md-font-size:      var(--nc-text-base);
      --nc-md-line-height:    var(--nc-line-height-normal);
      --nc-md-text-color:     var(--nc-text-primary);
      --nc-md-muted-color:    var(--nc-text-secondary);

      --nc-md-heading-color:  var(--nc-text-primary);
      --nc-md-h1-size:        var(--nc-text-2xl);
      --nc-md-h2-size:        var(--nc-text-xl);
      --nc-md-h3-size:        var(--nc-text-lg);

      --nc-md-link-color:     var(--nc-color-primary);
      --nc-md-link-hover:     var(--nc-color-primary-hover);

      --nc-md-code-bg:        var(--nc-color-primary-muted);
      --nc-md-code-color:     var(--nc-color-primary);
      --nc-md-code-radius:    var(--nc-radius-sm);

      --nc-md-blockquote-border: var(--nc-color-primary);
      --nc-md-blockquote-bg:     var(--nc-color-primary-muted);

      --nc-md-hr-color:       var(--nc-border);

      font-family:  var(--nc-md-font-family);
      font-size:    var(--nc-md-font-size);
      color:        var(--nc-md-text-color);
      line-height:  var(--nc-md-line-height);
    }

    /* Prose rhythm */
    :host > * { margin: 0; }
    :host p + p { margin-top: var(--nc-space-3); }

    :host h1, :host h2, :host h3, :host h4 {
      font-weight:   var(--nc-font-weight-bold);
      line-height:   var(--nc-line-height-tight);
      color:         var(--nc-md-heading-color);
      margin-top:    var(--nc-space-6);
      margin-bottom: var(--nc-space-2);
    }
    :host h1 { font-size: var(--nc-md-h1-size); }
    :host h2 { font-size: var(--nc-md-h2-size); }
    :host h3 { font-size: var(--nc-md-h3-size); }
    :host h4 { font-size: var(--nc-text-base); font-weight: var(--nc-font-weight-medium); }

    :host a {
      color: var(--nc-md-link-color);
      text-decoration: underline;
    }
    :host a:hover { color: var(--nc-md-link-hover); }

    :host code {
      background:    var(--nc-md-code-bg);
      color:         var(--nc-md-code-color);
      border-radius: var(--nc-md-code-radius);
      padding:       0.1em 0.35em;
      font-size:     var(--nc-text-sm);
    }

    :host pre {
      background:    var(--nc-surface-sunken);
      border-radius: var(--nc-radius-md);
      padding:       var(--nc-space-4);
      overflow-x:    auto;
      margin:        var(--nc-space-3) 0;
    }
    :host pre code {
      background: none;
      color:      var(--nc-text-primary);
      padding:    0;
    }

    :host blockquote {
      border-left:    3px solid var(--nc-md-blockquote-border);
      background:     var(--nc-md-blockquote-bg);
      margin:         var(--nc-space-3) 0;
      padding:        var(--nc-space-3) var(--nc-space-4);
      border-radius:  0 var(--nc-radius-sm) var(--nc-radius-sm) 0;
      color:          var(--nc-md-muted-color);
    }

    :host hr {
      border: none;
      border-top: 1px solid var(--nc-md-hr-color);
      margin: var(--nc-space-6) 0;
    }

    :host ul, :host ol {
      padding-left: var(--nc-space-6);
      margin: var(--nc-space-2) 0;
    }
    :host li + li { margin-top: var(--nc-space-1); }
  `;

  /** Raw markdown string. Parsed to HTML via marked (loaded from CDN on first use). */
  @property() content = '';

  @state() private _html = '';
  @state() private _loadError = '';

  override updated(changed: Map<string, unknown>): void {
    super.updated(changed);
    if (changed.has('content')) {
      void this._parse();
    }
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (this.content) void this._parse();
  }

  private async _parse(): Promise<void> {
    if (!this.content) {
      this._html = '';
      return;
    }
    try {
      const marked = await loadMarked(NascachtMarkdown.markedUrl);
      this._html = marked.parse(this.content);
      this._loadError = '';
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn('[nascacht] nc-markdown: failed to load marked —', msg);
      this._loadError = msg;
    }
  }

  override defaultTemplate(): TemplateResult {
    if (this._loadError) {
      return html`<div role="alert" style="color:var(--nc-color-error)">
        Could not load markdown parser: ${this._loadError}
      </div>`;
    }
    if (!this._html) return html`${nothing}`;
    return html`${unsafeHTML(this._html)}`;
  }

  override render(): TemplateResult {
    return this.renderTemplate() as TemplateResult;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'nc-markdown': NascachtMarkdown;
  }
}
