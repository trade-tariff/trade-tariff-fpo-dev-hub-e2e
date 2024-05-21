import { test, expect } from '@playwright/test';

const url = process.env.URL ?? 'https://hub.dev.trade-tariff.service.gov.uk/';

test('creating a customer api key', async ({ page }) => {
  await page.goto(url);

  await expect(page).toHaveTitle(/GOV.UK - The best place to find government services and information/);
});
