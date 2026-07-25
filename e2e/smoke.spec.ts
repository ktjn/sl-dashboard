import { test, expect } from '@playwright/test'

test('app shell loads', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.header')).toBeVisible()
  await expect(page.locator('.sl-logo')).toHaveText('SL')
})
