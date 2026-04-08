import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { TemplateResult } from 'lit';
import type { ThemeSeeds } from '../types.js';

// ── Seed state (internal representation) ─────────────────────────────────────

interface SeedState {
  brandH: number;    // hue     0–360
  brandC: number;    // chroma  0–0.37
  brandL: number;    // lightness 0.1–0.9
  surfaceL: number;  // 0.12 (dark) – 0.98 (light)
  radiusPx: number;  // 0–16 px
  spacePx: number;   // 2–8 px  (stored as px, written as rem)
  fontFamily: string;
  fontSizeRem: number; // 0.75–1.25
}

const DEFAULTS: SeedState = {
  brandH: 240,
  brandC: 0.20,
  brandL: 0.52,
  surfaceL: 0.98,
  radiusPx: 4,
  spacePx: 4,
  fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
  fontSizeRem: 1,
};

function stateToSeeds(s: SeedState): ThemeSeeds {
  return {
    '--nc-brand':          `oklch(${s.brandL} ${s.brandC.toFixed(3)} ${s.brandH})`,
    '--nc-surface-l':      String(s.surfaceL),
    '--nc-radius-unit':    `${s.radiusPx}px`,
    '--nc-space-unit':     `${(s.spacePx / 16).toFixed(4)}rem`,
    '--nc-font-family':    s.fontFamily,
    '--nc-font-size-root': `${s.fontSizeRem}rem`,
  };
}

function parseBrand(value: string): Pick<SeedState, 'brandH' | 'brandC' | 'brandL'> | null {
  // Parse oklch(L C H) or oklch(L% C H)
  const m = value.trim().match(
    /oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)/
  );
  if (!m) return null;
  const l = parseFloat(m[1]) / (m[2] === '%' ? 100 : 1);
  return { brandL: l, brandC: parseFloat(m[3]), brandH: parseFloat(m[4]) };
}

const STORAGE_PREFIX = 'nc-theme-';

/**
 * <nc-theme-editor> — visual theme editor for nascacht-ui.
 *
 * Edits the 6 seed variables that drive the entire token system.
 * Changes apply live to slotted preview content.
 * Saved themes persist to localStorage (and optionally a server endpoint).
 *
 * Usage:
 *   <nc-theme-editor theme-name="acme">
 *     <nc-kpi label="Revenue" value="$1.2M" trend="+12%"></nc-kpi>
 *   </nc-theme-editor>
 *
 * Server persistence:
 *   <nc-theme-editor theme-name="acme" save-url="/api/themes">
 */
