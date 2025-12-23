import { LoginPage } from './pages/loginPage'
import { DashboardPage } from './pages/dashboardPage'
import { type Classifiable, ApiClient } from './utils/apiClient'

import { test } from '@playwright/test'

test('creating, using and revoking a customer api key', async ({ page }) => {
  console.log(`[TEST] Starting test: creating, using and revoking a customer api key`)
  const opts: Classifiable = {
    description: 'jewelry case',
    expectFailure: false
  }
  const loginPage = new LoginPage(page)
  const dashboardPage = new DashboardPage(page)

  const keyDescription = `playwright-${Date.now()}`
  console.log(`[TEST] Generated key description: ${keyDescription}`)

  console.log(`[TEST] Step 1: Logging in`)
  await loginPage.login()
  console.log(`[TEST] Step 1: Login complete`)

  console.log(`[TEST] Step 2: Creating API key`)
  await dashboardPage.createKey(keyDescription)
  console.log(`[TEST] Step 2: API key created`)

  console.log(`[TEST] Step 3: Getting API key and creating client`)
  const apiClient = new ApiClient(dashboardPage.getKey(keyDescription))
  console.log(`[TEST] Step 3: API client created`)

  console.log(`[TEST] Step 4: Performing classification`)
  await apiClient.doClassification(opts)
  console.log(`[TEST] Step 4: Classification complete`)

  console.log(`[TEST] Step 5: Asserting successful classification`)
  apiClient.assertSuccessful()
  apiClient.assertClassification('420292')
  console.log(`[TEST] Step 5: Assertions passed`)

  console.log(`[TEST] Step 6: Revoking key`)
  await dashboardPage.revokeKey(keyDescription)
  console.log(`[TEST] Step 6: Key revoked`)

  console.log(`[TEST] Step 7: Testing classification with revoked key`)
  opts.expectFailure = true
  await apiClient.doClassification(opts)
  apiClient.assertUnsuccessful()
  console.log(`[TEST] Step 7: Revoked key test passed`)

  console.log(`[TEST] Step 8: Deleting key`)
  await dashboardPage.deleteKey(keyDescription)
  console.log(`[TEST] Step 8: Key deleted`)

  console.log(`[TEST] Step 9: Signing out`)
  await loginPage.signOut()
  console.log(`[TEST] Step 9: Signed out`)
  console.log(`[TEST] Test completed successfully: creating, using and revoking a customer api key`)
})
