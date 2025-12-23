import { LoginPage } from './pages/loginPage'
import { DashboardPage } from './pages/dashboardPage'
import { type Classifiable, ApiClient } from './utils/apiClient'

import { test } from '@playwright/test'

test('creating, using and revoking a customer api key with dev bypass', async ({ page }) => {
  console.log(`[TEST] Starting: creating, using and revoking a customer api key with dev bypass`)
  const opts: Classifiable = {
    description: 'jewelry case',
    expectFailure: false
  }
  const loginPage = new LoginPage(page)
  const dashboardPage = new DashboardPage(page)

  const keyDescription = `playwright-dev-bypass-${Date.now()}`
  console.log(`[TEST] Key description: ${keyDescription}`)

  console.log(`[TEST] Step 1: Login (dev bypass)`)
  await loginPage.loginWithDevBypass()
  console.log(`[TEST] Step 1 done`)

  console.log(`[TEST] Step 2: Create key`)
  await dashboardPage.createKey(keyDescription)
  console.log(`[TEST] Step 2 done`)

  console.log(`[TEST] Step 3: Create API client`)
  const apiClient = new ApiClient(dashboardPage.getKey(keyDescription))
  console.log(`[TEST] Step 3 done`)

  console.log(`[TEST] Step 4: Classify with active key`)
  await apiClient.doClassification(opts)
  console.log(`[TEST] Step 4 done`)

  console.log(`[TEST] Step 5: Assert success`)
  apiClient.assertSuccessful()
  apiClient.assertClassification('420292')
  console.log(`[TEST] Step 5 done`)

  console.log(`[TEST] Step 6: Revoke key`)
  await dashboardPage.revokeKey(keyDescription)
  console.log(`[TEST] Step 6 done`)

  console.log(`[TEST] Step 7: Classify with revoked key (expect failure)`)
  opts.expectFailure = true
  await apiClient.doClassification(opts)
  apiClient.assertUnsuccessful()
  console.log(`[TEST] Step 7 done`)

  console.log(`[TEST] Step 8: Delete key`)
  await dashboardPage.deleteKey(keyDescription)
  console.log(`[TEST] Step 8 done`)

  console.log(`[TEST] Step 9: Sign out`)
  await loginPage.signOut()
  console.log(`[TEST] Step 9 done`)

  console.log(`[TEST] Finished: creating, using and revoking a customer api key with dev bypass`)
})
