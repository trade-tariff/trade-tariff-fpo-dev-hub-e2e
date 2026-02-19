import { type Page, type Locator, expect } from '@playwright/test'

import EmailFetcher, { type EmailData } from '../utils/emailFetcher.js'
import S3Lock from '../utils/s3Lock.js'

/**
 * Login uses passwordless email flow in all environments (dev and staging):
 * - Click "Start now".
 * - In dev: land on dev login page → click "Use real identity service" → email page.
 * - In staging: go straight to email page.
 * - Then enter email, receive link from SES, follow link.
 */
export class LoginPage {
  private static readonly STARTING_URL = process.env.URL ?? 'https://hub.dev.trade-tariff.service.gov.uk'
  private static readonly EMAIL_ADDRESS = process.env.EMAIL_ADDRESS ?? ''
  private static readonly INBOUND_BUCKET = process.env.INBOUND_BUCKET ?? ''
  private static readonly LOCK_KEY = process.env.LOCK_KEY ?? ''

  /** Max time to wait for passwordless login email (ms). */
  private static readonly EMAIL_WAIT_MS = 20 * 1000
  /** Poll interval while waiting for email (ms). */
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

  /**
   * Log in via passwordless email (same flow in dev and staging).
   * Requires URL, EMAIL_ADDRESS, INBOUND_BUCKET, and LOCK_KEY to be set in env.
   */
  async login(): Promise<Page> {
    this.requireEnvForLogin()

    await this.loginViaPasswordlessEmail()

    await this.page.waitForLoadState('networkidle')

    // Verify we landed on the organisation dashboard
    expect(this.page.url()).toMatch(/\/organisations\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)

    return this.page
  }

  /** Fail fast with a clear message if required env vars are missing. */
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
    await this.page.waitForLoadState('networkidle')

    // Click "Start now" → dev shows dev login page; staging goes straight to identity email page
    await this.startNowButton().click()
    await this.page.waitForLoadState('networkidle')

    // In dev only: dev login page has "Use real identity service" → click to reach email page
    const useRealIdentity = this.page.getByRole('link', { name: /use real identity service/i })
      .or(this.page.getByRole('button', { name: /use real identity service/i }))
    try {
      await useRealIdentity.first().click({ timeout: 3000 })
      await this.page.waitForLoadState('networkidle')
    } catch {
      // Staging: button not present, we're already on the email page
    }

    this.assertOnLoginPage()

    await this.locker.withLock(async () => {
      // Try the specific form field first, then fall back to any email input
      const specificInput = this.page.locator('input[name="passwordless_form[email]"]')
      const emailInput = (await specificInput.count() > 0)
        ? specificInput
        : this.page.locator('input[type="email"]').first()

      await emailInput.fill(LoginPage.EMAIL_ADDRESS)
      await this.continueButton().click()
      await this.waitForEmail();
      await this.verifyPasswordlessLinkFromEmail();
    });
  }

  private assertOnLoginPage(): void {
    expect(this.page.url()).toContain('/login')
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
