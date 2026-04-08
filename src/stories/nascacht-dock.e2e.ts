import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

// ── Token resolution ──────────────────────────────────────────────────────────

/**
 * Resolve one or more CSS custom property tokens to their computed px values
 * by probing a temporary element in the Storybook page context.
 *
 * Works for any token reachable from document.body (i.e. defined on :root or
 * [data-nc-theme], which is the Storybook decorator wrapper).
 *
 * Returns a map of { tokenName → computedValue }, e.g. { '--nc-radius-md': '8px' }.
 */
async function resolveTokens(
  page: Page,
  tokens: string[],
): Promise<Record<string, string>> {
  return page.evaluate((names: string[]) => {
    const probe = document.createElement('div');
    document.body.appendChild(probe);
    const result: Record<string, string> = {};
    for (const name of names) {
      probe.style.borderTopLeftRadius = `var(${name})`;
      result[name] = getComputedStyle(probe).borderTopLeftRadius;
      probe.style.borderTopLeftRadius = '';
    }
    probe.remove();
    return result;
  }, tokens);
}

// ── Shadow DOM helpers ────────────────────────────────────────────────────────

type CornerRadii = { tl: string; tr: string; br: string; bl: string };

/**
 * Read the four border-radius longhands of an element inside nc-dock's shadow
 * root.  Works for DockView elements (.dv-*) and widget custom elements (nc-kpi
 * etc.) whose :host styles are reflected in getComputedStyle from outside.
 */
function dockShadowRadii(page: Page, selector: string): Promise<CornerRadii> {
  return page.evaluate((sel: string) => {
    const el = document.querySelector('nc-dock')?.shadowRoot?.querySelector(sel);
    if (!el) throw new Error(`selector not found in nc-dock shadow root: ${sel}`);
    const s = getComputedStyle(el);
    return {
      tl: s.borderTopLeftRadius,
      tr: s.borderTopRightRadius,
      br: s.borderBottomRightRadius,
      bl: s.borderBottomLeftRadius,
    };
  }, selector);
}

function dockShadowProp(page: Page, selector: string, prop: string): Promise<string> {
  return page.evaluate(
    ([sel, p]: [string, string]) => {
      const el = document.querySelector('nc-dock')?.shadowRoot?.querySelector(sel);
      if (!el) throw new Error(`selector not found: ${sel}`);
      return getComputedStyle(el).getPropertyValue(p);
    },
    [selector, prop],
  );
}

async function waitForDockView(page: Page): Promise<void> {
  await page.waitForFunction(
    () => !!document.querySelector('nc-dock')?.shadowRoot?.querySelector('.dv-tab'),
    { timeout: 15_000 },
  );
}

// ── nc-dock CSS tests ─────────────────────────────────────────────────────────

