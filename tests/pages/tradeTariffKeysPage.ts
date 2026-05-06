import { type Locator, expect, type Page } from '@playwright/test'

/**
 * Page object for Trade Tariff key lifecycle on the dev hub.
 */
export class TradeTariffKeysPage {
  private readonly page: Page
  private secrets: Record<string, string>

  constructor(page: Page) {
    this.page = page
    this.secrets = {}
  }

  async createKey(description: string): Promise<void> {
    this.assertDashboardPage()
    await this.navigateToTradeTariffKeysTab()

    await this.createKeyButton().click()
    this.assertNewKeyPage()

    await this.createKeyDescriptionInput().fill(description)
    await this.createKeySubmitButton().click()

    // Intermediate success page (not the keys table): summary, secret + copy, token URL and curl — see hub trade_tariff_keys/create.
    const scopesText = await this.assertPostCreateSuccessPageAndReadScopes(description)
    await this.storeSecret(description)

    await this.backToTradeTariffKeysLink().click()
    this.assertTradeTariffKeysPage()
    await this.assertKeyCreated(description, scopesText)
  }

  async revokeKey(description: string): Promise<void> {
    await this.ensureOnTradeTariffKeysPage()

    await this.revokeKeyLink(description).click()
    this.assertRevokeKeyPage()
    await this.assertRevokeConfirmationPage(description)

    await this.revokeKeyButton().click()
    this.assertTradeTariffKeysPage()
    await this.assertRevoked(description)
  }

  async deleteKey(description: string): Promise<void> {
    await this.ensureOnTradeTariffKeysPage()

    await this.deleteKeyLink(description).click()
    this.assertDeleteKeyPage()
    await this.assertDeleteConfirmationPage(description)

    await this.deleteKeyButton().click()
    this.assertTradeTariffKeysPage()
    await this.assertDeleted(description)
  }

  getSecret(description: string): string | null {
    if (description in this.secrets) return this.secrets[description]
    return null
  }

  /**
   * Asserts the post-create page: summary (client id, description, scopes), client secret + copy,
   * token endpoint and example curl. Returns scopes text to match on the index table after "Back".
   */
  private async assertPostCreateSuccessPageAndReadScopes(description: string): Promise<string> {
    await expect(this.page.getByRole('heading', { name: /Trade Tariff API key created/i })).toBeVisible()
    await expect(this.page.getByText(/Copy your client secret now/i)).toBeVisible()

    const summary = this.page.locator('dl.govuk-summary-list')
    await expect(summary).toBeVisible()

    const clientIdText = (await this.summaryValueForKey('Client ID').innerText()).trim()
    expect(clientIdText.length, 'Client ID should be shown on success page').toBeGreaterThan(0)

    await expect(this.summaryValueForKey('Description')).toHaveText(description)

    const scopesText = (await this.summaryValueForKey('Scopes').innerText()).trim()
    expect(scopesText.length, 'Scopes should be shown on success page').toBeGreaterThan(0)

    await expect(this.page.getByRole('heading', { name: /^Client secret$/i })).toBeVisible()
    await expect(this.createdClientSecret()).toBeVisible()
    await expect(this.copySecretButton()).toBeVisible()

    await expect(this.page.getByRole('heading', { name: /How to get an access token/i })).toBeVisible()
    await expect(this.page.getByText(/Use the token endpoint below/i)).toBeVisible()
    await expect(this.tokenEndpointCode()).toBeVisible()
    await expect(this.curlCommandBlock()).toBeVisible()
    await expect(this.copyCurlCommandButton()).toBeVisible()

    return scopesText
  }

  private summaryValueForKey(key: string): Locator {
    return this.page
      .locator('.govuk-summary-list__row')
      .filter({ has: this.page.locator('.govuk-summary-list__key', { hasText: key }) })
      .locator('.govuk-summary-list__value')
  }

  private async assertKeyCreated(description: string, scopesText: string): Promise<void> {
    const keyRow = this.keyRow(description)
    await expect(keyRow).toBeVisible()
    await expect(this.keyStatus(description)).toContainText(/active/i)
    await expect(this.keyDescription(description)).toContainText(description)
    await expect(this.keyScopes(description)).toContainText(scopesText)
    await expect(this.revokeKeyLink(description)).toBeVisible()
  }

  private async assertRevoked(description: string): Promise<void> {
    const keyRow = this.keyRow(description)
    await expect(keyRow).toBeVisible()
    await expect(this.keyStatus(description)).toContainText(/revoked/i)
    await expect(this.deleteKeyLink(description)).toBeVisible()
  }

