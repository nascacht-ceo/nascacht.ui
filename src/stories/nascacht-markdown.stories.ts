import type { Meta, StoryObj } from '@storybook/web-components';
import { html } from 'lit';
import '../widgets/nascacht-markdown.js';

const meta: Meta = {
  title: 'Widgets/nc-markdown',
  component: 'nc-markdown',
  argTypes: {
    content: { control: 'text' },
  },
};

export default meta;
type Story = StoryObj;

const sampleMarkdown = `## Quarterly Summary

Revenue grew **12%** year-over-year, driven by increased enterprise adoption.

- New contracts: 42
- Churn rate: 2.1%
- NPS: 68

> Strong momentum heading into Q3 — pipeline is up 40%.

Key risks: [see full report](#). Inline \`metric\` references are highlighted.
`;

const codeMarkdown = `### Template example

\`\`\`js
return html\`
  <div class="value">\${component.value}</div>
\`;
\`\`\`

Use \`component\` to access widget properties inside a template.
`;

// Default — inherits theme from the Storybook decorator wrapper
export const Default: Story = {
  args: { content: sampleMarkdown },
  render: ({ content }) =>
    html`<nc-markdown .content=${content}></nc-markdown>`,
};

export const WithCode: Story = {
  name: 'With code blocks',
  args: { content: codeMarkdown },
  render: ({ content }) =>
    html`<nc-markdown .content=${content}></nc-markdown>`,
};

// Component-token override — custom link and heading colors
export const CustomHeadingColor: Story = {
  name: 'Custom: accent headings',
  args: { content: sampleMarkdown },
  render: ({ content }) =>
    html`<nc-markdown
      .content=${content}
      style="--nc-md-heading-color: var(--nc-color-accent); --nc-md-link-color: var(--nc-color-secondary)"
    ></nc-markdown>`,
};