@customElement('nc-theme-editor')
export class NascachtThemeEditor extends LitElement {
  static override styles = css`
    /*
     * The editor sets data-nc-theme on :host so tokens.css derived tokens
     * apply here, meaning the editor UI itself is also themed live.
     */
    :host {
      display: grid;
      grid-template-columns: 300px 1fr;
      grid-template-rows: auto 1fr;
      min-height: 400px;
      font-family:  var(--nc-font-family, system-ui);
      font-size:    var(--nc-text-sm, 0.875rem);
      color:        var(--nc-text-primary, #222);
      background:   var(--nc-surface, #fff);
      border:       1px solid var(--nc-border, #e0e0e0);
      border-radius: var(--nc-radius-lg, 12px);
      overflow: hidden;
    }

    /* ── Header ── */
    .header {
      grid-column: 1 / -1;
      display: flex;
      align-items: center;
      gap: var(--nc-space-3, 0.75rem);
      padding: var(--nc-space-3, 0.75rem) var(--nc-space-4, 1rem);
      background: var(--nc-surface-raised, #f5f5f5);
      border-bottom: 1px solid var(--nc-border, #e0e0e0);
    }

    .header h2 {
      flex: 1;
      margin: 0;
      font-size: var(--nc-text-sm, 0.875rem);
      font-weight: var(--nc-font-weight-bold, 700);
      color: var(--nc-text-primary, #222);
    }

    .theme-name-input {
      flex: 1;
      background: var(--nc-surface, #fff);
      border: 1px solid var(--nc-border, #e0e0e0);
      border-radius: var(--nc-radius-sm, 4px);
      padding: var(--nc-space-1, 0.25rem) var(--nc-space-2, 0.5rem);
      font-size: var(--nc-text-sm, 0.875rem);
      color: var(--nc-text-primary, #222);
    }

    .header-buttons {
      display: flex;
      gap: var(--nc-space-2, 0.5rem);
    }

    /* ── Controls panel ── */
    .controls {
      padding: var(--nc-space-4, 1rem);
      background: var(--nc-surface-raised, #f5f5f5);
      border-right: 1px solid var(--nc-border, #e0e0e0);
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: var(--nc-space-4, 1rem);
    }

    .section-title {
      font-size: var(--nc-text-xs, 0.75rem);
      font-weight: var(--nc-font-weight-bold, 700);
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--nc-text-secondary, #666);
      margin: 0 0 var(--nc-space-2, 0.5rem);
    }

    .control-group {
      display: flex;
      flex-direction: column;
      gap: var(--nc-space-2, 0.5rem);
    }

    .control-row {
      display: grid;
      grid-template-columns: 1fr auto;
      align-items: center;
      gap: var(--nc-space-2, 0.5rem);
    }

    label {
      font-size: var(--nc-text-xs, 0.75rem);
      color: var(--nc-text-secondary, #666);
      white-space: nowrap;
    }

    .value-badge {
      font-size: var(--nc-text-xs, 0.75rem);
      font-variant-numeric: tabular-nums;
      color: var(--nc-text-secondary, #666);
      min-width: 3.5rem;
      text-align: right;
    }

    input[type="range"] {
      width: 100%;
      accent-color: var(--nc-color-primary, #1a56db);
      cursor: pointer;
    }

    input[type="text"] {
      width: 100%;
      background: var(--nc-surface, #fff);
      border: 1px solid var(--nc-border, #e0e0e0);
      border-radius: var(--nc-radius-sm, 4px);
      padding: var(--nc-space-1, 0.25rem) var(--nc-space-2, 0.5rem);
      font-size: var(--nc-text-xs, 0.75rem);
      color: var(--nc-text-primary, #222);
      font-family: var(--nc-font-family, system-ui);
      box-sizing: border-box;
    }

    /* Brand color swatch */
    .swatch {
      width: 100%;
      height: 32px;
      border-radius: var(--nc-radius-sm, 4px);
      border: 1px solid var(--nc-border, #e0e0e0);
      margin-bottom: var(--nc-space-1, 0.25rem);
    }

    /* Hue slider with rainbow track */
    .hue-track {
      -webkit-appearance: none;
      appearance: none;
      width: 100%;
      height: 8px;
      border-radius: var(--nc-radius-full, 9999px);
      background: linear-gradient(
        to right,
        oklch(0.65 0.22 0),
        oklch(0.65 0.22 60),
        oklch(0.65 0.22 120),
        oklch(0.65 0.22 180),
        oklch(0.65 0.22 240),
        oklch(0.65 0.22 300),
        oklch(0.65 0.22 360)
      );
      cursor: pointer;
    }
    .hue-track::-webkit-slider-thumb {
      -webkit-appearance: none;
      width: 16px; height: 16px;
      border-radius: 50%;
      background: white;
      border: 2px solid #333;
      cursor: pointer;
    }

    /* Surface lightness slider: dark ← → light */
    .surface-track {
      -webkit-appearance: none;
      appearance: none;
      width: 100%;
      height: 8px;
      border-radius: var(--nc-radius-full, 9999px);
      background: linear-gradient(to right, oklch(0.12 0.005 240), oklch(0.98 0.005 240));
      cursor: pointer;
    }
    .surface-track::-webkit-slider-thumb {
      -webkit-appearance: none;
      width: 16px; height: 16px;
      border-radius: 50%;
      background: white;
      border: 2px solid #333;
      cursor: pointer;
    }

    .surface-labels {
      display: flex;
      justify-content: space-between;
      font-size: var(--nc-text-xs, 0.75rem);
      color: var(--nc-text-secondary, #666);
    }

    /* ── Preview panel ── */
    .preview {
      padding: var(--nc-space-4, 1rem);
      background: var(--nc-surface, #fff);
      overflow: auto;
      display: flex;
      flex-direction: column;
      gap: var(--nc-space-4, 1rem);
    }

    /* ── Buttons ── */
    .btn {
      display: inline-flex;
      align-items: center;
      gap: var(--nc-space-1, 0.25rem);
      padding: var(--nc-space-1, 0.25rem) var(--nc-space-3, 0.75rem);
      border-radius: var(--nc-radius-sm, 4px);
      font-size: var(--nc-text-xs, 0.75rem);
      font-weight: var(--nc-font-weight-medium, 500);
      cursor: pointer;
      border: 1px solid transparent;
      transition: opacity 150ms;
      white-space: nowrap;
    }
    .btn:disabled { opacity: 0.5; cursor: default; }

    .btn-primary {
      background: var(--nc-color-primary, #1a56db);
      color: var(--nc-on-primary, white);
      border-color: var(--nc-color-primary, #1a56db);
    }
    .btn-primary:hover:not(:disabled) {
      background: var(--nc-color-primary-hover, #1245b5);
    }

    .btn-secondary {
      background: var(--nc-surface, #fff);
      color: var(--nc-text-primary, #222);
      border-color: var(--nc-border, #e0e0e0);
    }
    .btn-secondary:hover:not(:disabled) {
      background: var(--nc-surface-raised, #f5f5f5);
    }

    .btn-ghost {
      background: transparent;
      color: var(--nc-text-secondary, #666);
      border-color: transparent;
    }
    .btn-ghost:hover:not(:disabled) {
      background: var(--nc-surface-raised, #f5f5f5);
      color: var(--nc-text-primary, #222);
    }

    .status-text {
      font-size: var(--nc-text-xs, 0.75rem);
      color: var(--nc-color-success, green);
      align-self: center;
    }
  `;

