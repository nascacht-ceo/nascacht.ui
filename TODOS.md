# TODOS

## Chart library spike
**What:** Evaluate uPlot vs Observable Plot (and briefly Chart.js / Apache ECharts) for nc-chart.
**Why:** Bundle size and capability tradeoffs must be resolved before v1.1 implementation begins. The wrong choice means a breaking change later.
**Pros:** Unblocks nc-chart design; ensures the right size/capability tradeoff for an embeddable library.
**Cons:** Takes a focused spike session before v1.1 starts.
**Context:** nc-chart is v1.1 scope. The spike should benchmark: minified+gzip bundle size, tree-shaking support, web component compatibility (no React dependency), and whether the library renders into a shadow DOM container. uPlot is ~14KB and extremely fast; Observable Plot is D3-based and more expressive but larger (~50KB). Chart.js is familiar but heavy (~60KB). Apache ECharts is feature-rich but very large.
**Depends on:** Nothing — can be done independently before v1.1 begins.

---

## CSP configuration guide
**What:** Document `Content-Security-Policy` requirements for consumers who use design mode and dynamic `import()` of server-compiled template modules.
**Why:** Dynamic `import()` of cross-origin or same-origin modules is blocked by default CSP in many production environments (Azure Static Web Apps, Vercel, strict enterprise setups). Without this guide, consumers will hit a silent runtime blocker.
**Pros:** Eliminates a deployment blocker for every consumer who uses design mode. One doc prevents many support issues.
**Cons:** None — pure documentation work.
**Context:** The required CSP addition is `script-src 'self' <template-module-origin>`. For same-origin deployments: `script-src 'self'` is already sufficient. For cross-origin module hosting: consumers must add the host origin explicitly. Content-addressed module URLs (`/template/module/{prefix}/{type}/{hash}.js`) should also have `Cache-Control: immutable` set server-side. Write this as an integration guide section in the README or dedicated docs page.
**Depends on:** Node.js server reference implementation (to show a working example).
