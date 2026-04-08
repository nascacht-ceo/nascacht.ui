import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { provide } from '@lit/context';
import type { TemplateResult } from 'lit';
import { nascachtConfigContext } from '../context.js';
import type { NascachtConfig, ThemeSeeds } from '../types.js';

/**
 * <nc-provider> — Context provider for NascachtConfig.
 *
 * Wrap your application (or a subtree) with this element to supply
 * shared configuration (templateApiUrl, persistenceAdapter, theme)
 * to all nascacht widgets below it.
 *
 * Theme seeds are applied as CSS custom properties on the host element,
 * so all descendant widgets inherit them via the cascade.
 *
 * Usage:
 *   <nc-provider template-api-url="/api/templates" data-nc-theme="dark">
 *     <nc-dock>...</nc-dock>
 *   </nc-provider>
 *
 * Custom brand color:
 *   provider.theme = { '--nc-brand': 'oklch(50% 0.22 160)' };
 */
@customElement('nc-provider')
export class NascachtProvider extends LitElement {
  static override styles = css`
    :host {
      display: contents; /* transparent wrapper — no layout impact */
    }
  `;

  @provide({ context: nascachtConfigContext })
  @property({ attribute: false })
  config: NascachtConfig = {};

  @property({ attribute: 'template-api-url' })
  set templateApiUrl(value: string) {
    this.config = { ...this.config, templateApiUrl: value };
  }
  get templateApiUrl(): string {
    return this.config.templateApiUrl ?? '';
  }

  /**
   * Partial theme seed overrides. Applied as inline CSS custom properties
   * on the host element so they cascade into all child widgets.
   *
   * Only the seeds you specify are overridden; the rest inherit from
   * the active theme file (light.css / dark.css / auto.css).
   */
  @property({ attribute: false })
  set theme(value: Partial<ThemeSeeds>) {
    this.config = { ...this.config, theme: value };
    this._applyThemeSeeds(value);
  }
  get theme(): Partial<ThemeSeeds> {
    return this.config.theme ?? {};
  }

  private _applyThemeSeeds(seeds: Partial<ThemeSeeds>): void {
    // Remove previously applied seeds first
    for (const key of Array.from(this.style)) {
      if (key.startsWith('--nc-')) this.style.removeProperty(key);
    }
    // Apply new seeds
    for (const [key, value] of Object.entries(seeds)) {
      if (value !== undefined) {
        this.style.setProperty(key, value);
      }
    }
  }

  override render(): TemplateResult {
    return html`<slot></slot>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'nc-provider': NascachtProvider;
  }
}
