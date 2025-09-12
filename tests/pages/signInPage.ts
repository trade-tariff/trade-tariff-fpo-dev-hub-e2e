import { type Page, type Locator, expect } from '@playwright/test'

export class SignInPage {
  static readonly STARTING_URL = process.env.URL ?? 'https://hub.dev.trade-tariff.service.gov.uk'
  private readonly page: Page
  private static readonly USER_ID = process.env.SCP_USERNAME ?? ''
  private static readonly PASSWORD = process.env.SCP_PASSWORD ?? ''

  constructor(page: Page) {
    this.page = page
  }

  async signIn(): Promise<Page> {
    await this.page.goto(SignInPage.STARTING_URL)
    await this.startNowButton().click()

    this.assertOnSignInPage()

    await this.userIdInput().fill(SignInPage.USER_ID)
    await this.passwordInput().fill(SignInPage.PASSWORD)
    await this.signInButton().click()

    await this.page.waitForURL('**/api_keys')

    return this.page
  }

  async updateProfile(): Promise<Page> {
    await this.updateProfileLink().click()
    await this.page.waitForURL('**/account/your-details/**')
    this.assertDescriptionOnPage('Your details')
    await this.onlineTradeTariffReturnURL().click()
    expect(this.page.url()).toContain('/api_keys')
    return this.page
  }

  async manageTeam(): Promise<Page> {
    await this.manageTeamLink().click()
    await this.page.waitForURL('**/group/members/**')
    this.assertDescriptionOnPage('Team members')
    await this.onlineTradeTariffReturnURL().click()
    expect(this.page.url()).toContain('/api_keys')
    return this.page
  }

  async signOut(): Promise<Page> {
    await this.signOutLink().click()

    return this.page
  }

  private assertOnSignInPage(): void {
    expect(this.page.url()).toContain('/login/signin/creds')
  }

  private userIdInput(): Locator {
    return this.page.locator('input[name="user_id"]')
  }

  private passwordInput(): Locator {
    return this.page.locator('input[name="password"]')
  }

  private startNowButton(): Locator {
    return this.page.getByRole('button', { name: 'Start now' })
  }

  private signInButton(): Locator {
    return this.page.getByRole('button', { name: 'Sign in' })
  }

  private signOutLink(): Locator {
    return this.page.getByRole('link', { name: 'Sign Out' })
  }

  private updateProfileLink(): Locator {
    return this.page.getByRole('link', { name: 'Update Profile' })
  }

  private manageTeamLink(): Locator {
    return this.page.getByRole('link', { name: 'Manage Team' })
  }

  private onlineTradeTariffReturnURL(): Locator {
    return this.page.getByRole('link', { name: 'Return to HMRC Online Trade Tariff' })
  }

  assertDescriptionOnPage(description: string): void {
    this.page.locator(`//tr[td[contains(text(), "${description}")]]`)
  }
}
