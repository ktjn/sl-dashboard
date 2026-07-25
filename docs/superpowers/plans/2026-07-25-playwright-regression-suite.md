# Playwright end-to-end regression suite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Chromium-only Playwright end-to-end suite covering the user journeys jsdom/RTL can't fully exercise (board rendering, deep-link URL config, and the Configurator workflow), with the SL transit API mocked at the network layer, wired into CI so a failing e2e test blocks deployment.

**Architecture:** Tests run against a real production build (`vite build && vite preview`) via Playwright's `webServer`. A shared `e2e/mock-sl-api.ts` helper wraps `page.route()` for the two SL endpoints the app calls (`/v1/sites/{id}/departures` and `/v1/sites`), backed by JSON fixtures under `e2e/fixtures/`. Three spec files cover the three flow groups from the design spec.

**Tech Stack:** `@playwright/test`, existing Vite/pnpm toolchain.

## Global Constraints

- Chromium only — no Firefox/WebKit projects (spec: "Multi-browser matrix... Chromium only").
- Tests exercise a real production build via `vite build && vite preview`, not the dev server (spec: "tests run against a real production build").
- No live network calls — every SL API request must be intercepted (spec: "zero live network calls").
- Drag-to-reorder and visual/responsive regression are out of scope (spec Non-goals).
- CI: add the e2e step to `.github/workflows/deploy.yml` after the existing `Test` step and before `Build`, so a failing e2e test blocks deploy (spec: "CI" section).

---

### Task 1: Playwright harness setup

**Files:**
- Modify: `package.json` (add `@playwright/test` devDependency, add `"test:e2e": "playwright test"` script)
- Create: `playwright.config.ts`
- Modify: `.gitignore`
- Create: `e2e/smoke.spec.ts`

**Interfaces:**
- Consumes: nothing (first task).
- Produces: a working `pnpm test:e2e` command that later tasks' spec files run under. `playwright.config.ts`'s `testDir` is `'./e2e'`, `baseURL` is `http://localhost:4173`.

- [ ] **Step 1: Install Playwright**

Run: `pnpm add -D @playwright/test`
Expected: `@playwright/test` added to `package.json` devDependencies, `pnpm-lock.yaml` updated.

- [ ] **Step 2: Install the Chromium browser binary**

Run: `pnpm exec playwright install --with-deps chromium`
Expected: Chromium downloads and installs successfully (on Windows, `--with-deps` is a no-op beyond the browser download itself).

- [ ] **Step 3: Add the `test:e2e` script**

In `package.json`, add this entry to `"scripts"` (alongside the existing `"test"` entry):

```json
    "test:e2e": "playwright test",
```

- [ ] **Step 4: Write `playwright.config.ts`**

Create `playwright.config.ts` at the repo root:

```ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'pnpm build && pnpm preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
})
```

- [ ] **Step 5: Fix the malformed `.gitignore` entry and add Playwright artifact directories**

Read `.gitignore` first — line 24 currently reads `*.sw?.superpowers/` (a pre-existing bug: two entries, `*.sw?` and `.superpowers/`, got concatenated onto one line with no newline between them, so neither pattern matches anything real and `.superpowers/` is NOT actually gitignored today). Replace that single line with:

```
*.sw?
.superpowers/

# Playwright
/test-results/
/playwright-report/
/playwright/.cache/
```

(Keep everything above line 24 unchanged.)

- [ ] **Step 6: Write a smoke test to prove the harness works**

Create `e2e/smoke.spec.ts`:

```ts
import { test, expect } from '@playwright/test'

test('app shell loads', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.header')).toBeVisible()
  await expect(page.locator('.sl-logo')).toHaveText('SL')
})
```

- [ ] **Step 7: Run the smoke test**

Run: `pnpm test:e2e`
Expected: PASS — 1 test passed. This builds the app (`vite build`), starts `vite preview` on port 4173, and confirms the header renders (departures will fail against the real network since nothing is mocked yet, but the header renders regardless of departure-fetch success/failure).

- [ ] **Step 8: Commit**

```bash
git add package.json pnpm-lock.yaml playwright.config.ts .gitignore e2e/smoke.spec.ts
git commit -m "test: add Playwright e2e harness with a smoke test"
```

---

### Task 2: SL API mock helper, fixtures, and board-rendering spec

