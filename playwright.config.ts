import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env.test for E2E (Supabase service role, etc.)
dotenv.config({ path: path.resolve(__dirname, '.env.test') });
dotenv.config({ path: path.resolve(__dirname, '.env') }); // fallback to .env

const baseURL = process.env.E2E_BASE_URL || 'http://localhost:8081';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [
    ['html', { outputFolder: 'e2e-results/html', open: 'never' }],
    ['list'],
  ],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  // Start app if not running. Run `npm run web` first for faster feedback.
  webServer: {
    command: 'npx expo start --web --port 8081',
    url: baseURL,
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
