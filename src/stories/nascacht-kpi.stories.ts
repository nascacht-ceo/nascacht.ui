import type { Meta, StoryObj } from '@storybook/web-components';
import { html } from 'lit';
import '../widgets/nc-kpi.js';

const meta: Meta = {
  title: 'Widgets/nc-kpi',
  component: 'nc-kpi',
  argTypes: {
    label: { control: 'text' },
    value: { control: 'text' },
    trend: { control: 'text' },
  },
};

export default meta;
type Story = StoryObj;

// Default — no inline theme; inherits from the Storybook decorator wrapper
export const Default: Story = {
  args: { label: 'Revenue', value: '$1.2M', trend: '+12%' },
  render: ({ label, value, trend }) =>
    html`<nc-kpi label=${label} value=${value} trend=${trend}></nc-kpi>`,
};

export const NoTrend: Story = {
  args: { label: 'Pending Orders', value: '147' },
  render: ({ label, value }) =>
    html`<nc-kpi label=${label} value=${value}></nc-kpi>`,
};

export const TrendDown: Story = {
  args: { label: 'Churn Rate', value: '4.2%', trend: '-0.8%' },
  render: ({ label, value, trend }) =>
    html`<nc-kpi label=${label} value=${value} trend=${trend}></nc-kpi>`,
};

// Component-token override — green value for a profit metric
export const CustomValueColor: Story = {
  name: 'Custom: green value',
  args: { label: 'Net Profit', value: '$340K', trend: '+22%' },
  render: ({ label, value, trend }) =>
    html`<nc-kpi
      label=${label} value=${value} trend=${trend}
      style="--nc-kpi-value-color: var(--nc-color-success)"
    ></nc-kpi>`,
};

// Fallback state
export const FallbackState: Story = {
  name: 'Fallback (unavailable)',
  args: { label: 'Unavailable Metric', value: '' },
  render: ({ label }) =>
    html`<nc-kpi label=${label} value="—"></nc-kpi>`,
};
