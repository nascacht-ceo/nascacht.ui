# nascacht-ui — Claude Code Guide

## What this project is

`nascacht-ui` is a **framework-agnostic web component library** for building embeddable, dockable widget dashboards. 

Core value propositions:
- Business users can rearrange, hide, and add widgets (VS Code-style docking via DockView)
- Per-client theming via CSS custom properties — set 6 seed variables, everything else derives automatically
- AI can generate or modify both layout (JSON DSL) and rendering (Lit tagged templates, unrestricted)
- Widgets work standalone (`<nascacht-kpi>`) or inside `<nascacht-dock>`

---

## Tech stack

| Concern | Choice | Why |
|---------|--------|-----|
| Web components | **Lit 3** + `@lit/context` | Decorator support, reactive properties, context DI |
| Docking | **dockview-core** (MIT) | Modern TS API, active maintenance |
| Context propagation | **`@lit/context` ContextRoot** | Bridges `@lit/context` across DockView's DOM boundary |
| Build (library) | **tsup** (esbuild-based) | Dual output: tree-shakeable ESM/CJS + pre-bundled IIFE/ESM |
| Build (dev/docs) | **Storybook + Vite** | Component explorer, visual dev, a11y checks |
| Tests (unit) | **`@web/test-runner` + Playwright/Chromium** | Real browser, no jsdom |
| Tests (E2E) | **Playwright** against Storybook dev server | Full DockView bridge tests |
| TypeScript | strict mode, `useDefineForClassFields: false` | Required for Lit decorators |

---

## Commands

```bash
npm run storybook       # dev server at http://localhost:6006
npm run build           # dual output: dist/esm/ + dist/bundle/
npm run build:watch     # watch mode
npm run typecheck       # tsc --noEmit (run before every commit)
npm test                # @web/test-runner (requires: npx playwright install chromium)
npm run test:e2e        # Playwright E2E against Storybook
npm run lint            # ESLint
```

---

## Source layout

```
src/
  index.ts                     ← public API surface (re-exports everything)
  types.ts                     ← all shared TypeScript types
  context.ts                   ← @lit/context key for NascachtConfig

  core/
    NascachtTemplateMixin.ts   ← mixin: template load, design mode, fallback
    NascachtTemplateMixin.test.ts

  dock/
    nascacht-dock.ts           ← DockView bridge + ContextRoot + applyPatch()
    nascacht-provider.ts       ← context provider element, applies theme seeds
    dock-persistence.ts        ← PersistenceAdapter interface + localStorage impl

  widgets/
    nascacht-kpi.ts            ← KPI widget (v1)
    nascacht-markdown.ts       ← Markdown widget (v1)

  ai/
    module-loader.ts           ← dynamic import() with dedup cache
    module-loader.test.ts
    template-compiler.ts       ← new Function sandbox for design mode preview
    template-compiler.test.ts

  styles/
    tokens.css                 ← full derived token set (calculated from seeds)
    themes/
      light.css                ← light theme seeds
      dark.css                 ← dark theme seeds
      auto.css                 ← follows prefers-color-scheme

  stories/
    nascacht-kpi.stories.ts
    nascacht-markdown.stories.ts
```

---

## Build outputs

Two outputs from a single `tsup.config.ts`:

| Output | Path | Lit/DockView | Use case |
|--------|------|-------------|----------|
| ESM + CJS | `dist/esm/` | peer deps (external) | Consumers who bundle (webpack, Vite, Rollup) |
| ESM + IIFE | `dist/bundle/` | bundled + minified | CDN / `<script type="module">` with no build step |

**Warning:** CDN consumers who also use Lit in their own app get two Lit instances. `@lit/context` propagation between their app and nascacht-ui elements will fail. They must use the ESM build with shared Lit.

Type declarations are generated into `dist/esm/index.d.ts` (one set, shared by both outputs).

---

## CSS token system

Three-tier hierarchy. No hardcoded values in component CSS — everything is a token reference.

### Tier 1 — Seeds (6 variables, set per theme)
```css
--nc-brand          /* oklch color — entire color scale derives from this */
--nc-surface-l      /* 0–1 — surface lightness (0.98=light, 0.12=dark) */
--nc-radius-unit    /* base corner radius; all radii are multiples */
--nc-space-unit     /* base spacing unit (0.25rem = 4px); all spacing is multiples */
--nc-font-family    /* typeface stack */
--nc-font-size-root /* root font size; type scale derives from this */
```

### Tier 2 — Derived base tokens (`src/styles/tokens.css`)
Calculated via CSS math — `oklch` relative color syntax, `color-mix()`, `calc()`:
- Color: `--nc-color-primary/secondary/accent/error/success/warning/info`
- Surface: `--nc-surface/raised/sunken/overlay`
- Text: `--nc-text-primary/secondary/disabled`
- Border, shadow, spacing (1–16), type scale (xs–4xl), radii (sm–full), motion, z-index

### Tier 2.5 — Widget-level shared tokens (`tokens.css`)
```css
--nc-widget-bg/border/radius/shadow/padding
--nc-focus-ring
```
Override these to restyle ALL widgets at once.

### Tier 3 — Component tokens (declared in `:host`, default to tier 2)
```
--nc-kpi-*      (value-color, trend-up-color, trend-down-color, label-*, …)
--nc-md-*       (heading-color, link-color, code-bg, blockquote-*, …)
--nc-dock-*     (tab-bg, tab-active-bg, sash-color, panel-bg, …)
```
Each component declares its tokens in `:host` so they can be overridden per-instance or globally.

