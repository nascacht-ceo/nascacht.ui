import type { Meta, StoryObj } from '@storybook/web-components';
import { html } from 'lit';
import '../dock/nascacht-dock.js';
import '../widgets/nascacht-kpi.js';
import '../widgets/nascacht-markdown.js';
import type { DockLayout } from '../types.js';

const meta: Meta = {
  title: 'Dock/nc-dock',
  component: 'nc-dock',
};

export default meta;
type Story = StoryObj;

// ── Layouts ────────────────────────────────────────────────────────────────

const summaryMarkdown = `## Q2 Summary

Revenue grew **18%** year-over-year driven by enterprise expansion.

- New contracts: **42**
- Avg deal size: $28K
- Pipeline: up 40% vs Q1

> Strong momentum heading into Q3.
`;

const mixedLayout: DockLayout = {
  version: 1,
  root: {
    id: 'root',
    direction: 'horizontal',
    panels: [
      { id: 'revenue', widgetType: 'kpi',      title: 'Revenue',      visible: true, config: { label: 'Revenue',      value: '$1.2M',  trend: '+18%'  } },
      { id: 'churn',   widgetType: 'kpi',      title: 'Churn Rate',   visible: true, config: { label: 'Churn Rate',   value: '4.2%',   trend: '-0.8%' } },
      { id: 'users',   widgetType: 'kpi',      title: 'Active Users', visible: true, config: { label: 'Active Users', value: '4,821',  trend: '+3%'   } },
      { id: 'summary', widgetType: 'markdown', title: 'Summary',      visible: true, config: { content: summaryMarkdown } },
    ],
  },
};

const kpiOnlyLayout: DockLayout = {
  version: 1,
  root: {
    id: 'root',
    direction: 'horizontal',
    panels: [
      { id: 'k1', widgetType: 'kpi', title: 'Revenue',      visible: true, config: { label: 'Revenue',      value: '$1.2M',  trend: '+18%'  } },
      { id: 'k2', widgetType: 'kpi', title: 'MRR',          visible: true, config: { label: 'MRR',          value: '$98K',   trend: '+5%'   } },
      { id: 'k3', widgetType: 'kpi', title: 'Churn Rate',   visible: true, config: { label: 'Churn Rate',   value: '4.2%',   trend: '-0.8%' } },
      { id: 'k4', widgetType: 'kpi', title: 'NPS',          visible: true, config: { label: 'NPS',          value: '68',     trend: '+4'    } },
      { id: 'k5', widgetType: 'kpi', title: 'Active Users', visible: true, config: { label: 'Active Users', value: '4,821',  trend: '+3%'   } },
    ],
  },
};

// ── Stories ────────────────────────────────────────────────────────────────

/**
 * Seeds localStorage before the story renders so nc-dock picks up the layout
 * on initialisation. Each story uses a unique layout-key to avoid cross-story
 * interference from persisted drag-rearrangements.
 */

export const Default: Story = {
  name: 'KPI + Markdown',
  loaders: [
    async () => {
      localStorage.setItem('nc-story-dock-mixed', JSON.stringify(mixedLayout));
      return {};
    },
  ],
  render: () => html`
    <nc-dock
      layout-key="nc-story-dock-mixed"
      style="height: 480px"
    ></nc-dock>
  `,
};

export const KpiDashboard: Story = {
  name: 'KPI dashboard',
  loaders: [
    async () => {
      localStorage.setItem('nc-story-dock-kpis', JSON.stringify(kpiOnlyLayout));
      return {};
    },
  ],
  render: () => html`
    <nc-dock
      layout-key="nc-story-dock-kpis"
      style="height: 480px"
    ></nc-dock>
  `,
};

export const Empty: Story = {
  name: 'Empty (no layout)',
  loaders: [
    async () => {
      localStorage.removeItem('nc-story-dock-empty');
      return {};
    },
  ],
  render: () => html`
    <nc-dock
      layout-key="nc-story-dock-empty"
      style="height: 480px"
    ></nc-dock>
  `,
};
