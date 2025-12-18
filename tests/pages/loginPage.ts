import { type Page, type Locator, expect } from '@playwright/test'

import EmailFetcher, { EmailData } from "../utils/emailFetcher.js";
import S3Lock from "../utils/s3Lock.js";

export class LoginPage {
  private static readonly STARTING_URL = process.env.URL ?? 'https://hub.dev.trade-tariff.service.gov.uk'
  private static readonly EMAIL_ADDRESS = process.env.EMAIL_ADDRESS ?? ''
  private static readonly INBOUND_BUCKET = process.env.INBOUND_BUCKET ?? ''
  private static readonly LOCK_KEY = process.env.LOCK_KEY ?? ''
  private static readonly NON_ADMIN_BYPASS_PASSWORD = process.env.NON_ADMIN_BYPASS_PASSWORD ?? ''
  private static readonly ADMIN_BYPASS_PASSWORD = process.env.ADMIN_BYPASS_PASSWORD ?? ''

  private readonly page: Page
  private readonly fetcher: EmailFetcher
  private readonly locker: S3Lock
  private email?: EmailData

  constructor(page: Page) {
    this.page = page
    this.fetcher = new EmailFetcher(
      LoginPage.EMAIL_ADDRESS,
      LoginPage.INBOUND_BUCKET,
      "inbound/",
    );
    this.locker = new S3Lock(
      LoginPage.INBOUND_BUCKET,
      LoginPage.LOCK_KEY,
    );
  }

  async login(): Promise<Page> {
    await this.page.goto(LoginPage.STARTING_URL)
    await this.startNowButton().click()

    // Wait for navigation after clicking "Start now"
    await this.page.waitForLoadState('networkidle')

    // Handle dev bypass page if present (only appears in dev environment)
    await this.handleDevBypassIfPresent()

    this.assertOnLoginPage()
    await this.locker.withLock(async () => {
      await this.emailInput().fill(LoginPage.EMAIL_ADDRESS)
      await this.continueButton().click()
      await this.waitForEmail();
      await this.verifyPasswordlessLinkFromEmail();
    });
    await this.page.waitForURL('**/api_keys')
    return this.page
  }

  async signOut(): Promise<Page> {
    await this.signOutLink().click()

    return this.page
  }

  private assertOnLoginPage(): void {
    expect(this.page.url()).toContain('/login')
  }

  private emailInput(): Locator {
    return this.page.locator('input[name="passwordless_form[email]"]')
  }

  private startNowButton(): Locator {
    return this.page.getByRole('button', { name: 'Start now' })
  }

  private continueButton(): Locator {
    return this.page.getByRole('button', { name: 'Continue' })
  }

  private signOutLink(): Locator {
    return this.page.getByRole('link', { name: 'Sign Out' })
  }

  private async handleDevBypassIfPresent(): Promise<void> {
    const currentUrl = this.page.url()

    // Check if we're on the dev bypass page
    if (currentUrl.includes('/dev/login')) {
      // Wait for the dev login page to be fully loaded
      await this.page.waitForSelector('h1:has-text("Dev Login")')

      // Click the link to use real identity service
      await this.page.getByRole('link', { name: 'Use real identity service' }).click()

      // Wait for navigation to the identity service login page
      await this.page.waitForURL('https://id.dev.trade-tariff.service.gov.uk/login')
      await this.page.waitForLoadState('networkidle')
    }
  }

