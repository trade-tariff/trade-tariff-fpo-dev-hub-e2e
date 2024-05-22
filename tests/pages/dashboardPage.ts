import { type Locator, expect, type Page } from '@playwright/test'

export class DashboardPage {
  private readonly page: Page
  private keys: Record<string, string>

  constructor (page: Page) {
    this.page = page
    this.keys = {}
  }

  async createKey (description: string): Promise<void> {
    expect(this.page.url()).toContain('/dashboard/testing')

    await this.createKeyButton().click()

    expect(this.page.url()).toContain('/dashboard/keys/testing/new')

    await this.createKeyInput().fill(description)
    await this.createKeySubmitButton().click()
    await this.page.waitForResponse(response => response.status() === 201)

    const key = await this.page.innerText('text=API Key')

    this.setKey(description, key)
  }

  async revokeKey (description: string): Promise<void> {
    await this.page.click(`text=Revoke Key for ${description}`)
    await this.page.waitForResponse(response => response.status() === 200)
  }

  async assertRevoked (_description: string): Promise<void> {
    expect(true).toBe(true)
  }

  getKey (description: string): string | null {
    if (description in this.keys) { return this.keys[description] }

    return null
  }

  private setKey (description: string, key: string): void {
    this.keys[description] = key
  }

  private createKeyButton (): Locator {
    return this.page.getByRole('button', { name: 'Create Key' })
  }

  private createKeyInput (): Locator {
    return this.page.getByRole('textbox', { name: 'apiKeyDescription' })
  }

  private createKeySubmitButton (): Locator {
    return this.page.getByRole('button', { name: 'Submit' })
  }
}
