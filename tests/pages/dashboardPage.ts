import { type Locator, expect, type Page } from '@playwright/test'

export class DashboardPage {
  private readonly page: Page
  private keys: Record<string, string>

  constructor(page: Page) {
    this.page = page
    this.keys = {}
  }

  async createKey(description: string): Promise<void> {
    // Assert we're on organisation page initially
    this.assertOrganisationPage()

    // Navigate to FPO Keys page
    await this.fpoKeysLink().click()
    await this.page.waitForURL(/\/api_keys/, { timeout: 10000 })

    // Assert we're now on FPO Keys page
    this.assertFpoKeysPage()
    // Verify page heading
    await expect(this.page.locator('h1')).toContainText('FPO keys', { timeout: 10000 })

    // Click create new key button
    await this.createKeyButton().click()
    await this.page.waitForURL(/\/api_keys\/new/, { timeout: 10000 })

    // Assert we're on the new key page
    this.assertNewKeyPage()

    // Fill in description and submit
    await this.createKeyDescriptionInput().fill(description)

    const submitButton = this.createKeySubmitButton()

    // Click submit and wait for navigation
    await submitButton.click()

    // Wait for navigation to complete - should stay on /api_keys or navigate to it
    try {
      await this.page.waitForURL(/\/api_keys/, { timeout: 30000 })
    } catch {
      const currentUrl = this.page.url()
      if (currentUrl.includes('chrome-error://')) {
        throw new Error(`Page navigation failed after form submission. URL: ${currentUrl}`)
      }
      // Only continue if we're already on the right page
      if (!currentUrl.includes('/api_keys')) {
        throw new Error(`Expected to be on /api_keys but was on ${currentUrl}`)
      }
    }

    // Wait for the success message to appear - this confirms the key was created
    try {
      await expect(this.page.locator('text=Your API Key has been created successfully')).toBeVisible({ timeout: 30000 })
    } catch {
      // If success message not found, check for errors
      const errorMessages = await this.page.locator('.govuk-error-message, .error, [role="alert"]').allTextContents()
      if (errorMessages.length > 0) {
        throw new Error(`Form submission failed with errors: ${errorMessages.join(', ')}`)
      }
      throw new Error('Success message not found after form submission')
    }

    // Now look for the created API key element
    const apiKeyLocator = this.createdApiKey()

    try {
      await expect(apiKeyLocator).toBeVisible({ timeout: 10000 })
    } catch {
      // If element not found, log page state for debugging
      const currentUrl = this.page.url()
      const pageTitle = await this.page.title()

      throw new Error(`Could not find created API key element. URL: ${currentUrl}, Title: ${pageTitle}`)
    }

    // Assert we're on the create/confirmation page
    this.assertCreatePage()

    // Store the created key
    await this.storeKey(description)

    // Navigate back to FPO Keys list page (to see all keys including the one we just created)
    await this.backToDashboardLink().click()
    await this.page.waitForURL(/\/api_keys$/, { timeout: 10000 })

    // Assert we're back on FPO Keys list page
    this.assertFpoKeysPage()
    await expect(this.page.locator('h1')).toContainText('FPO keys', { timeout: 10000 })
  }

  async revokeKey(description: string): Promise<void> {
    await this.ensureOnFpoKeysPage()

    // Click revoke link for the key
    await this.revokeKeyLink(description).click()
    await this.page.waitForURL(/\/api_keys\/.*\/revoke/, { timeout: 10000 })

    // Assert we're on revoke confirmation page
    this.assertRevokeKeyPage()

    // Confirm revocation
    await this.revokeKeyButton().click()
    await this.page.waitForURL(/\/api_keys$/, { timeout: 10000 })

    // Assert we're back on FPO Keys page
    this.assertFpoKeysPage()
    await expect(this.page.locator('h1')).toContainText('FPO keys', { timeout: 10000 })

    // Verify the key shows as revoked
    await this.assertRevoked(description)
  }

  async deleteKey(description: string): Promise<void> {
    await this.ensureOnFpoKeysPage()

    // Click delete link for the key
    await this.deleteKeyLink(description).click()
    await this.page.waitForURL(/\/api_keys\/.*\/delete/, { timeout: 10000 })

    // Assert we're on delete confirmation page
    this.assertDeleteKeyPage()

    // Confirm deletion
    await this.deleteKeyButton().click()
    await this.page.waitForURL(/\/api_keys$/, { timeout: 10000 })

    // Assert we're back on FPO Keys page
    this.assertFpoKeysPage()
    await expect(this.page.locator('h1')).toContainText('FPO keys', { timeout: 10000 })

    // Verify the key is deleted
    await this.assertDeleted(description)
  }

  async assertRevoked(description: string): Promise<void> {
    const statusCell = this.revokedKeyStatus(description)

    await expect(statusCell).toHaveText(this.revokedDate())
  }

  async assertDeleted(description: string): Promise<void> {
    const keyRow = this.keyRow(description)

    await expect(keyRow).not.toBeVisible()
  }

  // Assert we're on the organisation account page (post-authentication landing page)
  assertOrganisationPage(): void {
    const currentUrl = this.page.url()
    expect(currentUrl).toMatch(/\/organisations\/[a-f0-9-]+/)
    // Optionally verify the page heading
    // Note: This is a synchronous assertion, so we can't await here
    // The heading check is done in login methods
  }

  // Assert we're on the FPO Keys page
  assertFpoKeysPage(): void {
    const currentUrl = this.page.url()
    expect(currentUrl).toMatch(/\/api_keys/)
    // Note: Heading check would be async, so we do it in methods that can await
  }

  // Legacy method for backward compatibility - checks for either page
  assertDashboardPage(): void {
    const currentUrl = this.page.url()
    // Accept either organisation page or FPO keys page
    expect(currentUrl).toMatch(/\/(organisations\/[a-f0-9-]+|api_keys)/)
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

  private async ensureOnFpoKeysPage(): Promise<void> {
    const currentUrl = this.page.url()
    if (/\/organisations\/[a-f0-9-]+/.test(currentUrl)) {
      await this.fpoKeysLink().click()
      await this.page.waitForURL(/\/api_keys$/, { timeout: 10000 })
    }
    this.assertFpoKeysPage()
    await expect(this.page.locator('h1')).toContainText('FPO keys', { timeout: 10000 })
  }

  private fpoKeysLink(): Locator {
    // Try to find FPO Keys link in navigation (case-insensitive)
    // Could be "FPO Keys", "FPO keys", or similar variations
    return this.page.getByRole('link', { name: /FPO keys?/i })
  }

  private createKeyButton(): Locator {
    return this.page.getByRole('link', { name: 'Create new key' })
  }

  private createKeyDescriptionInput(): Locator {
    return this.page.locator('#api-key-description-field')
  }

  private createKeySubmitButton(): Locator {
    return this.page.locator('button[type="submit"]').first()
  }

  private createdApiKey(): Locator {
    // Try multiple selectors - the API key might be in different formats
    // First try: code element with govuk-code class
    // Second try: any code element
    // Third try: pre > code
    return this.page.locator('code.govuk-code').or(this.page.locator('code')).first()
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

  private revokedKeyStatus(description: string): Locator {
    const rowLocator = this.keyRow(description)
    const statusCell = rowLocator.locator('td.govuk-table__cell:nth-child(4)')

    return statusCell
  }

  private keyRow(description: string): Locator {
    return this.page.locator(`//tr[td[contains(text(), "${description}")]]`)
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
