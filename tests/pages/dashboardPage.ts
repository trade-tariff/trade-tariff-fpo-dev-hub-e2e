import { type Locator, expect, type Page } from '@playwright/test'

export class DashboardPage {
  private readonly page: Page
  private keys: Record<string, string>

  constructor(page: Page) {
    this.page = page
    this.keys = {}
  }

  async createKey(description: string): Promise<void> {
    this.assertDashboardPage()

    await this.navigateToFpoKeysTab()

    await this.createKeyButton().click()

    this.assertNewKeyPage()

    await this.createKeyDescriptionInput().fill(description)
    await this.createKeySubmitButton().click()

    // Verify key creation success page
    await this.assertKeyCreationSuccess()

    await this.storeKey(description)

    // Click "Back to api keys" to see the key row in the table
    await this.backToDashboardLink().click()

    // After clicking back, we're on the /api_keys page where we can see the key row
    this.assertApiKeysPage()

    await this.assertKeyCreated(description)
  }

  async revokeKey(description: string): Promise<void> {
    // Navigate to /api_keys page (or use FPO Keys tab if on dashboard)
    await this.ensureOnApiKeysPage()

    await this.revokeKeyLink(description).click()

    this.assertRevokeKeyPage()
    await this.assertRevokeConfirmationPage(description)

    await this.revokeKeyButton().click()

    // After revoking, we're redirected back to the /api_keys page
    this.assertApiKeysPage()

    await this.assertRevoked(description)
  }

  async deleteKey(description: string): Promise<void> {
    // Navigate to /api_keys page (or use FPO Keys tab if on dashboard)
    await this.ensureOnApiKeysPage()

    await this.deleteKeyLink(description).click()

    this.assertDeleteKeyPage()
    await this.assertDeleteConfirmationPage(description)

    await this.deleteKeyButton().click()

    // After deleting, we're redirected back to the /api_keys page
    this.assertApiKeysPage()

    await this.assertDeleted(description)
  }

  async assertRevoked(description: string): Promise<void> {
    // We're already on the /api_keys page after revoking
    const keyRow = this.keyRow(description)
    await expect(keyRow).toBeVisible()

    // Verify status shows "Revoked"
    const statusCell = this.revokedKeyStatus(description)
    await expect(statusCell).toHaveText(this.revokedDate())

    // Verify "Delete" link is visible (replaces "Revoke" link)
    const deleteLink = this.deleteKeyLink(description)
    await expect(deleteLink).toBeVisible()
  }

  async assertDeleted(description: string): Promise<void> {
    // We're already on the /api_keys page after deleting
    const keyRow = this.keyRow(description)

    await expect(keyRow).not.toBeVisible()
  }

  async assertKeyCreated(description: string): Promise<void> {
    const keyRow = this.keyRow(description)
    await expect(keyRow).toBeVisible()

    // Verify status is "Active"
    const statusCell = this.keyStatus(description)
    await expect(statusCell).toContainText(/active/i)

    // Verify description matches
    const descriptionCell = this.keyDescription(description)
    await expect(descriptionCell).toContainText(description)

    // Verify "Revoke" link is visible for active keys
    const revokeLink = this.revokeKeyLink(description)
    await expect(revokeLink).toBeVisible()
  }

  async assertKeyCreationSuccess(): Promise<void> {
    // Verify success panel
    await expect(this.page.getByText(/Your API Key has been created successfully/i)).toBeVisible()

    // Verify warning message
    await expect(this.page.getByText(/You must copy this key to somewhere safe/i)).toBeVisible()

    // Verify API Key secret is displayed
    await expect(this.createdApiKey()).toBeVisible()

    // Verify "Copy to clipboard" button exists
    await expect(this.copyToClipboardButton()).toBeVisible()
  }

  async assertRevokeConfirmationPage(description: string): Promise<void> {
    // Verify warning message
    await expect(this.page.getByText(/Your API Key will be revoked with immediate effect/i)).toBeVisible()

    // Verify key details are shown (description should be visible)
    await expect(this.page.getByText(description)).toBeVisible()
  }

  async assertDeleteConfirmationPage(description: string): Promise<void> {
    // Verify warning message
    await expect(this.page.getByText(/Your API Key will be deleted with immediate effect/i)).toBeVisible()

    // Verify key details are shown (description should be visible)
    await expect(this.page.getByText(description)).toBeVisible()
  }

