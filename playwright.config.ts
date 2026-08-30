import { defineConfig, devices } from '@playwright/test'

import { E2E_DATA_DIR, writeSeedStore } from './e2e/helpers/seed'

writeSeedStore()

const e2ePort = 3100
const e2eOrigin = `http://127.0.0.1:${e2ePort}`

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'html',
  use: {
    baseURL: e2eOrigin,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: `npx next dev --port ${e2ePort} --hostname 127.0.0.1`,
    url: e2eOrigin,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      ...process.env,
      DATA_DIR: E2E_DATA_DIR,
      ACCESS_PIN: '',
      ALLOW_HTTP_FETCH: '',
      PORT: String(e2ePort),
    },
  },
})
