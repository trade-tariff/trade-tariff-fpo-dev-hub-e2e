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
      use: { ...devices['Desktop Chrome'] }
    }
  ]
})
