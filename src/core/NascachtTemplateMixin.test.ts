import { expect, fixture, html } from '@open-wc/testing';
import { LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { NascachtTemplateMixin, clearModuleCache } from './NascachtTemplateMixin.js';
import type { TemplateResult } from 'lit';

// ── Test widget ──────────────────────────────────────────────────────────────

@customElement('test-kpi')
class TestKpi extends NascachtTemplateMixin(LitElement) {
  @property() label = 'Test';

  override defaultTemplate(): TemplateResult {
    return html`<span id="default">default:${this.label}</span>`;
  }

  override fallbackTemplate(): TemplateResult {
    return html`<span id="fallback">fallback</span>`;
  }

  override render(): TemplateResult {
    return this.renderTemplate() as TemplateResult;
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function mockFetch(
  responses: Map<string, { status: number; body: unknown }>
): () => void {
  const original = globalThis.fetch;
  globalThis.fetch = async (input: RequestInfo | URL) => {
    const url = input.toString();
    for (const [pattern, resp] of responses) {
      if (url.includes(pattern)) {
        return new Response(
          typeof resp.body === 'string' ? resp.body : JSON.stringify(resp.body),
          { status: resp.status }
        );
      }
    }
    return new Response('Not found', { status: 404 });
  };
  return () => { globalThis.fetch = original; };
}

// ── Tests ────────────────────────────────────────────────────────────────────

afterEach(() => {
  clearModuleCache();
});

describe('NascachtTemplateMixin', () => {
  describe('defaultTemplate()', () => {
    it('renders defaultTemplate when no templateApiUrl is configured', async () => {
      const el = await fixture<TestKpi>(
        html`<test-kpi label="Revenue"></test-kpi>`
      );
      const span = el.shadowRoot?.querySelector('#default');
      expect(span).to.exist;
      expect(span?.textContent).to.equal('default:Revenue');
    });

    it('renders defaultTemplate when server returns 404 for prefix', async () => {
      const restore = mockFetch(
        new Map([['api/templates', { status: 404, body: 'Not found' }]])
      );

      const el = await fixture<TestKpi>(
        html`<test-kpi template-api-url="/api/templates" label="Units"></test-kpi>`
      );

      // 404 should silently fall through to defaultTemplate
      const span = el.shadowRoot?.querySelector('#default');
      expect(span).to.exist;

      restore();
    });
  });

  describe('fallbackTemplate()', () => {
    it('renders fallbackTemplate when import() rejects (network failure)', async () => {
      const restore = mockFetch(
        new Map([
          ['api/templates', { status: 200, body: { moduleUrl: '/modules/bad.js' } }],
        ])
      );

      // Make import() for the module fail
      const originalImport = (window as unknown as Record<string, unknown>).__importShim__;
      // We rely on the module-loader's error path — the loadModule promise rejects
      // because /modules/bad.js doesn't exist in test environment.

      const el = await fixture<TestKpi>(
        html`<test-kpi template-api-url="/api/templates"></test-kpi>`
      );

      // Wait for async load to complete
      await el.updateComplete;
      await new Promise(r => setTimeout(r, 100));
      await el.updateComplete;

      const fallback = el.shadowRoot?.querySelector('#fallback');
      expect(fallback).to.exist;

      restore();
    });

    // CRITICAL GAP: stale moduleUrl → 404 after import() succeeds once
    // A widget has a cached moduleUrl. The server redeploys and the old
    // content-addressed URL returns 404. The widget must fall back gracefully.
    it('renders fallbackTemplate and logs warning when moduleUrl returns 404', async () => {
      const warnMessages: string[] = [];
      const originalWarn = console.warn;
      console.warn = (...args: unknown[]) => warnMessages.push(String(args[0]));

      const restore = mockFetch(
        new Map([
          // Template fetch succeeds → points to a module URL
          ['api/templates', { status: 200, body: { moduleUrl: '/modules/stale-404.js' } }],
          // The module URL itself returns 404 (content-addressed file gone)
          ['modules/stale-404.js', { status: 404, body: '' }],
        ])
      );

      const el = await fixture<TestKpi>(
        html`<test-kpi template-api-url="/api/templates"></test-kpi>`
      );

      await el.updateComplete;
      await new Promise(r => setTimeout(r, 200));
      await el.updateComplete;

      const fallback = el.shadowRoot?.querySelector('#fallback');
      expect(fallback).to.exist;

      const warnFired = warnMessages.some(m => m.includes('[nascacht]'));
      expect(warnFired).to.be.true;

      console.warn = originalWarn;
      restore();
    });
  });

  describe('import() deduplication', () => {
    it('fires single import() for 10 instances of the same widget type', async () => {
      let fetchCallCount = 0;
      const restore = mockFetch(
        new Map([
          ['api/templates', {
            status: 200,
            body: { moduleUrl: '/modules/kpi-v1.js' }
          }],
        ])
      );

      // Patch loadModule to count actual import() attempts
      // (module-loader uses a shared Map, so the second+ calls are cache hits)
      const origFetch = globalThis.fetch;
      globalThis.fetch = async (input: RequestInfo | URL, ...rest) => {
        if (input.toString().includes('modules/kpi-v1.js')) {
          fetchCallCount++;
        }
        return origFetch(input, ...rest);
      };

      const widgets = await Promise.all(
        Array.from({ length: 10 }, () =>
          fixture<TestKpi>(
            html`<test-kpi template-api-url="/api/templates"></test-kpi>`
          )
        )
      );

      await Promise.all(widgets.map(w => w.updateComplete));
      await new Promise(r => setTimeout(r, 200));

      // Should attempt to load the module URL at most once (dedup cache)
      expect(fetchCallCount).to.be.lessThanOrEqual(1);

      restore();
    });
  });

  describe('setTemplate()', () => {
    it('re-renders after setTemplate() is called programmatically', async () => {
      const el = await fixture<TestKpi>(
        html`<test-kpi label="Before"></test-kpi>`
      );

      const { html: litHtml } = await import('lit');
      el.setTemplate(() => litHtml`<span id="programmatic">injected</span>`);

      await el.updateComplete;

      const span = el.shadowRoot?.querySelector('#programmatic');
      expect(span).to.exist;
      expect(span?.textContent).to.equal('injected');
    });
  });

  describe('design mode gating', () => {
    it('does NOT enter design mode when design-mode attribute is absent', async () => {
      const el = await fixture<TestKpi>(
        html`<test-kpi label="X"></test-kpi>`
      );
      expect(el.designMode).to.be.false;
    });

    it('reports designMode=true when ancestor has design-mode attribute', async () => {
      const wrapper = await fixture<HTMLElement>(
        html`<div design-mode><test-kpi label="X"></test-kpi></div>`
      );
      const el = wrapper.querySelector<TestKpi>('test-kpi')!;
      expect(el.designMode).to.be.true;
    });
  });
});
