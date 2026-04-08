import { html } from 'lit';
import type { LitElement, TemplateResult } from 'lit';
import type { TemplateFunction } from '../types.js';

/**
 * Compiles a raw template string into a TemplateFunction using new Function.
 *
 * ONLY used in design mode — never in production render paths.
 * Gated by the `design-mode` attribute on <nc-dock>.
 *
 * The generated function receives:
 *   - `component`: the widget element (LitElement)
 *   - `html`: Lit's tagged template literal
 *
 * Example template string:
 *   return html`<div>${component.label}</div>`;
 */
export type CompileResult =
  | { ok: true; fn: TemplateFunction }
  | { ok: false; error: string };

export function compileTemplate(source: string): CompileResult {
  try {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const fn = new Function(
      'component',
      'html',
      source
    ) as (component: LitElement, html: typeof import('lit').html) => TemplateResult;

    // Wrap so callers only pass `component`; html is always the Lit html tag.
    const wrapped: TemplateFunction = (component) => fn(component, html);

    return { ok: true, fn: wrapped };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

/**
 * Evaluates a compiled TemplateFunction with runtime error isolation.
 * Returns a fallback error TemplateResult rather than throwing.
 */
export function safeRender(
  fn: TemplateFunction,
  component: LitElement
): TemplateResult {
  try {
    return fn(component);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return html`<pre style="color:var(--nc-color-error,red);white-space:pre-wrap"
      >Runtime error: ${message}</pre
    >`;
  }
}
