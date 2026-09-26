import { defineConfig, devices } from '@playwright/test';

// E2E smoke tests against a running dev stack (./start-frontend-backend.sh).
// Credentials come from the environment: E2E_USER / E2E_PASSWORD (admin),
// optional E2E_UPLOADER_USER / E2E_UPLOADER_PASSWORD for the uploader-role tests.
// Set PW_CHANNEL=chrome to use the locally installed Chrome instead of downloaded browsers.
const channel = process.env.PW_CHANNEL;

export default defineConfig({
    testDir: './e2e',
    fullyParallel: true,
    retries: process.env.CI ? 1 : 0,
    reporter: [['list']],
    use: {
        baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173',
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
    },
    projects: [
        { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 }, ...(channel ? { channel } : {}) }, testIgnore: /mobile\.spec\.ts/ },
        { name: 'mobile', use: { ...devices['Pixel 7'], ...(channel ? { channel } : {}) }, testMatch: /mobile\.spec\.ts/ },
    ],
});
