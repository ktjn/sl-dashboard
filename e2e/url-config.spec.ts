import { test, expect } from '@playwright/test'
import { mockDepartures } from './mock-sl-api'

test('a deep-linked ?stations= URL with an exact-match direction keyword renders only the configured station/direction', async ({ page }) => {
  await mockDepartures(page)
  // 9324:Duvbo:METRO:10:=Kungsträdgården — the '=' exact-match keyword is
  // percent-encoded to %3D by encodeURIComponent, matching buildQueryString's encoding.
  await page.goto('/?stations=9324:Duvbo:METRO:10:%3DKungstr%C3%A4dg%C3%A5rden')

  await expect(page.locator('.section-title')).toHaveText(['Tunnelbana från Duvbo'])
  await expect(page.locator('.destination')).toHaveText(['T-Centralen'])
  await expect(page.getByText('Hjulsta')).toHaveCount(0)
})