  assertDashboardPage(): void {
    expect(this.page.url()).toMatch(/\/organisations\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
  }

  assertNewKeyPage(): void {
    expect(this.page.url()).toContain('/api_keys/new')
  }

  assertRevokeKeyPage(): void {
    expect(this.page.url()).toMatch(/\/api_keys\/.*\/revoke/)
  }

  assertDeleteKeyPage(): void {
    expect(this.page.url()).toMatch(/\/api_keys\/.*\/delete/)
  }

  assertCreatePage(): void {
    expect(this.page.url()).toContain('/api_keys')
  }

  assertApiKeysPage(): void {
    expect(this.page.url()).toContain('/api_keys')
  }

  async storeKey(description: string): Promise<void> {
    let key = await this.createdApiKey().innerText()
    key = key.trim()

    this.setKey(description, key)
  }

  getKey(description: string): string | null {
    if (description in this.keys) { return this.keys[description] }

    return null
  }

  private setKey(description: string, key: string): void {
    this.keys[description] = key
  }

  private createKeyButton(): Locator {
    return this.page.getByRole('link', { name: 'Create new key' })
  }

  private createKeyDescriptionInput(): Locator {
    return this.page.locator('#api-key-description-field')
  }

  private createKeySubmitButton(): Locator {
    return this.page.getByRole('button', { name: /continue/i })
  }

  private createdApiKey(): Locator {
    return this.page.locator('code.govuk-code')
  }

  private revokeKeyLink(description: string): Locator {
    const rowLocator = this.keyRow(description)
    const rowLinkLocator = rowLocator.locator('a:has-text("Revoke")')

    return rowLinkLocator
  }

  private deleteKeyLink(description: string): Locator {
    const rowLocator = this.keyRow(description)
    const rowLinkLocator = rowLocator.locator('a:has-text("Delete")')

    return rowLinkLocator
  }

  private revokeKeyButton(): Locator {
    return this.page.getByRole('button', { name: 'Revoke' })
  }

  private deleteKeyButton(): Locator {
    return this.page.getByRole('button', { name: 'Delete' })
  }

  private keyStatus(description: string): Locator {
    const rowLocator = this.keyRow(description)
    const statusCell = rowLocator.locator('td.govuk-table__cell:nth-child(4)')

    return statusCell
  }

  private revokedKeyStatus(description: string): Locator {
    return this.keyStatus(description)
  }

  private keyDescription(description: string): Locator {
    const rowLocator = this.keyRow(description)
    // Description is typically in the first or second column
    return rowLocator.locator('td').first()
  }

  private copyToClipboardButton(): Locator {
    return this.page.getByRole('button', { name: /copy to clipboard/i })
  }

  private keyRow(description: string): Locator {
    return this.page.locator(`//tr[td[contains(text(), "${description}")]]`)
  }

  private async navigateToFpoKeysTab(): Promise<void> {
    const fpoKeysTab = this.fpoKeysTab()
    await fpoKeysTab.click()
    await this.page.waitForLoadState('networkidle')
  }

  private async ensureOnApiKeysPage(): Promise<void> {
    if (!this.page.url().includes('/api_keys')) {
      // If on dashboard, navigate via FPO Keys tab
      if (this.page.url().match(/\/organisations\/[0-9a-f-]+$/i)) {
        await this.navigateToFpoKeysTab()
      } else {
        // Otherwise navigate directly to /api_keys
        await this.page.goto(`${this.page.url().split('/').slice(0, 3).join('/')}/api_keys`)
        await this.page.waitForLoadState('networkidle')
      }
    }
  }

  private fpoKeysTab(): Locator {
    return this.page.getByRole('link', { name: /FPO Keys/i }).or(
      this.page.getByRole('tab', { name: /FPO Keys/i })
    )
  }

  private backToDashboardLink(): Locator {
    return this.page.getByRole('link', { name: 'Back to api keys' })
  }

  private revokedDate(): string {
    const today = new Date()
    const day = today.getDate()
    const month = today.toLocaleString('default', { month: 'long' })
    const year = today.getFullYear()

    return `Revoked on ${day} ${month} ${year}`
  }
}