**Files:**
- Create: `e2e/fixtures/default-departures.json`
- Create: `e2e/fixtures/all-sites.json`
- Create: `e2e/mock-sl-api.ts`
- Create: `e2e/board-rendering.spec.ts`
- Remove: `e2e/smoke.spec.ts` (superseded — its one assertion, that the header renders, is now covered by every spec in this file)

**Interfaces:**
- Consumes: nothing from Task 1 beyond the working harness (`playwright.config.ts`, `pnpm test:e2e`).
- Produces (used by Tasks 3 and 4):
  - `mockDepartures(page: Page, bySite?: DeparturesBySite, opts?: { delayMs?: number }): Promise<void>` — intercepts `**/transport.integration.sl.se/v1/sites/*/departures`, returning `bySite[siteId] ?? { departures: [] }` as JSON. Default `bySite` is the parsed contents of `default-departures.json`.
  - `mockDeparturesError(page: Page): Promise<void>` — intercepts the same pattern, always returns HTTP 500.
  - `mockAllSites(page: Page): Promise<void>` — intercepts `**/transport.integration.sl.se/v1/sites` (exact path, no wildcard) with the parsed contents of `all-sites.json`.
  - `type DeparturesBySite = Record<string, { departures: unknown[] }>`
  - `readFixture(relativePath: string): unknown` — reads and JSON-parses a file under `e2e/fixtures/`.
  - `e2e/fixtures/default-departures.json` shape: `{ "9324": { "departures": [...] }, "9325": { "departures": [...] } }` (siteId-keyed).
  - `e2e/fixtures/all-sites.json` shape: `[{ "id": number, "name": string }, ...]`.

- [ ] **Step 1: Write the departures fixture**

Create `e2e/fixtures/default-departures.json`:

```json
{
  "9324": {
    "departures": [
      {
        "destination": "Hjulsta",
        "direction": "Hjulsta",
        "display": "3 min",
        "scheduled": "2026-07-25T10:00:00Z",
        "expected": "2026-07-25T10:00:00Z",
        "line": { "id": 17, "designation": "17", "transport_mode": "METRO" }
      },
      {
        "destination": "T-Centralen",
        "direction": "Kungsträdgården",
        "display": "5 min",
        "scheduled": "2026-07-25T10:02:00Z",
        "expected": "2026-07-25T10:02:00Z",
        "line": { "id": 17, "designation": "17", "transport_mode": "METRO" }
      }
    ]
  },
  "9325": {
    "departures": [
      {
        "destination": "Stockholm City",
        "direction": "Stockholm City",
        "display": "4 min",
        "scheduled": "2026-07-25T10:01:00Z",
        "expected": "2026-07-25T10:01:00Z",
        "line": { "id": 40, "designation": "40", "transport_mode": "TRAIN" }
      },
      {
        "destination": "Sickla",
        "direction": "Sickla",
        "display": "6 min",
        "scheduled": "2026-07-25T10:03:00Z",
        "expected": "2026-07-25T10:03:00Z",
        "line": { "id": 30, "designation": "30", "transport_mode": "TRAM" }
      }
    ]
  }
}
```

This mirrors the real Duvbo split observed in production: the 9324 (Duvbo, METRO) departures include one that matches the default `'stockholm'` direction filter (`T-Centralen`/`Kungsträdgården` — `"kungsträdgården"` is in `STOCKHOLM_DIRECTIONS`) and one that doesn't (`Hjulsta`), so board-rendering assertions can confirm direction filtering works end-to-end. The 9325 (Sundbyberg) entries both match `'stockholm'` too (`"stockholm"` and `"sickla"` are both in `STOCKHOLM_DIRECTIONS`), so all three default `TransportSection`s (Duvbo METRO, Sundbyberg TRAIN, Sundbyberg TRAM) render.

- [ ] **Step 2: Write the all-sites fixture**

Create `e2e/fixtures/all-sites.json`:

```json
[
  { "id": 9324, "name": "Duvbo" },
  { "id": 9325, "name": "Sundbyberg" },
  { "id": 9192, "name": "Solna centrum" }
]
```

- [ ] **Step 3: Write the mock helper**

Create `e2e/mock-sl-api.ts`:

```ts
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
```

- [ ] **Step 4: Write the board-rendering spec**

Create `e2e/board-rendering.spec.ts`:

```ts
import { test, expect } from '@playwright/test'
import { mockDepartures, mockDeparturesError } from './mock-sl-api'

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
```

- [ ] **Step 5: Remove the superseded smoke test**

```bash
git rm e2e/smoke.spec.ts
```

- [ ] **Step 6: Run the new spec**