  // ── Public properties ───────────────────────────────────────────────────────

  @property({ attribute: 'theme-name' }) themeName = 'custom';
  @property({ attribute: 'save-url' }) saveUrl = '';

  // ── Internal state ──────────────────────────────────────────────────────────

  @state() private _s: SeedState = { ...DEFAULTS };
  @state() private _saving = false;
  @state() private _saved = false;
  @state() private _copied = false;

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  override connectedCallback(): void {
    super.connectedCallback();
    // Must have data-nc-theme so tokens.css derived token rules apply to :host
    if (!this.hasAttribute('data-nc-theme')) {
      this.setAttribute('data-nc-theme', '');
    }
    this._loadFromStorage();
    this._applySeeds();
  }

  override updated(changed: Map<string, unknown>): void {
    super.updated(changed);
    if (changed.has('themeName')) {
      this._loadFromStorage();
      this._applySeeds();
    }
  }

  // ── Persistence ─────────────────────────────────────────────────────────────

  private _storageKey(): string {
    return `${STORAGE_PREFIX}${this.themeName}`;
  }

  private _loadFromStorage(): void {
    try {
      const raw = localStorage.getItem(this._storageKey());
      if (!raw) return;
      const saved = JSON.parse(raw) as Partial<SeedState>;
      this._s = { ...DEFAULTS, ...saved };
    } catch {
      // Corrupt storage — ignore, use defaults
    }
  }

  private _saveToStorage(): void {
    localStorage.setItem(this._storageKey(), JSON.stringify(this._s));
  }