  async loginWithDevBypass(): Promise<Page> {
    console.log(`[loginWithDevBypass] Starting login process, navigating to: ${LoginPage.STARTING_URL}`)
    await this.page.goto(LoginPage.STARTING_URL)

    console.log(`[loginWithDevBypass] Clicking "Start now" button`)
    await this.startNowButton().click()

    // Wait for navigation after clicking "Start now"
    console.log(`[loginWithDevBypass] Waiting for network idle after clicking Start now`)
    await this.page.waitForLoadState('networkidle')

    // Handle dev bypass page with password
    const currentUrl = this.page.url()
    console.log(`[loginWithDevBypass] Current URL after Start now: ${currentUrl}`)

    if (currentUrl.includes('/dev/login')) {
      console.log(`[loginWithDevBypass] Detected dev/login page, waiting for "Dev Login" heading`)
      // Wait for the dev login page to be fully loaded
      await this.page.waitForSelector('h1:has-text("Dev Login")')
      console.log(`[loginWithDevBypass] Dev Login page loaded`)

      // Fill in the dev password - try multiple selectors to find the password field
      console.log(`[loginWithDevBypass] Looking for password input field`)
      const passwordInput = this.page.locator('input[type="password"]').first()
      const passwordInputCount = await passwordInput.count()
      console.log(`[loginWithDevBypass] Found ${passwordInputCount} password input(s)`)

      if (passwordInputCount === 0) {
        throw new Error('Password input field not found on dev login page')
      }

      const password = LoginPage.NON_ADMIN_BYPASS_PASSWORD
      const firstTwo = password.substring(0, 2)
      const lastThree = password.substring(password.length - 3)
      console.log(`[loginWithDevBypass] Non-admin password: First 2 chars: "${firstTwo}", Last 3 chars: "${lastThree}", Length: ${password.length}`)

      console.log(`[loginWithDevBypass] Filling password field`)
      await passwordInput.fill(password)

      // Submit the form - try to find submit button by various means
      console.log(`[loginWithDevBypass] Looking for submit button`)
      const submitButton = this.page.getByRole('button').filter({ hasText: /submit|login|sign in/i }).first()
      const submitButtonCount = await submitButton.count()
      console.log(`[loginWithDevBypass] Found ${submitButtonCount} submit button(s)`)

      if (submitButtonCount > 0) {
        const buttonText = await submitButton.textContent()
        console.log(`[loginWithDevBypass] Clicking submit button with text: "${buttonText}"`)
        await submitButton.click()
      } else {
        // Fallback: press Enter on the password field
        console.log(`[loginWithDevBypass] No submit button found, pressing Enter on password field`)
        await passwordInput.press('Enter')
      }

      // Wait a moment to see if navigation starts
      console.log(`[loginWithDevBypass] Waiting 2 seconds to check for navigation...`)
      await this.page.waitForTimeout(2000)
      const urlAfterSubmit = this.page.url()
      console.log(`[loginWithDevBypass] URL after submit attempt: ${urlAfterSubmit}`)

      // Wait for navigation to the api_keys page
      console.log(`[loginWithDevBypass] Waiting for navigation to **/api_keys (current URL: ${urlAfterSubmit})`)
      try {
        await this.page.waitForURL('**/api_keys', { timeout: 140000 })
        const finalUrl = this.page.url()
        console.log(`[loginWithDevBypass] Successfully navigated to: ${finalUrl}`)
      } catch (error) {
        const timeoutUrl = this.page.url()
        console.log(`[loginWithDevBypass] TIMEOUT waiting for **/api_keys. Current URL: ${timeoutUrl}`)
        console.log(`[loginWithDevBypass] Page title: ${await this.page.title()}`)
        const pageContent = await this.page.content()
        console.log(`[loginWithDevBypass] Page content length: ${pageContent.length} chars`)
        // Log first 500 chars of page content to see what we're stuck on
        console.log(`[loginWithDevBypass] Page content preview: ${pageContent.substring(0, 500)}`)
        throw error
      }

      console.log(`[loginWithDevBypass] Waiting for network idle`)
      await this.page.waitForLoadState('networkidle')
      console.log(`[loginWithDevBypass] Login complete`)
    } else {
      console.log(`[loginWithDevBypass] ERROR: Dev bypass page not found. Current URL: ${currentUrl}`)
      throw new Error(`Dev bypass page not found. This method should only be used in dev environment. Current URL: ${currentUrl}`)
    }

    return this.page
  }

  private async waitForEmail() {
    const timeout = 20 * 1000;

    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const email = await this.fetcher.getLatestEmail();

      if (email && email.send_date > new Date(Date.now() - timeout)) {
        this.email = email;
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, 1 * 1000));
    }
    if (this.email) return this.email;

    throw new Error("No email received within the timeout period");
  }

  async verifyPasswordlessLinkFromEmail() {
    if (
      !this.email ||
      !this.email.whitelistedLinks ||
      this.email.whitelistedLinks.length === 0
    ) {
      throw new Error("No valid email links found");
    }

    const link = this.email.whitelistedLinks[0];
    await this.page.goto(link);
  }
}
