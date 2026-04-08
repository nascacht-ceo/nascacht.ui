// Public API surface for nascacht-ui

// CDN configuration — call configureCdn() before any elements connect
export { configureCdn } from './cdn.js';
export type { CdnUrls } from './cdn.js';

// Elements — side-effect imports register custom elements
export { NascachtProvider } from './dock/nascacht-provider.js';
export { NascachtDock } from './dock/nascacht-dock.js';
export { NascachtKpi } from './widgets/nascacht-kpi.js';
export { NascachtMarkdown } from './widgets/nascacht-markdown.js';
export { NascachtThemeEditor } from './editor/nascacht-theme-editor.js';

// Mixin — for consumers building custom widgets
export {
  NascachtTemplateMixin,
  clearModuleCache,
} from './core/NascachtTemplateMixin.js';
export type { NascachtTemplateMixinInterface } from './core/NascachtTemplateMixin.js';

// Persistence
export { LocalStoragePersistenceAdapter } from './dock/dock-persistence.js';

// Types
export type {
  NascachtConfig,
  DockLayout,
  GroupDescriptor,
  PanelDescriptor,
  PersistenceAdapter,
  TemplateFunction,
  ThemeSeeds,
  ThemeTokens,
  AiOutput,
  TemplateRecord,
  TemplateBatchResponse,
  TemplateSaveResponse,
} from './types.js';

// Context key — for advanced consumers providing their own context
export { nascachtConfigContext } from './context.js';
