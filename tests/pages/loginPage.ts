import { type Page, type Locator, expect } from '@playwright/test'

import EmailFetcher, { type EmailData } from '../utils/emailFetcher.js'
import S3Lock from '../utils/s3Lock.js'

export class LoginPage {
  private static readonly STARTING_URL = process.env.URL ?? 'https://hub.dev.trade-tariff.service.gov.uk'
  private static readonly EMAIL_ADDRESS = process.env.EMAIL_ADDRESS ?? ''
  private static readonly INBOUND_BUCKET = process.env.INBOUND_BUCKET ?? ''
  private static readonly LOCK_KEY = process.env.LOCK_KEY ?? ''

  private static readonly EMAIL_WAIT_MS = 20 * 1000
  private static readonly EMAIL_POLL_MS = 1 * 1000

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

  // Log in via passwordless email
  // Requires URL, EMAIL_ADDRESS, INBOUND_BUCKET, and LOCK_KEY to be set in env
  async login(): Promise<Page> {
    this.requireEnvForLogin()

    await this.loginViaPasswordlessEmail()

    // Verify we landed on the organisation dashboard
    await this.page.waitForURL(/\/organisations\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
    expect(this.page.url()).toMatch(/\/organisations\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)

    return this.page
  }

  private requireEnvForLogin(): void {
    const missing: string[] = []
    if (!LoginPage.STARTING_URL) missing.push('URL')
    if (!LoginPage.EMAIL_ADDRESS) missing.push('EMAIL_ADDRESS')
    if (!LoginPage.INBOUND_BUCKET) missing.push('INBOUND_BUCKET')
    if (!LoginPage.LOCK_KEY) missing.push('LOCK_KEY')
    if (missing.length > 0) {
      throw new Error(
        `Missing required environment variables for login: ${missing.join(', ')}. ` +
        'Set them in .env or .env.development / .env.staging (see README).'
      )
    }
  }

  async signOut(): Promise<Page> {
    await this.signOutLink().click()
    return this.page
  }

  private async loginViaPasswordlessEmail(): Promise<void> {
    // Navigate to base URL and click "Start now" to initiate login flow
    await this.page.goto(LoginPage.STARTING_URL)
    await this.startNowButton().waitFor({ state: 'visible' })

    await this.startNowButton().click()
    await this.waitForLoginEntryPoint()

    await this.waitForEmailInput()
    this.assertOnLoginPage()

    await this.locker.withLock(async () => {
      // Try the specific form field first, then fall back to any email input
      const specificInput = this.page.locator('input[name="passwordless_form[email]"]')
      const emailInput = (await specificInput.count() > 0)
        ? specificInput
        : this.page.locator('input[type="email"]').first()

      await emailInput.fill(LoginPage.EMAIL_ADDRESS)
      await this.continueButton().click();
      await this.waitForEmail();
      await this.enterCodeFromEmail();
      await this.continueButton().click();
    });
  }

  private assertOnLoginPage(): void {
    expect(this.page.url()).toContain('/login')
  }

  private async waitForLoginEntryPoint(): Promise<void> {
    const useRealIdentity = this.page.getByRole('link', { name: /use real identity service/i })
      .or(this.page.getByRole('button', { name: /use real identity service/i }))
    const specificEmailInput = this.page.locator('input[name="passwordless_form[email]"]')
    const genericEmailInput = this.page.locator('input[type="email"]').first()

    await Promise.race([
      useRealIdentity.first().waitFor({ state: 'visible', timeout: 15_000 }),
      specificEmailInput.waitFor({ state: 'visible', timeout: 15_000 }),
      genericEmailInput.waitFor({ state: 'visible', timeout: 15_000 }),
      this.page.waitForURL(/\/dev\/login|\/login/, { timeout: 15_000 }),
    ])
  }

  private async waitForEmailInput(): Promise<void> {
    const specificEmailInput = this.page.locator('input[name="passwordless_form[email]"]')
    const genericEmailInput = this.page.locator('input[type="email"]').first()
    await Promise.race([
      specificEmailInput.waitFor({ state: 'visible', timeout: 15_000 }),
      genericEmailInput.waitFor({ state: 'visible', timeout: 15_000 }),
    ])
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

  private otpFirstDigitInput(): Locator {
    return this.page.locator('input[aria-label="Digit 1 of 6"]')
  }

  private async waitForEmail() {
    const startTime = Date.now();

    while (Date.now() - startTime < LoginPage.EMAIL_WAIT_MS) {
      const email = await this.fetcher.getLatestEmail();

      if (email && email.send_date > new Date(Date.now() - LoginPage.EMAIL_WAIT_MS)) {
        this.email = email;
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, LoginPage.EMAIL_POLL_MS));
    }
    if (this.email) return this.email;

    throw new Error(`No email received within ${LoginPage.EMAIL_WAIT_MS}ms`);
  }

  private async enterCodeFromEmail() {
    if (!this.email || !this.email.code) {
      throw new error("No OTP code found");

      const code = this.email.code;
      await this.otpFirstDigitInput().click();
      await this.otpFirstDigitInput().pressSequentially(code);
    }
  }
}
