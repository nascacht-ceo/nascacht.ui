import { NascachtMarkdown } from './widgets/nascacht-markdown.js';
import { NascachtDock } from './dock/nascacht-dock.js';

/**
 * CDN URLs for all nascacht-ui runtime dependencies.
 *
 * Each key maps to one lazily-loaded external module or stylesheet.
 * Omit a key to leave the default URL unchanged.
 *
 * Add keys here as new lazy deps are introduced (codemirror, chart lib, etc.)
 * so consumers always have a single place to configure CDN sources.
 */
export interface CdnUrls {
  /** marked — Markdown parser loaded by <nc-markdown> on first use. */
  marked?: string;

  /** dockview-core ES module — docking engine loaded by <nc-dock> on first use. */
  dockview?: string;

  /** dockview-core CSS — base styles for DockView chrome (tabs, sash, panels). */
  dockviewCss?: string;

  // Future entries (add matching wiring in configureCdn below):
  // codemirror?:  string;   // CodeMirror bundle for design-mode editor
  // chartLib?:    string;   // chart library for <nc-chart>
}

/**
 * Override the CDN URLs used by nascacht-ui for its runtime dependencies.
 *
 * Call once, in your app entry point, BEFORE any nascacht-ui elements are
 * connected to the DOM. Any element that connects before this call will use
 * the default esm.sh URLs.
 *
 * @example Small/prototype — zero config, defaults to esm.sh
 * ```ts
 * // Nothing to do — defaults work out of the box.
 * ```
 *
 * @example Production SaaS — switch to jsdelivr for better SLA
 * ```ts
 * import { configureCdn } from 'nascacht-ui';
 *
 * configureCdn({
 *   marked:      'https://cdn.jsdelivr.net/npm/marked@15/+esm',
 *   dockview:    'https://cdn.jsdelivr.net/npm/dockview-core@4.13.1/+esm',
 *   dockviewCss: 'https://cdn.jsdelivr.net/npm/dockview-core@4.13.1/dist/styles/dockview.css',
 * });
 * ```
 *
 * @example Enterprise — self-hosted copies, no external CDN calls
 * ```ts
 * import { configureCdn } from 'nascacht-ui';
 *
 * configureCdn({
 *   marked:      '/static/vendor/marked.js',
 *   dockview:    '/static/vendor/dockview-core.js',
 *   dockviewCss: '/static/vendor/dockview-core.css',
 * });
 * ```
 */
export function configureCdn(urls: Partial<CdnUrls>): void {
  if (urls.marked      !== undefined) NascachtMarkdown.markedUrl     = urls.marked;
  if (urls.dockview    !== undefined) NascachtDock.dockviewUrl       = urls.dockview;
  if (urls.dockviewCss !== undefined) NascachtDock.dockviewCssUrl    = urls.dockviewCss;
}
