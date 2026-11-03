import { test, expect } from '@playwright/test'
import { mockDepartures, mockDeparturesError, mockDeviations } from './mock-sl-api'

test('shows a loading spinner before departures resolve', async ({ page }) => {
  await mockDepartures(page, undefined, { delayMs: 500 })
  await page.goto('/')
  await expect(page.locator('.loading-spinner')).toBeVisible()
  await expect(page.locator('.transport-section').first()).toBeVisible()
  await expect(page.locator('.loading-spinner')).toHaveCount(0)
})

test('renders default stations grouped by station and mode, applying the direction filter', async ({ page }) => {
  await mockDepartures(page)
  await page.goto('/')

  const sectionTitles = page.locator('.section-title')
  await expect(sectionTitles).toHaveText([
    'Tunnelbana från Duvbo',
    'Pendeltåg från Sundbyberg',
    'Tvärbanan från Sundbyberg',
  ])

  // Kungsträdgården-direction Duvbo departure shows; the Hjulsta-direction one is filtered out
  await expect(page.locator('.destination')).toContainText(['T-Centralen', 'Stockholm City', 'Sickla'])
  await expect(page.getByText('Hjulsta')).toHaveCount(0)
})

test('shows an empty-state message when no departures match', async ({ page }) => {
  await mockDepartures(page, {})
  await page.goto('/')
  await expect(page.locator('.no-departures')).toContainText('Inga avgångar just nu')
})

test('shows an error message with a working retry button', async ({ page }) => {
  await mockDeparturesError(page)
  await page.goto('/')
  await expect(page.locator('.error')).toContainText('Kunde inte hämta avgångar')

  await page.unroute('**/transport.integration.sl.se/v1/sites/*/departures')
  await mockDepartures(page)
  await page.getByRole('button', { name: 'Försök igen' }).click()

  await expect(page.locator('.error')).toHaveCount(0)
  await expect(page.locator('.section-title').first()).toBeVisible()
})

test('shows major incident banner and inline station deviation', async ({ page }) => {
  await mockDepartures(page)
  await mockDeviations(page, {
    '9324': [
      {
        deviation_case_id: 1,
        priority: { importance_level: 8 },
        scope: { lines: [{ id: 17, transport_mode: 'METRO' }] },
        message_variants: [{ header: 'Stopp på gröna linjen', language: 'sv' }],
      },
      {
        deviation_case_id: 2,
        priority: { importance_level: 2 },
        scope: { lines: [{ id: 17, transport_mode: 'METRO' }] },
        message_variants: [{ header: 'Hissen ur funktion', language: 'sv' }],
      },
    ],
  })
  await page.goto('/')
  await expect(page.locator('.deviation-major')).toContainText('Stopp på gröna linjen')
  await expect(page.locator('.deviation-minor')).toContainText('Hissen ur funktion')
})
