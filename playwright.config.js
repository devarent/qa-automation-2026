'use strict';

const { defineConfig, devices } = require('@playwright/test');

const externalBaseURL = process.env.BASE_URL;
const baseURL = externalBaseURL || 'http://127.0.0.1:3100';
const port = new URL(baseURL).port || '3100';

module.exports = defineConfig({
  testDir: './tests',
  outputDir: 'test-results/artifacts',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 30_000,
  expect: {
    timeout: 7_000,
  },
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
  ],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
  },
  projects: [
    {
      name: 'api',
      testMatch: /tests[\\/]api[\\/].*\.spec\.js/,
      use: {
        baseURL,
      },
    },
    {
      name: 'e2e',
      testMatch: /tests[\\/]e2e[\\/].*\.spec\.js/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL,
      },
    },
  ],
  webServer: externalBaseURL
    ? undefined
    : {
        command: 'node app/server.js',
        url: `${baseURL}/api/health`,
        reuseExistingServer: !process.env.CI,
        timeout: 30_000,
        env: {
          PORT: port,
          HOST: '127.0.0.1',
          NODE_ENV: 'test',
        },
      },
});
