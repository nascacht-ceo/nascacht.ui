import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { NascachtTemplateMixin } from '../core/NascachtTemplateMixin.js';
import type { TemplateResult } from 'lit';

/**
 * <nc-kpi> — Key Performance Indicator widget.
 *
 * Renders a labeled metric value with an optional trend indicator.
 * Can be used standalone or inside <nc-dock>.
 *
 * Usage:
 *   <nc-kpi label="Revenue" value="$1.2M" trend="+12%"></nc-kpi>
 */
@customElement('nc-kpi')
export class NascachtKpi extends NascachtTemplateMixin(LitElement) {
  static override styles = css`
    /*
     * Tier 1 — component tokens declared on :host.
     * All default to base/widget tokens. Consumers can override any of these
     * per-instance or globally via the theme.
     *
     * Example — green value for a specific KPI:
     *   <nc-kpi style="--nc-kpi-value-color: var(--nc-color-success)">
     *
     * Example — all KPIs use accent color for values:
     *   [data-nc-theme] { --nc-kpi-value-color: var(--nc-color-accent); }
     */
    :host {
      /* Layout & chrome — tier 2 (widget-level) */
      display: block;
      padding:       var(--nc-kpi-padding,       var(--nc-widget-padding));
      background:    var(--nc-kpi-bg,             var(--nc-widget-bg));
      border:        var(--nc-kpi-border,         var(--nc-widget-border));
      border-radius: var(--nc-kpi-radius,         var(--nc-widget-radius));
      box-shadow:    var(--nc-kpi-shadow,         var(--nc-widget-shadow));
      font-family:   var(--nc-kpi-font-family,    var(--nc-font-family));
      transition: box-shadow var(--nc-duration-normal) var(--nc-ease-standard);

      /* Component tokens — tier 3 */
      --nc-kpi-label-color:        var(--nc-text-secondary);
      --nc-kpi-label-size:         var(--nc-text-xs);
      --nc-kpi-label-weight:       var(--nc-font-weight-medium);
      --nc-kpi-label-spacing:      0.06em;

      --nc-kpi-value-color:        var(--nc-color-primary);
      --nc-kpi-value-size:         var(--nc-text-4xl);
      --nc-kpi-value-weight:       var(--nc-font-weight-bold);

      --nc-kpi-trend-color:        var(--nc-text-secondary);
      --nc-kpi-trend-size:         var(--nc-text-sm);
      --nc-kpi-trend-up-color:     var(--nc-color-success);
      --nc-kpi-trend-down-color:   var(--nc-color-error);
    }

    .label {
      font-size:      var(--nc-kpi-label-size);
      font-weight:    var(--nc-kpi-label-weight);
      color:          var(--nc-kpi-label-color);
      text-transform: uppercase;
      letter-spacing: var(--nc-kpi-label-spacing);
    }

    .value {
      font-size:   var(--nc-kpi-value-size);
      font-weight: var(--nc-kpi-value-weight);
      color:       var(--nc-kpi-value-color);
      line-height: var(--nc-line-height-tight);
      margin:      var(--nc-space-1) 0;
    }

    .trend {
      font-size: var(--nc-kpi-trend-size);
      color:     var(--nc-kpi-trend-color);
    }

    .trend[data-direction="up"]   { color: var(--nc-kpi-trend-up-color); }
    .trend[data-direction="down"] { color: var(--nc-kpi-trend-down-color); }
  `;

  @property() label = '';
  @property() value = '';
  @property() trend = '';

  override defaultTemplate(): TemplateResult {
    const trendDir = this.trend.startsWith('+') ? 'up'
                   : this.trend.startsWith('-') ? 'down'
                   : undefined;
    return html`
      <div class="label">${this.label}</div>
      <div class="value">${this.value}</div>
      ${this.trend ? html`
        <div class="trend" data-direction=${trendDir ?? ''}>${this.trend}</div>
      ` : ''}
    `;
  }

  override fallbackTemplate(): TemplateResult {
    return html`
      <div class="label">${this.label}</div>
      <div class="value" style="color:var(--nc-kpi-value-color,var(--nc-color-error))">—</div>
    `;
  }

  override render(): TemplateResult {
    return this.renderTemplate() as TemplateResult;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'nc-kpi': NascachtKpi;
  }
}