Run: `pnpm test:e2e`
Expected: PASS — 4 tests passed (0 from the removed smoke spec, 4 in `board-rendering.spec.ts`).

- [ ] **Step 7: Commit**

```bash
git add e2e/fixtures/default-departures.json e2e/fixtures/all-sites.json e2e/mock-sl-api.ts e2e/board-rendering.spec.ts
git commit -m "test: add SL API mock helper, fixtures, and board-rendering e2e spec"
```

---

### Task 3: URL deep-link config spec

**Files:**
- Create: `e2e/url-config.spec.ts`

**Interfaces:**
- Consumes: `mockDepartures` from `e2e/mock-sl-api.ts` (Task 2).
- Produces: nothing new — final flow-coverage spec besides Task 4.

- [ ] **Step 1: Write the spec**

Create `e2e/url-config.spec.ts`:

```ts
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
```

- [ ] **Step 2: Run the spec**

Run: `pnpm test:e2e e2e/url-config.spec.ts`
Expected: PASS — 1 test passed.

- [ ] **Step 3: Run the full e2e suite to confirm no regressions**

Run: `pnpm test:e2e`
Expected: PASS — 5 tests passed (4 from `board-rendering.spec.ts` + 1 from `url-config.spec.ts`).

- [ ] **Step 4: Commit**

```bash
git add e2e/url-config.spec.ts
git commit -m "test: add URL deep-link config e2e spec"
```

---

### Task 4: Configurator workflow spec

**Files:**
- Create: `e2e/configurator-workflow.spec.ts`

**Interfaces:**
- Consumes: `mockDepartures` and `mockAllSites` from `e2e/mock-sl-api.ts` (Task 2).
- Produces: nothing new — last spec file in the suite.

- [ ] **Step 1: Write the spec**

Create `e2e/configurator-workflow.spec.ts`:

```ts
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

  // Set a robust ("Riktning") and a specific ("Slutstation") direction filter on Duvbo
  const duvboCard = panel.locator('.configurator-card', { hasText: 'Duvbo' })
  await duvboCard.locator('.configurator-direction-toggle input[type="checkbox"]').uncheck()
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
```

- [ ] **Step 2: Run the spec**

Run: `pnpm test:e2e e2e/configurator-workflow.spec.ts`
Expected: PASS — 1 test passed.

- [ ] **Step 3: Run the full e2e suite to confirm no regressions**

Run: `pnpm test:e2e`
Expected: PASS — 6 tests passed (4 board-rendering + 1 url-config + 1 configurator-workflow).

- [ ] **Step 4: Commit**

```bash
git add e2e/configurator-workflow.spec.ts
git commit -m "test: add Configurator workflow e2e spec"
```

---

### Task 5: Wire the e2e suite into CI

**Files:**
- Modify: `.github/workflows/deploy.yml`

**Interfaces:**
- Consumes: `pnpm test:e2e` (Task 1) and the full spec suite (Tasks 2-4).
- Produces: nothing — final task.

- [ ] **Step 1: Add the e2e steps to the workflow**

In `.github/workflows/deploy.yml`, the current step order is:

```yaml
      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Test
        run: pnpm test

      - name: Build
        run: pnpm build
        env:
          VITE_BASE_PATH: ${{ steps.branch.outputs.base_path }}
```

Insert two new steps between `Test` and `Build`:

```yaml
      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Test
        run: pnpm test

      - name: Install Playwright browsers
        run: pnpm exec playwright install --with-deps chromium

      - name: E2E tests
        run: pnpm test:e2e

      - name: Build
        run: pnpm build
        env:
          VITE_BASE_PATH: ${{ steps.branch.outputs.base_path }}
```

- [ ] **Step 2: Verify the workflow YAML is well-formed**

Run: `pnpm exec js-yaml .github/workflows/deploy.yml > /dev/null && echo VALID`

If `js-yaml` isn't available as a dependency, instead verify with Python (present on the CI runner image and most dev machines): `python3 -c "import yaml, sys; yaml.safe_load(open('.github/workflows/deploy.yml')); print('VALID')"`. Either confirms the YAML parses without syntax errors before pushing.
Expected: `VALID` printed, no parse errors.

- [ ] **Step 3: Run the full local suite one more time as a final sanity check**

Run: `pnpm test && pnpm test:e2e`
Expected: PASS — 45 unit/component tests (`pnpm test`) and 6 e2e tests (`pnpm test:e2e`), all green.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "ci: run Playwright e2e suite before build/deploy"
```
