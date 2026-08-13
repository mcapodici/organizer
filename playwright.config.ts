import { defineConfig, devices } from '@playwright/test';

// E2E suite for the Organizer app. Chromium only (see AGENTS.md).
//
// The app is served under the base path /app/ and uses hash routing. We run
// against the Vite dev server (not a production build) because the production
// build registers a PWA service worker (vite-plugin-pwa, autoUpdate) that
// caches the app shell and makes reload-based persistence tests flaky. The
// dev server never registers the service worker.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: 'list',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: 'http://localhost:5174/app/',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npx vite --port 5174 --strictPort',
    url: 'http://localhost:5174/app/',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
