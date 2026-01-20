import { type Page, type Locator, expect } from '@playwright/test'

import EmailFetcher, { EmailData } from "../utils/emailFetcher.js";
import S3Lock from "../utils/s3Lock.js";

export class LoginPage {
  private static readonly STARTING_URL = process.env.URL ?? 'https://hub.dev.trade-tariff.service.gov.uk'
  private static readonly EMAIL_ADDRESS = process.env.EMAIL_ADDRESS ?? ''
  private static readonly INBOUND_BUCKET = process.env.INBOUND_BUCKET ?? ''
  private static readonly LOCK_KEY = process.env.LOCK_KEY ?? ''
  private static readonly NON_ADMIN_BYPASS_PASSWORD = process.env.NON_ADMIN_BYPASS_PASSWORD ?? ''

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
    await this.page.waitForLoadState('networkidle')

    if (this.page.url().includes('/dev/login')) {
      await this.loginViaDevBypass()
    } else {
      await this.loginViaPasswordlessEmail()
    }

    await this.page.waitForLoadState('networkidle')
    await this.navigateToApiKeys()
    return this.page
  }

  private async navigateToApiKeys(): Promise<void> {
    if (!this.page.url().includes('/api_keys')) {
      await this.page.goto(`${LoginPage.STARTING_URL}/api_keys`)
      await this.page.waitForLoadState('networkidle')
    }
  }

  async signOut(): Promise<Page> {
    await this.signOutLink().click()
    return this.page
  }

  private async loginViaDevBypass(): Promise<void> {
    await this.page.waitForSelector('h1:has-text("Dev Login")')

    const passwordInput = this.page.locator('input[type="password"]').first()
    await passwordInput.fill(LoginPage.NON_ADMIN_BYPASS_PASSWORD)

    const submitButton = this.page.getByRole('button').filter({ hasText: /submit|login|sign in/i }).first()
    if (await submitButton.count() > 0) {
      await submitButton.click()
    } else {
      await passwordInput.press('Enter')
    }

    await this.page.waitForLoadState('networkidle')
  }

  private async loginViaPasswordlessEmail(): Promise<void> {
    this.assertOnLoginPage()
    await this.locker.withLock(async () => {
      await this.emailInput().fill(LoginPage.EMAIL_ADDRESS)
      await this.continueButton().click()
      await this.waitForEmail();
      await this.verifyPasswordlessLinkFromEmail();
    });
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
