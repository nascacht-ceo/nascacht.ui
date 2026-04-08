import type { TemplateFunction } from '../types.js';

/**
 * Deduplication cache for dynamic module imports.
 *
 * Problem: a dashboard with 10 identical KPI widgets would fire 10 concurrent
 * import() calls to the same URL without this cache.
 *
 * Map key: module URL (content-addressed, so same content = same key)
 * Map value: in-flight or resolved Promise<TemplateFunction>
 *
 *   Request 1 ──► import(url) ──► Promise (in-flight)
 *   Request 2 ──► cache hit   ──► same Promise
 *   ...
 *   Request N ──► cache hit   ──► same Promise
 *                                      │
 *                                      └─► all resolve to same TemplateFunction
 */
const importCache = new Map<string, Promise<TemplateFunction>>();

export function loadModule(url: string): Promise<TemplateFunction> {
  const cached = importCache.get(url);
  if (cached) return cached;

  const promise = import(/* @vite-ignore */ url)
    .then((mod: { default?: TemplateFunction }) => {
      if (typeof mod.default !== 'function') {
        throw new Error(`nascacht: module at ${url} has no default export`);
      }
      return mod.default;
    })
    .catch((err: unknown) => {
      // Remove from cache on failure so a retry attempt can re-fetch.
      importCache.delete(url);
      throw err;
    });

  importCache.set(url, promise);
  return promise;
}

/** Exposed for testing: clear the dedup cache between test cases. */
export function clearModuleCache(): void {
  importCache.clear();
}
