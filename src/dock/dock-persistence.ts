import type { DockLayout, PersistenceAdapter } from '../types.js';

/**
 * Default PersistenceAdapter backed by localStorage.
 *
 * Suitable for single-user browser sessions. For multi-user or server-side
 * persistence, provide a custom PersistenceAdapter via <nc-provider>.
 */
export class LocalStoragePersistenceAdapter implements PersistenceAdapter {
  async load(key: string): Promise<DockLayout | null> {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      return JSON.parse(raw) as DockLayout;
    } catch {
      return null;
    }
  }

  async save(key: string, layout: DockLayout): Promise<void> {
    try {
      localStorage.setItem(key, JSON.stringify(layout));
    } catch {
      // Storage full or unavailable — fail silently.
      console.warn('[nascacht] Failed to persist layout to localStorage');
    }
  }
}
