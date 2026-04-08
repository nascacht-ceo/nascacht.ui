import type { Meta, StoryObj } from '@storybook/web-components';
import { html } from 'lit';
import '../editor/nc-theme-editor.js';
import '../widgets/nc-kpi.js';
import '../widgets/nc-markdown.js';

const meta: Meta = {
  title: 'Editor/nc-theme-editor',
  component: 'nc-theme-editor',
};

export default meta;
type Story = StoryObj;

const previewMarkdown = `## Theme Preview

Adjust the controls on the left to see changes applied **live**.

> Saved themes persist to \`localStorage\` and can be exported as CSS.
`;

export const Default: Story = {
  render: () => html`
    <nc-theme-editor theme-name="my-theme" style="height: 560px">
      <nc-kpi label="Revenue"    value="$1.2M"  trend="+12%"></nc-kpi>
      <nc-kpi label="Churn Rate" value="4.2%"   trend="-0.8%"></nc-kpi>
      <nc-markdown .content=${previewMarkdown}></nc-markdown>
    </nc-theme-editor>
  `,
};

export const DarkStart: Story = {
  name: 'Starting dark',
  render: () => html`
    <nc-theme-editor theme-name="dark-theme" style="height: 560px">
      <nc-kpi label="Active Users" value="4,821" trend="+3%"></nc-kpi>
      <nc-markdown .content=${previewMarkdown}></nc-markdown>
    </nc-theme-editor>
  `,
  play: async ({ canvasElement }) => {
    // Pre-set to dark surface for this story
    const editor = canvasElement.querySelector('nc-theme-editor') as HTMLElement & { _s: unknown };
    // Seed dark theme via localStorage so the editor loads it
    localStorage.setItem('nc-theme-dark-theme', JSON.stringify({
      brandH: 240, brandC: 0.20, brandL: 0.62,
      surfaceL: 0.12,
      radiusPx: 4, spacePx: 4,
      fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
      fontSizeRem: 1,
    }));
    editor.setAttribute('theme-name', 'dark-theme');
  },
};
