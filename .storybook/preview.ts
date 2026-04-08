import type { Preview } from '@storybook/web-components';
import { html, nothing } from 'lit';
import '../src/styles/themes/light.css';  // seeds on :root + derived tokens on :root,[data-nc-theme]
import '../src/styles/themes/dark.css';   // seeds on [data-nc-theme="dark"]

/*
 * Theme switching works via the data-nc-theme attribute.
 *
 * tokens.css targets `:root, [data-nc-theme]` — so when we put data-nc-theme
 * on the decorator wrapper, ALL derived tokens (--nc-surface, --nc-text-primary,
 * etc.) are computed ON that wrapper using its own seed values. The KPI and
 * other widgets inherit the resolved tokens from their nearest [data-nc-theme]
 * ancestor, not from :root.
 *
 * Without data-nc-theme on the wrapper, derived tokens only exist on :root
 * (with light values), and overriding seed vars on a plain div has no effect
 * on the derived tokens that components actually use.
 */

const themes: Record<string, { attr: string; seeds: string }> = {
  light: { attr: 'light', seeds: '' },
  dark:  { attr: 'dark',  seeds: '' },
  // Custom themes: use light seeds, override only the brand hue
  teal:  { attr: 'light', seeds: '--nc-brand: oklch(52% 0.18 185)' },
  rose:  { attr: 'light', seeds: '--nc-brand: oklch(52% 0.22 10)'  },
};

const preview: Preview = {
  globalTypes: {
    theme: {
      description: 'Global theme',
      defaultValue: 'light',
      toolbar: {
        title: 'Theme',
        icon: 'paintbrush',
        items: [
          { value: 'light', title: 'Light' },
          { value: 'dark',  title: 'Dark' },
          { value: 'teal',  title: 'Custom: Teal' },
          { value: 'rose',  title: 'Custom: Rose' },
        ],
        dynamicTitle: true,
      },
    },
  },
  decorators: [
    (story, context) => {
      const key = (context.globals['theme'] as string) ?? 'light';
      const { attr, seeds } = themes[key] ?? themes['light'];

      // background uses var(--nc-surface) so it also responds to the theme
      const style = [seeds, 'padding: 2rem; background: var(--nc-surface); min-height: 100vh'].
        filter(Boolean).join('; ');

      return html`
        <div data-nc-theme=${attr} style=${style}>
          ${story()}
        </div>
      `;
    },
  ],
  parameters: {
    backgrounds: { disable: true },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    a11y: {
      config: {
        rules: [{ id: 'color-contrast', enabled: true }],
      },
    },
  },
};

export default preview;
