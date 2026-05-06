import { defineConfig, devices } from '@playwright/test'
import dotenv from 'dotenv'
import path from 'path'

// PLAYWRIGHT_ENV selects .env.development, .env.staging, .env.production, etc.
const playwrightEnv = process.env.PLAYWRIGHT_ENV ?? 'development'
const envFile = path.resolve(__dirname, `.env.${playwrightEnv}`)
dotenv.config({ path: envFile })
dotenv.config({ path: ".env" });

// See https://playwright.dev/docs/test-configuration.
const onCI = (process.env.CI ?? 'false') === 'true'
export default defineConfig({
  testDir: './tests',
  // Serial execution: login uses one EMAIL_ADDRESS + S3 inbox + distributed lock; parallel workers cause timeouts.
  fullyParallel: false,
  forbidOnly: onCI,
  retries: onCI ? 2 : 0,
  workers: 1,
  reporter: 'html',
  use: { trace: 'on' },
  timeout: 50000, // keys take a while to go live

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ]
})
