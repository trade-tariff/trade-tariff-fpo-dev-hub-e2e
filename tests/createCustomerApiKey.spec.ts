import { DashboardPage } from './pages/dashboardPage'
import { SignInPage } from './pages/signInPage'
import { ApiClient } from './utils/apiClient'

import { test } from '@playwright/test'

test('creating a customer api key', async ({ page }) => {
  const signInPage = new SignInPage(page)
  const dashboardPage = new DashboardPage(page)

  await signInPage.signIn('foo', 'bar')
  await dashboardPage.createKey('test')

  const apiClient = new ApiClient(dashboardPage.getKey('test'))
  await apiClient.doClassification('haddock')
  await apiClient.assertSuccessful()
  await apiClient.assertClassification('732690')
})
