import { test, expect } from '@playwright/test'
import { mockDepartures, mockAllSites } from './mock-sl-api'

test.use({ permissions: ['clipboard-read', 'clipboard-write'] })

test('add, remove, clear, set a robust direction filter, copy, and apply', async ({ page }) => {
  await mockDepartures(page)
  await mockAllSites(page)
  await page.goto('/')
  await expect(page.locator('.section-title').first()).toBeVisible()

  await page.getByTitle('Konfigurera').click()
  const panel = page.locator('.configurator-panel')
  await expect(panel).toBeVisible()

  // Add a station via search
  await page.getByPlaceholder('Sök stationsnamn…').fill('Solna')
  await page.locator('.configurator-result-item', { hasText: 'Solna centrum' }).click()
  await expect(panel.locator('.configurator-card-name', { hasText: 'Solna centrum' })).toBeVisible()

  // Remove it again
  await panel
    .locator('.configurator-card', { hasText: 'Solna centrum' })
    .locator('.configurator-remove')
    .click()
  await expect(panel.locator('.configurator-card-name', { hasText: 'Solna centrum' })).toHaveCount(0)

  // Set a robust ("Riktning") and a specific ("Slutstation") direction filter on Duvbo.
  // DEFAULT_STATIONS seeds Duvbo with direction: 'stockholm', so the "Alla riktningar"
  // checkbox is already unchecked on load and there's already a pre-existing 'stockholm'
  // tag. Check it (direction -> 'all', clearing tags) then uncheck it (direction -> '',
  // no tags) to reach a clean, empty tag state before adding the two filters below.
  const duvboCard = panel.locator('.configurator-card', { hasText: 'Duvbo' })
  const duvboDirectionToggle = duvboCard.locator('.configurator-direction-toggle input[type="checkbox"]')
  await duvboDirectionToggle.check()
  await duvboDirectionToggle.uncheck()
  await duvboCard.locator('.configurator-direction-search').click()
  await expect(duvboCard.locator('.configurator-direction-group-label')).toHaveText(['Riktning', 'Slutstation'])
  await duvboCard.locator('.configurator-direction-dropdown button', { hasText: 'Kungsträdgården' }).click()
  await duvboCard.locator('.configurator-direction-search').click()
  await duvboCard.locator('.configurator-direction-dropdown button', { hasText: 'T-Centralen' }).click()
  // Each .configurator-tag span also contains a nested "×" remove button, so its
  // full textContent is e.g. "Kungsträdgården×" — assert containment, not exact text.
  await expect(duvboCard.locator('.configurator-tag')).toHaveCount(2)
  await expect(duvboCard.locator('.configurator-tag', { hasText: 'Kungsträdgården' })).toBeVisible()
  await expect(duvboCard.locator('.configurator-tag', { hasText: 'T-Centralen' })).toBeVisible()

  // Copy the generated URL and confirm the clipboard matches the preview
  const previewUrl = await panel.locator('.configurator-url-preview').textContent()
  await panel.locator('.configurator-actions .configurator-btn').first().click()
  const clipboardText = await page.evaluate(() => navigator.clipboard.readText())
  expect(clipboardText).toBe(previewUrl)
  expect(clipboardText).toContain('stations=')

  // Clear all stations
  await panel.getByRole('button', { name: 'Rensa alla' }).click()
  await expect(panel.locator('.configurator-card')).toHaveCount(0)
  await expect(panel.getByText('Inga stationer.')).toBeVisible()

  // Re-add Duvbo and apply
  await page.getByPlaceholder('Sök stationsnamn…').fill('Duvbo')
  await page.locator('.configurator-result-item', { hasText: 'Duvbo' }).click()
  const urlBeforeApply = page.url()
  await panel.locator('.configurator-btn-apply').click()
  await expect(panel).toHaveCount(0)
  expect(page.url()).not.toBe(urlBeforeApply)
  expect(page.url()).toContain('stations=')
})