**oklch relative color syntax** — `from <origin>` MUST be first:
```css
/* correct */
oklch(from var(--nc-brand) calc(l - 0.06) c h)
/* wrong — browser rejects silently */
oklch(calc(l - 0.06) c from var(--nc-brand))
```

---

## Template system

Template resolution order for every widget:

```
design-mode active?
  yes → preview via new Function (transient, never persisted)
  no  → templateApiUrl configured?
          yes → GET /api/templates?prefix={ClassName}&type={templateType}
                  200 → import(moduleUrl)  →  server-compiled ES module
                  404 → defaultTemplate()  (no server template, not an error)
                  5xx → fallbackTemplate() + console.warn
                import() fails → fallbackTemplate() + console.warn
          no  → defaultTemplate()
```

Key classes:
- `NascachtTemplateMixin` — mixin applied to every widget; contains all template logic
- `module-loader.ts` — `loadModule(url)` deduplicates concurrent `import()` calls via a `Map<url, Promise>`. Evicts failed entries so retries work. **Call `clearModuleCache()` between test cases.**
- `template-compiler.ts` — `compileTemplate(source)` wraps `new Function` and returns `{ ok, fn } | { ok, error }`. `safeRender(fn, component)` catches runtime errors and returns an inline error template instead of throwing.

**Design mode** is gated by the `design-mode` attribute on `<nascacht-dock>`. Without it, `new Function` is never called. CodeMirror is lazy-imported on first design mode activation (zero cost for non-design-mode consumers).

**Prefix / minification caveat:** `_prefix` defaults to `this.constructor.name`. If consumers minify class names, they must either configure their bundler to preserve class names or override the `_prefix` getter in each widget.

---

## Widget registry

Widget resolution: `widgetType: 'kpi'` → `customElements.get('nascacht-kpi')`. No synthetic registry — uses the platform's Custom Elements Registry directly. Widgets must be registered (imported) before the dock initialises. Unknown widget types render a placeholder, no crash.

---

## Key types

```typescript
// Config injected via <nascacht-provider> or <nascacht-dock>
interface NascachtConfig {
  templateApiUrl?: string;
  persistenceAdapter?: PersistenceAdapter;
  theme?: Partial<ThemeSeeds>;
}

// Layout DSL — governs dock positions (where); templates govern rendering (how)
interface DockLayout   { version: number; root: GroupDescriptor; }
interface GroupDescriptor {
  id: string; direction: 'horizontal' | 'vertical' | 'tabs';
  panels?: PanelDescriptor[];   // leaf
  children?: GroupDescriptor[]; // branch
  sizes?: number[];
}
interface PanelDescriptor {
  id: string; widgetType: string; title: string; visible: boolean;
  config: Record<string, unknown>; templateType?: string;
}

// AI output — layout patches or template source
type AiOutput =
  | { type: 'template'; content: string }
  | { type: 'layout'; layout: Partial<DockLayout> };

// Template function signature
type TemplateFunction<T extends LitElement = LitElement> = (component: T) => TemplateResult;
```

---

## Persistence

`PersistenceAdapter` interface: `load(key): Promise<DockLayout | null>`, `save(key, layout): Promise<void>`.

Default: `LocalStoragePersistenceAdapter`. Consumers provide a custom adapter via `NascachtConfig` for server-side or multi-user persistence.

`<nascacht-dock>` calls `adapter.load(layoutKey)` on init. If `load` throws, falls back to default layout. Calls `adapter.save()` on every DockView layout change event.

---

## DockView + context bridge

DockView panels render in light DOM but outside the nascacht shadow tree, breaking `@lit/context` propagation. Fix: `ContextRoot` from `@lit/context` is installed on `document.body` in `nascacht-dock.connectedCallback()`. This enables context to reach widget elements inside DockView panels, including floating panels.

---

## v1 scope (current)

- `<nascacht-provider>`, `<nascacht-dock>`, `<nascacht-kpi>`, `<nascacht-markdown>`
- `NascachtTemplateMixin` (public mixin for custom widgets)
- `LocalStoragePersistenceAdapter`
- Light / dark / auto themes

## v1.1 scope (deferred — see TODOS.md)

- `<nascacht-table>`, `<nascacht-chart>` (chart library TBD — see TODOS.md spike)
- `<nascacht-theme-editor>` (power-user theme editing UI + persistence)
- `<nascacht-form>`
- Batch template fetch (`GET /search?prefixes=…` with ETag support)
- CodeMirror design mode editor (lazy import already wired, implementation deferred)
- CSP configuration guide for consumers using `import()` of remote modules

---

## Conventions

- All CSS custom properties use `--nc-` prefix (not `--nascacht-`)
- Component-specific tokens: `--nc-{abbrev}-*` (`kpi`, `md`, `dock`, `table`, `chart`)
- No hardcoded values in component CSS — every property references a token
- Mixin return type uses explicit cast: `return X as unknown as T & Constructor<Interface>`
- Lit mixin constructor must be `any[]` (TS mixin spec requirement)
- `verbatimModuleSyntax: true` — use `import type` for type-only imports
- `.js` extensions on all local imports (required for ESM)