  private async _save(): Promise<void> {
    this._saveToStorage();

    if (this.saveUrl) {
      this._saving = true;
      try {
        await fetch(this.saveUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: this.themeName, seeds: stateToSeeds(this._s) }),
        });
      } catch (err) {
        console.warn('[nascacht] Theme save failed:', err);
      } finally {
        this._saving = false;
      }
    }

    this._saved = true;
    setTimeout(() => { this._saved = false; }, 2000);
  }

  private async _copyExport(): Promise<void> {
    const seeds = stateToSeeds(this._s);
    const lines = (Object.entries(seeds) as [string, string][])
      .map(([k, v]) => `  ${k}: ${v};`)
      .join('\n');
    const css = `[data-nc-theme="${this.themeName}"] {\n${lines}\n}`;
    await navigator.clipboard.writeText(css);
    this._copied = true;
    setTimeout(() => { this._copied = false; }, 2000);
  }

  private _reset(): void {
    this._s = { ...DEFAULTS };
    this._applySeeds();
  }

  // ── Seed application ─────────────────────────────────────────────────────────

  private _applySeeds(): void {
    const seeds = stateToSeeds(this._s);
    for (const [key, value] of Object.entries(seeds)) {
      this.style.setProperty(key, value);
    }
  }

  private _update(patch: Partial<SeedState>): void {
    this._s = { ...this._s, ...patch };
    this._applySeeds();
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  private get _swatchColor(): string {
    return `oklch(${this._s.brandL} ${this._s.brandC.toFixed(3)} ${this._s.brandH})`;
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  override render(): TemplateResult {
    const s = this._s;

    return html`
      <!-- Header -->
      <div class="header">
        <h2>Theme Editor</h2>
        <input
          class="theme-name-input"
          type="text"
          .value=${this.themeName}
          placeholder="theme name"
          title="Theme name (used as CSS attribute value and storage key)"
          @change=${(e: Event) => {
            this.themeName = (e.target as HTMLInputElement).value || 'custom';
          }}
        />
        <div class="header-buttons">
          <button class="btn btn-ghost" @click=${this._reset}>Reset</button>
          <button class="btn btn-secondary" @click=${this._copyExport}>
            ${this._copied ? '✓ Copied!' : 'Export CSS'}
          </button>
          <button class="btn btn-primary" ?disabled=${this._saving} @click=${this._save}>
            ${this._saving ? 'Saving…' : this._saved ? '✓ Saved' : 'Save'}
          </button>
        </div>
      </div>

      <!-- Controls -->
      <div class="controls">

        <!-- Brand color -->
        <div class="control-group">
          <p class="section-title">Brand Color</p>
          <div class="swatch" style="background: ${this._swatchColor}"></div>

          <label>Hue</label>
          <div class="control-row">
            <input
              class="hue-track"
              type="range" min="0" max="360" step="1"
              .value=${String(s.brandH)}
              @input=${(e: Event) => this._update({ brandH: Number((e.target as HTMLInputElement).value) })}
            />
            <span class="value-badge">${s.brandH}°</span>
          </div>

          <label>Saturation</label>
          <div class="control-row">
            <input
              type="range" min="0" max="0.37" step="0.01"
              .value=${String(s.brandC)}
              @input=${(e: Event) => this._update({ brandC: Number((e.target as HTMLInputElement).value) })}
            />
            <span class="value-badge">${(s.brandC * 100).toFixed(0)}%</span>
          </div>

          <label>Brightness</label>
          <div class="control-row">
            <input
              type="range" min="0.1" max="0.9" step="0.01"
              .value=${String(s.brandL)}
              @input=${(e: Event) => this._update({ brandL: Number((e.target as HTMLInputElement).value) })}
            />
            <span class="value-badge">${(s.brandL * 100).toFixed(0)}%</span>
          </div>
        </div>

        <!-- Appearance -->
        <div class="control-group">
          <p class="section-title">Appearance</p>
          <label>Light ↔ Dark</label>
          <input
            class="surface-track"
            type="range" min="0.12" max="0.98" step="0.01"
            .value=${String(s.surfaceL)}
            @input=${(e: Event) => this._update({ surfaceL: Number((e.target as HTMLInputElement).value) })}
          />
          <div class="surface-labels"><span>Dark</span><span>Light</span></div>
        </div>

        <!-- Shape -->
        <div class="control-group">
          <p class="section-title">Shape</p>
          <label>Corner Radius</label>
          <div class="control-row">
            <input
              type="range" min="0" max="16" step="1"
              .value=${String(s.radiusPx)}
              @input=${(e: Event) => this._update({ radiusPx: Number((e.target as HTMLInputElement).value) })}
            />
            <span class="value-badge">${s.radiusPx}px</span>
          </div>
        </div>

        <!-- Spacing -->
        <div class="control-group">
          <p class="section-title">Spacing</p>
          <label>Base Unit</label>
          <div class="control-row">
            <input
              type="range" min="2" max="8" step="0.5"
              .value=${String(s.spacePx)}
              @input=${(e: Event) => this._update({ spacePx: Number((e.target as HTMLInputElement).value) })}
            />
            <span class="value-badge">${s.spacePx}px</span>
          </div>
        </div>

        <!-- Typography -->
        <div class="control-group">
          <p class="section-title">Typography</p>
          <label>Font Family</label>
          <input
            type="text"
            list="nc-font-presets"
            .value=${s.fontFamily}
            @change=${(e: Event) => this._update({ fontFamily: (e.target as HTMLInputElement).value })}
          />
          <datalist id="nc-font-presets">
            <option value='system-ui, -apple-system, "Segoe UI", sans-serif'></option>
            <option value="Georgia, 'Times New Roman', serif"></option>
            <option value="'Courier New', Courier, monospace"></option>
            <option value="Inter, system-ui, sans-serif"></option>
          </datalist>

          <label>Base Font Size</label>
          <div class="control-row">
            <input
              type="range" min="0.75" max="1.25" step="0.05"
              .value=${String(s.fontSizeRem)}
              @input=${(e: Event) => this._update({ fontSizeRem: Number((e.target as HTMLInputElement).value) })}
            />
            <span class="value-badge">${s.fontSizeRem}rem</span>
          </div>
        </div>

      </div>

      <!-- Preview -->
      <div class="preview">
        <slot></slot>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'nc-theme-editor': NascachtThemeEditor;
  }
}
