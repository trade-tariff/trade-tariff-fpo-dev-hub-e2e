import { type Locator, expect, type Page } from '@playwright/test'

export class DashboardPage {
  private readonly page: Page
  private keys: Record<string, string>

  constructor (page: Page) {
    this.page = page
    this.keys = {}
  }

  async createKey (description: string): Promise<void> {
    this.assertDashboardPage()

    await this.createKeyButton().click()

    this.assertNewKeyPage()

    await this.createKeyDescriptionInput().fill(description)
    await this.createKeySubmitButton().click()

    this.assertCreatePage()

    await this.storeKey(description)

    await this.backToDashboardLink().click()
    this.assertDashboardPage()
  }

  async revokeKey (description: string): Promise<void> {
    await this.revokeKeyLink(description).click()

    this.assertRevokeKeyPage()

    await this.revokeKeyButton().click()

    this.assertDashboardPage()

    await this.assertRevoked(description)
  }

  async deleteKey (description: string): Promise<void> {
    await this.deleteKeyLink(description).click()

    this.assertDeleteKeyPage()

    await this.deleteKeyButton().click()

    this.assertDashboardPage()

    await this.assertDeleted(description)
  }

  async assertRevoked (description: string): Promise<void> {
    const statusCell = this.revokedKeyStatus(description)

    await expect(statusCell).toHaveText(this.revokedDate())
  }

  async assertDeleted (description: string): Promise<void> {
    const keyRow = this.keyRow(description)

    await expect(keyRow).not.toBeVisible()
  }

  assertDashboardPage (): void {
    const expectedUrl = '/dashboard/local-development'
    // TODO: This should not have local-development in the URL
    expect(this.page.url()).toContain(expectedUrl)
  }

  assertNewKeyPage (): void {
    // TODO: This should not have local-development in the URL
    expect(this.page.url()).toContain('/dashboard/keys/local-development/new')
  }

  assertRevokeKeyPage (): void {
    // TODO: This should not have local-development in the URL
    expect(this.page.url()).toMatch(/\/dashboard\/keys\/local-development\/[A-Z0-9]{20}\/revoke/)
  }

  assertDeleteKeyPage (): void {
    // TODO: This should not have local-development in the URL
    expect(this.page.url()).toMatch(/\/dashboard\/keys\/local-development\/[A-Z0-9]{20}\/delete/)
  }

  assertCreatePage (): void {
    // TODO: This should not have local-development in the URL
    expect(this.page.url()).toContain('/dashboard/keys/local-development/create')
  }

  async storeKey (description: string): Promise<void> {
    let key = await this.createdApiKey().innerText()
    key = key.trim()

    this.setKey(description, key)
  }

  getKey (description: string): string | null {
    if (description in this.keys) { return this.keys[description] }

    return null
  }

  private setKey (description: string, key: string): void {
    this.keys[description] = key
  }

  private createKeyButton (): Locator {
    return this.page.getByRole('link', { name: 'Create New Key' })
  }

  private createKeyDescriptionInput (): Locator {
    return this.page.getByLabel('Enter the description for your API key.')
  }

  private createKeySubmitButton (): Locator {
    return this.page.getByRole('button')
  }

  private createdApiKey (): Locator {
    return this.page.locator('code.govuk-code')
  }

  private revokeKeyLink (description: string): Locator {
    const rowLocator = this.keyRow(description)
    const rowLinkLocator = rowLocator.locator('a:has-text("Revoke")')

    return rowLinkLocator
  }

  private deleteKeyLink (description: string): Locator {
    const rowLocator = this.keyRow(description)
    const rowLinkLocator = rowLocator.locator('a:has-text("Delete")')

    return rowLinkLocator
  }

  private revokeKeyButton (): Locator {
    return this.page.getByRole('button', { name: 'Revoke' })
  }

  private deleteKeyButton (): Locator {
    return this.page.getByRole('button', { name: 'Delete' })
  }

  private revokedKeyStatus (description: string): Locator {
    const rowLocator = this.keyRow(description)
    const statusCell = rowLocator.locator('td.govuk-table__cell:nth-child(4)')

    return statusCell
  }

  private keyRow (description: string): Locator {
    return this.page.locator(`//tr[td[contains(text(), "${description}")]]`)
  }

  private backToDashboardLink (): Locator {
    return this.page.getByRole('link', { name: 'Back to dashboard' })
  }

  private revokedDate (): string {
    const today = new Date()
    const day = today.getDate()
    const month = today.toLocaleString('default', { month: 'long' })
    const year = today.getFullYear()

    return `Revoked on ${day} ${month} ${year}`
  }
}