  private async assertDeleted(description: string): Promise<void> {
    await expect(this.keyRow(description)).not.toBeVisible()
  }

  private async assertRevokeConfirmationPage(description: string): Promise<void> {
    await expect(this.page.getByText(/Your Trade Tariff API Key will be revoked with immediate effect/i)).toBeVisible()
    await expect(this.page.getByText(description)).toBeVisible()
  }

  private async assertDeleteConfirmationPage(description: string): Promise<void> {
    await expect(this.page.getByText(/Your Trade Tariff API Key will be deleted with immediate effect/i)).toBeVisible()
    await expect(this.page.getByText(description)).toBeVisible()
  }

  private assertDashboardPage(): void {
    expect(this.page.url()).toMatch(/\/organisations\/[0-9a-f-]+$/i)
  }

  private assertNewKeyPage(): void {
    expect(this.page.url()).toContain('/trade_tariff_keys/new')
  }

  private assertRevokeKeyPage(): void {
    expect(this.page.url()).toMatch(/\/trade_tariff_keys\/.*\/revoke/)
  }

  private assertDeleteKeyPage(): void {
    expect(this.page.url()).toMatch(/\/trade_tariff_keys\/.*\/delete/)
  }

  private assertTradeTariffKeysPage(): void {
    expect(this.page.url()).toContain('/trade_tariff_keys')
  }

  private async storeSecret(description: string): Promise<void> {
    const secret = (await this.createdClientSecret().innerText()).trim()
    this.secrets[description] = secret
  }

  private createKeyButton(): Locator {
    return this.page.getByRole('link', { name: 'Create new Trade Tariff key' })
  }

  private createKeyDescriptionInput(): Locator {
    return this.page.locator('input[name="trade_tariff_key_description"]')
  }

  private createKeySubmitButton(): Locator {
    return this.page.getByRole('button', { name: /continue/i })
  }

  private createdClientSecret(): Locator {
    return this.page.locator('#trade-tariff-client-secret')
  }

  private copySecretButton(): Locator {
    return this.page.getByRole('button', { name: /copy secret/i })
  }

  private tokenEndpointCode(): Locator {
    return this.page.locator('#trade-tariff-token-endpoint')
  }

  private curlCommandBlock(): Locator {
    return this.page.locator('#trade-tariff-curl-command')
  }

  private copyCurlCommandButton(): Locator {
    return this.page.getByRole('button', { name: /copy curl command/i })
  }

  private backToTradeTariffKeysLink(): Locator {
    return this.page.getByRole('link', { name: 'Back to Trade Tariff keys' })
  }

  private keyRow(description: string): Locator {
    return this.page.getByRole('row').filter({ hasText: description })
  }

  /** Status is the 5th column in Trade Tariff keys table. */
  private keyStatus(description: string): Locator {
    return this.keyRow(description).locator('td.govuk-table__cell:nth-child(5)')
  }

  private keyDescription(description: string): Locator {
    // Row starts with a <th> (Client ID), so the first <td> is Description.
    return this.keyRow(description).locator('td').nth(0)
  }

  /** Scopes column (3rd data column) on Trade Tariff keys index table. */
  private keyScopes(description: string): Locator {
    return this.keyRow(description).locator('td.govuk-table__cell:nth-child(3)')
  }

  private revokeKeyLink(description: string): Locator {
    return this.keyRow(description).getByRole('link', { name: 'Revoke' })
  }

  private deleteKeyLink(description: string): Locator {
    return this.keyRow(description).getByRole('link', { name: 'Delete' })
  }

  private revokeKeyButton(): Locator {
    return this.page.getByRole('button', { name: 'Revoke' })
  }

  private deleteKeyButton(): Locator {
    return this.page.getByRole('button', { name: 'Delete' })
  }

  private async navigateToTradeTariffKeysTab(): Promise<void> {
    await this.tradeTariffKeysTab().click()
    await this.page.waitForLoadState('networkidle')
  }

  private async ensureOnTradeTariffKeysPage(): Promise<void> {
    if (!this.page.url().includes('/trade_tariff_keys')) {
      if (this.page.url().match(/\/organisations\/[0-9a-f-]+$/i)) {
        await this.navigateToTradeTariffKeysTab()
      } else {
        const origin = this.page.url().split('/').slice(0, 3).join('/')
        await this.page.goto(`${origin}/trade_tariff_keys`)
        await this.page.waitForLoadState('networkidle')
      }
    }
  }

  private tradeTariffKeysTab(): Locator {
    return this.page.getByRole('link', { name: /Trade Tariff Keys/i }).or(
      this.page.getByRole('tab', { name: /Trade Tariff Keys/i })
    )
  }
}
