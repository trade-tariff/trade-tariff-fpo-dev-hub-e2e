import { type Page } from '@playwright/test'

export class SignInPage {
  private readonly page: Page
  private static readonly URL = process.env.URL ?? 'https://hub.dev.trade-tariff.service.gov.uk'

  constructor (page: Page) {
    this.page = page
  }

  async signIn (username: string, password: string): Promise<Page> {
    await this.page.goto(SignInPage.URL)
    await this.page.click('text=Start Now')
    await this.page.fill('input[name="username"]', username)
    await this.page.fill('input[name="password"]', password)
    await this.page.click('text=Sign In')
    await this.page.waitForNavigation()

    return this.page
  }

  async signOut (): Promise<Page> {
    await this.page.click('text=Sign out')
    await this.page.waitForNavigation()

    return this.page
  }
}
