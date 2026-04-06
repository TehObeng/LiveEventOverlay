import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';
import nextEnv from '@next/env';

const { loadEnvConfig } = nextEnv;

const projectDir = process.cwd();
loadEnvConfig(projectDir);

const appBaseURL =
  process.env.PLAYWRIGHT_BASE_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  'http://127.0.0.1:3000';

const baseURL = appBaseURL.replace(/\/$/, '');

const webServerCommand =
  process.env.PLAYWRIGHT_WEB_SERVER_COMMAND ||
  'npm run dev -- --hostname 127.0.0.1 --port 3000';

const shouldUseWebServer = process.env.PLAYWRIGHT_DISABLE_WEBSERVER !== '1';

export default defineConfig({
  testDir: path.join(projectDir, 'tests', 'e2e'),
  fullyParallel: false,
  workers: 1,
  retries: 1,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'output/playwright/report' }],
  ],
  outputDir: 'output/playwright/test-results',
  use: {
    baseURL,
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10000,
    navigationTimeout: 30000,
    ignoreHTTPSErrors: true,
  },
  expect: {
    timeout: 10000,
    toHaveScreenshot: {
      animations: 'disabled',
      caret: 'hide',
      scale: 'device',
    },
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        browserName: 'chromium',
      },
    },
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        browserName: 'firefox',
      },
    },
  ],
  webServer: shouldUseWebServer
    ? {
        command: webServerCommand,
        url: appBaseURL,
        reuseExistingServer: !process.env.CI,
        stdout: 'pipe',
        stderr: 'pipe',
        env: {
          ...process.env,
          NEXT_PUBLIC_APP_URL: appBaseURL,
          NEXT_PUBLIC_E2E_MOCK_BACKEND: process.env.NEXT_PUBLIC_E2E_MOCK_BACKEND || '1',
          E2E_USE_MOCK_BACKEND: process.env.E2E_USE_MOCK_BACKEND || '1',
          PLAYWRIGHT: '1',
        },
      }
    : undefined,
});
