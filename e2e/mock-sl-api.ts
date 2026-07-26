import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { Page } from '@playwright/test'

export type DeparturesBySite = Record<string, { departures: unknown[] }>

const FIXTURES_DIR = fileURLToPath(new URL('./fixtures/', import.meta.url))

export function readFixture(relativePath: string): unknown {
  return JSON.parse(readFileSync(`${FIXTURES_DIR}${relativePath}`, 'utf-8'))
}

const DEFAULT_DEPARTURES = readFixture('default-departures.json') as DeparturesBySite
const ALL_SITES = readFixture('all-sites.json')

const DEPARTURES_URL = '**/transport.integration.sl.se/v1/sites/*/departures'
const SITES_URL = '**/transport.integration.sl.se/v1/sites'

export async function mockDepartures(
  page: Page,
  bySite: DeparturesBySite = DEFAULT_DEPARTURES,
  opts: { delayMs?: number } = {}
): Promise<void> {
  await page.route(DEPARTURES_URL, async route => {
    if (opts.delayMs) await new Promise(resolve => setTimeout(resolve, opts.delayMs))
    const match = route.request().url().match(/\/sites\/(\d+)\/departures/)
    const siteId = match?.[1]
    const body = (siteId && bySite[siteId]) || { departures: [] }
    await route.fulfill({ json: body })
  })
}

export async function mockDeparturesError(page: Page): Promise<void> {
  await page.route(DEPARTURES_URL, route => route.fulfill({ status: 500, body: 'Internal Server Error' }))
}

export async function mockAllSites(page: Page): Promise<void> {
  await page.route(SITES_URL, route => route.fulfill({ json: ALL_SITES }))
}
