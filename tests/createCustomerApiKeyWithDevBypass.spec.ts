import { LoginPage } from './pages/loginPage'
import { DashboardPage } from './pages/dashboardPage'
import { type Classifiable, ApiClient } from './utils/apiClient'

import { test } from '@playwright/test'

const BYPASS_ENABLED = (process.env.BYPASS_ENABLED ?? 'false') === 'true'

if (BYPASS_ENABLED) {
  test('creating, using and revoking a customer api key with dev bypass', async ({ page }) => {
    const opts: Classifiable = {
      description: 'jewelry case',
      expectFailure: false
    }
    const loginPage = new LoginPage(page)
    const dashboardPage = new DashboardPage(page)

    const keyDescription = `playwright-dev-bypass-${Date.now()}`

    await loginPage.loginWithDevBypass()

    await dashboardPage.createKey(keyDescription)

    const apiClient = new ApiClient(dashboardPage.getKey(keyDescription))

    await apiClient.doClassification(opts)

    apiClient.assertSuccessful()
    apiClient.assertClassification('420292')

    await dashboardPage.revokeKey(keyDescription)

    opts.expectFailure = true
    await apiClient.doClassification(opts)
    apiClient.assertUnsuccessful()

    await dashboardPage.deleteKey(keyDescription)

    await loginPage.signOut()
  })
};
