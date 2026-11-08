import { defineConfig, devices } from '@playwright/test';

/**
 * UI end-to-end tests. Requires the game server (port 4000) and Postgres/Redis running:
 *   npm run dev:infra && npm run dev:server   (then)   npm run test:ui -w @masoi/web
 * The web dev server is started automatically.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 180_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3100',
    trace: 'retain-on-failure',
    ignoreHTTPSErrors: Boolean(process.env.E2E_BASE_URL),
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: 'npm run dev', url: 'http://localhost:3100', reuseExistingServer: true, timeout: 120_000 },
});