test.describe('nc-dock — tab and panel corner shaping', () => {
  // Resolved once per test; reflects whatever the theme actually computes.
  let md: string;   // --nc-radius-md  (group panel, content container)
  let sm: string;   // --nc-radius-sm  (individual tab chips)

  test.beforeEach(async ({ page }) => {
    await page.goto('/iframe.html?id=dock-nc-dock--kpi-dashboard&viewMode=story');
    await waitForDockView(page);

    const resolved = await resolveTokens(page, ['--nc-radius-md', '--nc-radius-sm']);
    md = resolved['--nc-radius-md'];
    sm = resolved['--nc-radius-sm'];
  });

  // ── Group panel ─────────────────────────────────────────────────────────────

  test('group panel (.dv-groupview) has fully rounded corners (--nc-radius-md)', async ({ page }) => {
    const r = await dockShadowRadii(page, '.dv-groupview');
    expect(r.tl, 'top-left').toBe(md);
    expect(r.tr, 'top-right').toBe(md);
    expect(r.br, 'bottom-right').toBe(md);
    expect(r.bl, 'bottom-left').toBe(md);
  });

  // ── Content container ───────────────────────────────────────────────────────

  test('content container has square top-left, rounded elsewhere (--nc-radius-md)', async ({ page }) => {
    const r = await dockShadowRadii(page, '.dv-content-container');
    expect(r.tl, 'top-left').toBe('0px');
    expect(r.tr, 'top-right').toBe(md);
    expect(r.br, 'bottom-right').toBe(md);
    expect(r.bl, 'bottom-left').toBe(md);
  });

  // ── Individual tabs ─────────────────────────────────────────────────────────

  test('first tab has both top corners rounded (--nc-radius-sm)', async ({ page }) => {
    const r = await dockShadowRadii(page, '.dv-tabs-container .dv-tab:first-child');
    expect(r.tl, 'top-left').toBe(sm);
    expect(r.tr, 'top-right').toBe(sm);
    expect(r.bl, 'bottom-left').toBe('0px');
    expect(r.br, 'bottom-right').toBe('0px');
  });

  test('non-first tabs have only top-right corner rounded (--nc-radius-sm)', async ({ page }) => {
    const r = await dockShadowRadii(page, '.dv-tabs-container .dv-tab:nth-child(2)');
    expect(r.tl, 'top-left').toBe('0px');
    expect(r.tr, 'top-right').toBe(sm);
    expect(r.bl, 'bottom-left').toBe('0px');
    expect(r.br, 'bottom-right').toBe('0px');
  });

  test('active tab has a 2px solid bottom border indicator', async ({ page }) => {
    // 2px is an explicit design constant in the injected tab styles, not a theme
    // token, so it is intentionally asserted as a literal here.
    const style = await page.evaluate(() => {
      const el = document.querySelector('nc-dock')
        ?.shadowRoot?.querySelector('.dv-tab.dv-active-tab');
      if (!el) throw new Error('.dv-active-tab not found');
      const s = getComputedStyle(el);
      return { width: s.borderBottomWidth, style: s.borderBottomStyle };
    });
    expect(style.width, 'border-bottom-width').toBe('2px');
    expect(style.style, 'border-bottom-style').toBe('solid');
  });

  // ── Typography ──────────────────────────────────────────────────────────────

  test('tabs use --nc-font-family', async ({ page }) => {
    // Resolve the token to its actual computed string, then compare.
    const expected = await page.evaluate(() => {
      const probe = document.createElement('div');
      document.body.appendChild(probe);
      probe.style.fontFamily = 'var(--nc-font-family)';
      const v = getComputedStyle(probe).fontFamily;
      probe.remove();
      return v;
    });
    const actual = await dockShadowProp(page, '.dv-tab', 'font-family');
    expect(actual).toBe(expected);
  });

  // ── Widget radius inside dock ────────────────────────────────────────────────

  test('nc-kpi inside dock has flat top, rounded bottom (--nc-widget-radius override)', async ({ page }) => {
    const r = await dockShadowRadii(page, 'nc-kpi');
    expect(r.tl, 'top-left').toBe('0px');
    expect(r.tr, 'top-right').toBe('0px');
    expect(r.bl, 'bottom-left').toBe(md);
    expect(r.br, 'bottom-right').toBe(md);
  });
});

// ── Standalone widget ─────────────────────────────────────────────────────────

test.describe('nc-kpi standalone — full rounding preserved outside dock', () => {
  let md: string;

  test.beforeEach(async ({ page }) => {
    await page.goto('/iframe.html?id=widgets-nc-kpi--default&viewMode=story');
    await page.waitForSelector('nc-kpi');
    const resolved = await resolveTokens(page, ['--nc-radius-md']);
    md = resolved['--nc-radius-md'];
  });

  test('all four corners equal --nc-radius-md', async ({ page }) => {
    const r = await page.evaluate(() => {
      const el = document.querySelector('nc-kpi');
      if (!el) throw new Error('nc-kpi not found');
      const s = getComputedStyle(el);
      return {
        tl: s.borderTopLeftRadius,
        tr: s.borderTopRightRadius,
        br: s.borderBottomRightRadius,
        bl: s.borderBottomLeftRadius,
      };
    });
    expect(r.tl, 'top-left').toBe(md);
    expect(r.tr, 'top-right').toBe(md);
    expect(r.br, 'bottom-right').toBe(md);
    expect(r.bl, 'bottom-left').toBe(md);
  });
});
