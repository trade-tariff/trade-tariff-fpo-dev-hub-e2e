import { defineConfig, devices } from '@playwright/test'
import dotenv from 'dotenv'
import path from 'path'

const playwrightEnv = process.env.PLAYWRIGHT_ENV ?? 'development'
const envFile = path.resolve(__dirname, `.env.${playwrightEnv}`)
dotenv.config({ path: envFile })
dotenv.config({ path: ".env" });

// See https://playwright.dev/docs/test-configuration.
const onCI = (process.env.CI ?? 'false') === 'true'
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: onCI,
  retries: onCI ? 2 : 0,
  workers: onCI ? 1 : undefined,
  reporter: 'html',
  use: { trace: 'on' },
  timeout: 140000, // 140 seconds - occasionally keys take a while to go live

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Slow down actions for local debugging (set SLOW_MO env var, e.g., SLOW_MO=500)
        slowMo: process.env.SLOW_MO ? parseInt(process.env.SLOW_MO) : 0
      }
    }
  ]
})
