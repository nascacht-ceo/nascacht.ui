import type { LitElement, TemplateResult } from 'lit';

// ──────────────────────────────────────────────
// Template system
// ──────────────────────────────────────────────

export type TemplateFunction<T extends LitElement = LitElement> = (
  component: T
) => TemplateResult;

// ──────────────────────────────────────────────
// Theme tokens
// ──────────────────────────────────────────────

/**
 * The 6 seed variables that define a nascacht-ui theme.
 * All other design tokens are derived from these via CSS math in tokens.css.
 *
 * Example custom theme:
 *   provider.theme = {
 *     '--nc-brand': 'oklch(50% 0.22 160)',  // teal
 *     '--nc-surface-l': '0.97',
 *   };
 */
export interface ThemeSeeds {
  '--nc-brand': string;           // oklch color — primary brand hue
  '--nc-surface-l': string;       // 0–1 — base surface lightness
  '--nc-radius-unit': string;     // px/rem — base corner radius
  '--nc-space-unit': string;      // rem — base spacing unit
  '--nc-font-family': string;     // typeface stack
  '--nc-font-size-root': string;  // rem — root font size
}

/** @deprecated Use ThemeSeeds — renamed to reflect that only seeds are needed */
export type ThemeTokens = ThemeSeeds;

// ──────────────────────────────────────────────
// Config context (provided by <nc-provider>)
// ──────────────────────────────────────────────

export interface PersistenceAdapter {
  load(key: string): Promise<DockLayout | null>;
  save(key: string, layout: DockLayout): Promise<void>;
}

export interface NascachtConfig {
  templateApiUrl?: string;
  persistenceAdapter?: PersistenceAdapter;
  theme?: Partial<ThemeSeeds>;
}

// ──────────────────────────────────────────────
// Dock layout DSL
// ──────────────────────────────────────────────

export interface PanelDescriptor {
  id: string;
  widgetType: string;      // maps to custom element: 'kpi' → 'nc-kpi'
  title: string;
  visible: boolean;
  config: Record<string, unknown>;
  templateType?: string;   // named template variant; undefined = default
}

export interface GroupDescriptor {
  id: string;
  direction: 'horizontal' | 'vertical' | 'tabs';
  panels?: PanelDescriptor[];    // leaf: contains panels
  children?: GroupDescriptor[];  // branch: contains nested groups
  sizes?: number[];              // proportional split ratios
}

export interface DockLayout {
  version: number;
  root: GroupDescriptor;
}

// ──────────────────────────────────────────────
// AI output discriminated union
// ──────────────────────────────────────────────

export type AiOutput =
  | { type: 'template'; content: string }
  | { type: 'layout'; layout: Partial<DockLayout> };

// ──────────────────────────────────────────────
// Template API response shapes
// ──────────────────────────────────────────────

export interface TemplateRecord {
  prefix: string;
  templateType: string;
  moduleUrl: string;   // content-addressed: /template/module/{prefix}/{type}/{hash}.js
}

export interface TemplateBatchResponse {
  templates: TemplateRecord[];
  etag: string;
}

export interface TemplateSaveResponse {
  moduleUrl: string;
}
