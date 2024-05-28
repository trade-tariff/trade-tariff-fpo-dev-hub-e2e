import { SignInPage } from './pages/signInPage'
import { DashboardPage } from './pages/dashboardPage'
import { ApiClient } from './utils/apiClient'

import { test } from '@playwright/test'

test('creating, using and revoking a customer api key', async ({ page }) => {
  const signInPage = new SignInPage(page)
  const dashboardPage = new DashboardPage(page)

  const keyDescription = `playwright-${Date.now()}`

  await signInPage.signIn()
  await dashboardPage.createKey(keyDescription)
  const apiClient = new ApiClient(dashboardPage.getKey(keyDescription))
  await apiClient.doClassification('haddock')
  apiClient.assertSuccessful()
  await apiClient.assertClassification('030364')

  await dashboardPage.revokeKey(keyDescription)
  await apiClient.doClassification('haddock', true)
  apiClient.assertUnsuccessful()
})
