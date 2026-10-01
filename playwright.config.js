import { defineConfig } from '@playwright/test';

const configuredHost = process.env.REPLIT_DEV_DOMAIN;
const baseURL = configuredHost
  ? (/^https?:\/\//.test(configuredHost) ? configuredHost : `https://${configuredHost}`)
  : 'http://127.0.0.1:5000';

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.js',
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  use: {
    baseURL,
    browserName: 'chromium',
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || '/repl/tools/bin/chromium',
      args: ['--no-sandbox'],
    },
    headless: true,
    trace: 'retain-on-failure',
  },
});