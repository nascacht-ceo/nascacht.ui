import { defineConfig } from 'tsup';

export default defineConfig([
  // ESM + CJS tree-shakeable build (Lit/DockView as peer deps)
  // For consumers who bundle their own app (webpack, Rollup, Vite, etc.)
  {
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    external: ['lit', '@lit/context', 'dockview-core'],
    sourcemap: true,
    outDir: 'dist/esm',
    clean: true,
    splitting: true,
    treeshake: true,
  },
  // Pre-bundled ESM + IIFE (Lit included)
  // For CDN / <script type="module"> consumers with no build step
  // NOTE: consumers who use Lit in their own app will have two Lit instances;
  // @lit/context propagation between their app and nascacht-ui elements will fail.
  // Document this in the integration guide and recommend the ESM build for Lit users.
  {
    entry: ['src/index.ts'],
    format: ['esm', 'iife'],
    globalName: 'Nascacht',
    bundle: true,
    minify: true,
    sourcemap: true,
    outDir: 'dist/bundle',
  },
]);
