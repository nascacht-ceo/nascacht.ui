import { defineConfig, devices } from '@playwright/test';

const isCI = !!process.env.CI;

export default defineConfig({
  testDir: './src',
  testMatch: '**/*.e2e.ts',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,

  // CI: github reporter adds inline PR annotations; junit feeds the Actions
  // summary panel; html gives a downloadable full report for debugging.
  // Dev: html only (opens automatically on failure).
  reporter: isCI
    ? [
        ['github'],
        ['junit', { outputFile: 'test-results/junit.xml' }],
        ['html',  { open: 'never', outputFolder: 'playwright-report' }],
      ]
    : [['html', { open: 'on-failure' }]],

  use: {
    baseURL: 'http://localhost:6006',
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: isCI
    ? {
        // CI: serve the pre-built static output — faster and more stable than
        // starting the Vite dev server.  The build:storybook step in the workflow
        // must run before the tests step.
        command: 'npx http-server storybook-static -p 6006 --silent',
        url: 'http://localhost:6006',
        reuseExistingServer: false,
      }
    : {
        command: 'npm run storybook',
        url: 'http://localhost:6006',
        reuseExistingServer: true,
      },
});
