# nascacht-ui

Framework-agnostic dockable widget library built on web components. Drop widgets into any page — React, Angular, Vue, or plain HTML — with VS Code-style drag-and-drop layout, per-client theming, and AI-driven rendering.

## Features

- **Dockable panels** — drag, resize, split, float, and pin widgets using DockView
- **AI-ready templates** — AI generates or modifies rendering via Lit tagged templates; layout via a JSON DSL
- **Design mode** — in-browser template editor with live preview, backed by server-side compilation
- **Theme system** — set 6 CSS seed variables; all colors, spacing, and typography derive automatically
- **Framework agnostic** — pure web components; works anywhere a `<script>` tag does
- **Embeddable** — use one widget standalone or compose dozens in a full dashboard

---

## Installation

```bash
npm install nascacht-ui lit @lit/context
```

> `lit` and `@lit/context` are peer dependencies. `dockview-core` and `marked` are loaded lazily from CDN at runtime — see [Deployment](#deployment).

### CDN (no build step)

```html
<link rel="stylesheet" href="https://esm.sh/nascacht-ui/dist/esm/styles/themes/auto.css">
<script type="module" src="https://esm.sh/nascacht-ui/dist/bundle/index.js"></script>
```

> **Note:** The bundled build includes Lit. If your app also uses Lit, use the ESM build instead — two Lit instances on the same page breaks `@lit/context` propagation.

---

## Quick start

### Standalone widget

No provider, no dock needed. Works in any HTML page.

```html
<nc-kpi label="Revenue" value="$1.2M" trend="+12%"></nc-kpi>

<script type="module">
  import 'nascacht-ui';
</script>
```

### Full dashboard

```html
<nc-provider template-api-url="/api/templates">
  <nc-dock layout-key="main-dashboard"></nc-dock>
</nc-provider>

<script type="module">
  import { NascachtDock } from 'nascacht-ui';

  const dock = document.querySelector('nc-dock');
  dock.applyPatch({
    version: 1,
    root: {
      id: 'root',
      direction: 'horizontal',
      panels: [
        { id: 'p1', widgetType: 'kpi',      title: 'Revenue', visible: true, config: {} },
        { id: 'p2', widgetType: 'markdown',  title: 'Notes',   visible: true, config: {} },
      ],
    },
  });
</script>
```

### React

```tsx
import 'nascacht-ui';

export function Dashboard() {
  return (
    <nc-provider template-api-url="/api/templates">
      <nc-dock layout-key="main" style={{ width: '100%', height: '600px' }} />
    </nc-provider>
  );
}
```

Add type declarations once in your project:

```ts
// nascacht-ui.d.ts
import type { } from 'nascacht-ui';
declare global {
  namespace JSX {
    interface IntrinsicElements {
      'nc-provider': React.HTMLAttributes<HTMLElement> & { 'template-api-url'?: string };
      'nc-dock':     React.HTMLAttributes<HTMLElement> & { 'layout-key'?: string; 'design-mode'?: boolean };
      'nc-kpi':      React.HTMLAttributes<HTMLElement> & { label?: string; value?: string; trend?: string };
      'nc-markdown': React.HTMLAttributes<HTMLElement> & { content?: string };
    }
  }
}
```

---

## Deployment

nascacht-ui lazy-loads heavy dependencies (DockView, marked) at runtime so they never bloat your initial bundle. You control where they come from.

### Tiers at a glance

| Client | Build | CDN config |
|--------|-------|------------|
| Prototype / small site | `dist/bundle/` | None — esm.sh defaults work out of the box |
| Production SaaS | `dist/bundle/` | Call `configureCdn()` to switch to a preferred CDN |
| Enterprise / strict CSP | `dist/esm/` | Self-host deps; no external network calls at runtime |

### Small / prototype — zero config

The bundled build defaults to [esm.sh](https://esm.sh) (open-source, Cloudflare-backed) for all runtime deps. Nothing to configure.

```html
<script type="module" src="https://esm.sh/nascacht-ui/dist/bundle/index.js"></script>
```

### Production SaaS — override CDN URLs

Call `configureCdn()` once in your app entry point, **before any nascacht-ui element connects to the DOM**:

```ts
import { configureCdn } from 'nascacht-ui';

configureCdn({
  marked:      'https://cdn.jsdelivr.net/npm/marked@15/+esm',
  dockview:    'https://cdn.jsdelivr.net/npm/dockview-core@4.13.1/+esm',
  dockviewCss: 'https://cdn.jsdelivr.net/npm/dockview-core@4.13.1/dist/styles/dockview.css',
});
```

Each key maps to one lazily-loaded dep. Omit keys you don't need to change:

| Key | Loaded by | Default URL |
|-----|-----------|-------------|
| `marked` | `<nc-markdown>` | `https://esm.sh/marked@15` |
| `dockview` | `<nc-dock>` | `https://esm.sh/dockview-core@4.13.1` |
| `dockviewCss` | `<nc-dock>` | `https://esm.sh/dockview-core@4.13.1/dist/styles/dockview.css` |

> New lazy dependencies (CodeMirror, chart library) will be added to this table as the library grows. `configureCdn()` is the single place to configure all of them.

### Enterprise — self-hosted, no external CDN

Use the `dist/esm/` build and point all deps at files you serve yourself:

```ts
import { configureCdn } from 'nascacht-ui';

configureCdn({
  marked:      '/static/vendor/marked.js',
  dockview:    '/static/vendor/dockview-core.js',
  dockviewCss: '/static/vendor/dockview-core.css',
});
```

Download the vendored files once (e.g. from the CDN URLs above) and check them into your static assets. No external network calls at runtime — safe for strict CSP, air-gapped networks, and apps that need 100% dependency auditability.

---

## Theming

### Apply a built-in theme

```html
<!-- Light (default) -->
<link rel="stylesheet" href="nascacht-ui/dist/esm/styles/themes/light.css">

<!-- Dark -->
<link rel="stylesheet" href="nascacht-ui/dist/esm/styles/themes/dark.css">

<!-- Follows OS preference automatically -->
<link rel="stylesheet" href="nascacht-ui/dist/esm/styles/themes/auto.css">
```

Add `data-nc-theme="dark"` to any container to scope dark mode to a subtree:

```html
<div data-nc-theme="dark">
  <nc-kpi label="Revenue" value="$1.2M"></nc-kpi>
</div>
```

### Custom brand color

The entire color scale — primary, secondary, accent, status colors, surfaces, text, and shadows — derives from a single `--nc-brand` oklch color. Change the brand and everything updates.

```js
const provider = document.querySelector('nc-provider');
provider.theme = {
  '--nc-brand': 'oklch(50% 0.22 160)',  // teal
};
```

Or via CSS:

```css
:root {
  --nc-brand:       oklch(50% 0.22 160);  /* teal */
  --nc-surface-l:   0.97;                 /* slightly off-white */
  --nc-radius-unit: 2px;                  /* sharper corners */
}
```

### The 6 seed variables

| Variable | Default (light) | Effect |
|----------|----------------|--------|
| `--nc-brand` | `oklch(52% 0.20 240)` | Primary hue — entire color scale derives from this |
| `--nc-surface-l` | `0.98` | Surface lightness: `0.98` = near-white, `0.12` = near-black |
| `--nc-radius-unit` | `4px` | Base corner radius; components use 1×–8× multiples |
| `--nc-space-unit` | `0.25rem` | Base spacing unit (4px); layout uses 1×–16× multiples |
| `--nc-font-family` | `system-ui` | Typeface stack |
| `--nc-font-size-root` | `1rem` | Root font size; type scale derives from this |

### Override individual component tokens

Every component exposes CSS custom properties for its visual details, all defaulting to base tokens:

```css
/* Green values for a specific KPI */
nc-kpi.profit {
  --nc-kpi-value-color: var(--nc-color-success);
}

/* All KPI trend indicators use accent color */
[data-nc-theme] {
  --nc-kpi-trend-up-color:   var(--nc-color-success);
  --nc-kpi-trend-down-color: var(--nc-color-error);
}

/* Wider widget padding globally */
nc-provider {
  --nc-widget-padding: var(--nc-space-6);
}
```

See [Token reference](#token-reference) for the full list.

---

## Layout DSL

`<nc-dock>` is driven by a JSON layout. Call `dock.applyPatch(layout)` to update the layout programmatically — from a user action, a server response, or AI output.

```ts
interface DockLayout {
  version: number;
  root: GroupDescriptor;
}

interface GroupDescriptor {
  id: string;
  direction: 'horizontal' | 'vertical' | 'tabs';
  panels?: PanelDescriptor[];    // leaf node — contains widgets
  children?: GroupDescriptor[];  // branch node — nested groups
  sizes?: number[];              // proportional split ratios, e.g. [60, 40]
}

interface PanelDescriptor {
  id: string;
  widgetType: string;             // 'kpi' → resolves to <nc-kpi>
  title: string;
  visible: boolean;
  config: Record<string, unknown>;
  templateType?: string;          // named template variant; omit for default
}
```

**Example — three-panel horizontal split:**

```ts
dock.applyPatch({
  version: 1,
  root: {
    id: 'root',
    direction: 'horizontal',
    sizes: [30, 40, 30],
    panels: [
      { id: 'revenue', widgetType: 'kpi',      title: 'Revenue', visible: true, config: {} },
      { id: 'notes',   widgetType: 'markdown',  title: 'Summary', visible: true, config: {} },
      { id: 'users',   widgetType: 'kpi',       title: 'Users',   visible: true, config: {} },
    ],
  },
});
```

---

## AI integration

nascacht-ui is designed for AI-generated dashboards. Two output types are supported:

```ts
type AiOutput =
  | { type: 'template'; content: string }            // AI writes rendering logic
  | { type: 'layout';   layout: Partial<DockLayout> }; // AI arranges panels
```

**AI-generated layout:**

```ts
const aiResponse: AiOutput = await callYourAI(prompt);
if (aiResponse.type === 'layout') {
  dock.applyPatch(aiResponse.layout);
}
```

**AI-generated template (via design mode + server compilation):**

```ts
const source = `return html\`
  <div style="color: \${component.value > 0 ? 'green' : 'red'}">
    \${component.label}: \${component.value}
  </div>
\``;

await fetch('/api/templates', {
  method: 'POST',
  body: JSON.stringify({ prefix: 'NascachtKpi', templateType: 'custom', source }),
});
```

---

## Custom widgets

Build your own widget using `NascachtTemplateMixin`:

```ts
import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { NascachtTemplateMixin } from 'nascacht-ui';

@customElement('my-sparkline')
export class MySparkline extends NascachtTemplateMixin(LitElement) {
  static override styles = css`
    :host {
      display: block;
      padding:       var(--nc-widget-padding);
      background:    var(--nc-widget-bg);
      border:        var(--nc-widget-border);
      border-radius: var(--nc-widget-radius);

      --nc-sparkline-line-color: var(--nc-color-primary);
      --nc-sparkline-fill-color: var(--nc-color-primary-muted);
    }
  `;

  @property({ type: Array }) data: number[] = [];

  override defaultTemplate() {
    return html`<canvas></canvas>`;
  }

  override fallbackTemplate() {
    return html`<span>Unavailable</span>`;
  }

  override render() {
    return this.renderTemplate();
  }
}
```

Use it in a dock layout with `widgetType: 'sparkline'` — the dock resolves `customElements.get('my-sparkline')`.

---

## Persistence

Layout is saved and restored automatically. The default adapter uses `localStorage`.

**Custom adapter** (server-side, database, etc.):

```ts
import type { PersistenceAdapter, DockLayout } from 'nascacht-ui';

class ServerPersistenceAdapter implements PersistenceAdapter {
  async load(key: string): Promise<DockLayout | null> {
    const res = await fetch(`/api/layouts/${key}`);
    return res.ok ? res.json() : null;
  }

  async save(key: string, layout: DockLayout): Promise<void> {
    await fetch(`/api/layouts/${key}`, {
      method: 'PUT',
      body: JSON.stringify(layout),
    });
  }
}

const provider = document.querySelector('nc-provider');
provider.config = {
  templateApiUrl: '/api/templates',
  persistenceAdapter: new ServerPersistenceAdapter(),
};
```

---

## Design mode

Enable in-browser template editing for power users:

```html
<nc-dock design-mode layout-key="dashboard"></nc-dock>
```

With `design-mode` set, each widget shows an editor (CodeMirror) that lets users write Lit template strings with live preview. Saving POSTs the source to `templateApiUrl`, receives a compiled ES module URL, and hot-reloads the widget.

> Design mode requires `templateApiUrl` to be configured. The server must compile the template source and return `{ moduleUrl: string }`.

---

## Token reference

### Widget-level (all components)

| Token | Default | Description |
|-------|---------|-------------|
| `--nc-widget-bg` | `var(--nc-surface)` | Widget background |
| `--nc-widget-border` | `1px solid var(--nc-border)` | Widget border |
| `--nc-widget-radius` | `var(--nc-radius-md)` | Widget corner radius |
| `--nc-widget-shadow` | `var(--nc-shadow-sm)` | Widget drop shadow |
| `--nc-widget-padding` | `var(--nc-space-4)` | Widget internal padding |

### `<nc-kpi>`

| Token | Default | Description |
|-------|---------|-------------|
| `--nc-kpi-value-color` | `var(--nc-color-primary)` | Metric value color |
| `--nc-kpi-value-size` | `var(--nc-text-4xl)` | Metric value font size |
| `--nc-kpi-label-color` | `var(--nc-text-secondary)` | Label text color |
| `--nc-kpi-trend-up-color` | `var(--nc-color-success)` | Positive trend color |
| `--nc-kpi-trend-down-color` | `var(--nc-color-error)` | Negative trend color |

### `<nc-markdown>`

| Token | Default | Description |
|-------|---------|-------------|
| `--nc-md-heading-color` | `var(--nc-text-primary)` | Heading color |
| `--nc-md-link-color` | `var(--nc-color-primary)` | Link color |
| `--nc-md-code-bg` | `var(--nc-color-primary-muted)` | Inline code background |
| `--nc-md-blockquote-border` | `var(--nc-color-primary)` | Blockquote left border |

### `<nc-dock>`

| Token | Default | Description |
|-------|---------|-------------|
| `--nc-dock-tab-bg` | `var(--nc-surface-overlay)` | Inactive tab background |
| `--nc-dock-tab-active-bg` | `var(--nc-surface)` | Active tab background |
| `--nc-dock-tab-active-line` | `var(--nc-color-primary)` | Active tab indicator |
| `--nc-dock-sash-color` | `var(--nc-border)` | Panel resize handle color |
| `--nc-dock-sash-hover` | `var(--nc-color-primary)` | Resize handle on hover |

---

## Browser support

Requires browsers that support:
- CSS `oklch()` relative color syntax (`from <origin>`) — Chrome 119+, Firefox 128+, Safari 16.4+
- Web Components (Custom Elements v1, Shadow DOM v1) — all modern browsers
- Dynamic `import()` — all modern browsers

---

## Contributing / local dev

```bash
git clone <repo>
cd nascacht.ui
npm install
npx playwright install chromium   # one-time, for tests
npm run storybook                  # explore components at http://localhost:6006
npm run typecheck                  # must pass before committing
npm test                           # unit tests in real Chromium
```

See `CLAUDE.md` for architecture details, naming conventions, and implementation notes.
