# Playwright end-to-end regression suite

## Problem

The project has solid Vitest/React Testing Library coverage (45 tests across
`utils.test.ts`, `DepartureRow.test.tsx`, `StationCard.test.tsx`,
`Configurator.test.tsx`, `useDepartures.test.ts`, `useStationSearch.test.ts`,
and an App-level `regression.test.tsx`), but all of it runs in jsdom with
sub-components frequently mocked out. There is no test that drives a real
browser against the actual built app, exercising full user journeys —
loading the board, configuring stations, and seeing the result — the way a
real user would.

## Goal

Add an end-to-end regression suite using Playwright that covers the user
journeys jsdom/RTL can't fully exercise, with the SL transit API mocked at
the network layer so tests are deterministic and require no live network
access.

## Non-goals

- Re-testing logic already covered by Vitest (matching, URL encoding,
  time formatting, individual component unit behavior). Playwright covers
  integration across the whole app, not unit-level edge cases.
- Visual/responsive regression testing (no visual-diffing tooling in place;
  would need its own spec if wanted later).
- Drag-to-reorder in the Configurator. Native HTML5 drag-and-drop is
  flaky under Playwright's synthetic input events, and this logic isn't
  covered by any existing test either — a pre-existing gap this suite
  doesn't need to close.
- Multi-browser matrix. Chromium only, to keep the suite fast; the app has
  no browser-specific code paths that would justify Firefox/WebKit runs.

## Design

### Tooling and structure

- Add `@playwright/test` as a devDependency.
- `playwright.config.ts` at the repo root:
  - `testDir: 'e2e'`
  - `projects: [{ name: 'chromium', use: devices['Desktop Chrome'] }]`
  - `webServer`: runs `pnpm build && pnpm preview` (tests exercise a real
    production build, not the Vite dev server), with `url` health-checked
    against the preview server's root before tests start.
  - `use.baseURL` pointing at the preview server's URL.
- `e2e/fixtures/` — JSON fixtures shaped like `DeparturesResponse`
  (`{ departures: Departure[] }`):
  - `default-departures.json` — Duvbo (siteId 9324, METRO) and Sundbyberg
    (siteId 9325, TRAIN + TRAM) departures, matching the app's
    `DEFAULT_STATIONS`. Includes at least one Duvbo departure with
    `destination: "T-Centralen"` / `direction: "Kungsträdgården"` (the real
    divergent case from the direction-matching robustness fix) so the
    Configurator flow spec can exercise both the "Riktning" and
    "Slutstation" option groups meaningfully.
  - `empty-departures.json` — `{ departures: [] }`.
  - `all-sites.json` — a flat array of `{ id, name }` objects (matching
    `useStationSearch`'s expected shape from
    `https://transport.integration.sl.se/v1/sites`), used by the "add a
    station" step. `useStationSearch` fetches this endpoint once per page
    load and caches the result in a module-level variable, so it must be
    mocked before the Configurator is opened.
- `e2e/mock-sl-api.ts` — a helper exporting functions like
  `mockDepartures(page, fixtureName)` and `mockDeparturesError(page)` that
  wrap `page.route('**/transport.integration.sl.se/v1/sites/*/departures', ...)`
  (per-station departures) and `mockAllSites(page)` wrapping
  `page.route('**/transport.integration.sl.se/v1/sites', ...)` (the
  station-search endpoint — note the exact-path match, no wildcard, so it
  doesn't overlap with the departures route's `/v1/sites/*/departures`
  pattern). Each returns `route.fulfill({ json: ... })` or
  `route.fulfill({ status: 500 })` / `route.abort()` for the error case.
  Centralizing route interception here means each spec's mocking is a
  one-line call, and the URL patterns are defined once.

### Spec files (one flow group per file)

1. **`e2e/board-rendering.spec.ts`**
   - Loading state (spinner) appears before departures resolve.
   - Default-stations board renders departures grouped by station/mode
     with the expected section titles ("Tunnelbana från Duvbo", etc.).
   - Empty-departures fixture renders "Inga avgångar just nu".
   - API-error fixture renders the error message and a "Försök igen" button
     that, when clicked, re-fetches (assert the mock route is hit again).

2. **`e2e/url-config.spec.ts`**
   - Navigating directly to a URL with a `?stations=` query (including a
     5th-field `=exact` direction keyword, e.g.
     `9324:Duvbo:METRO:10:%3DKungstr%C3%A4dg%C3%A5rden`) renders only the
     configured station/mode/direction combination, proving the URL parser
     and `matchesDirection`'s exact-match path integrate correctly against
     a real fetch-and-render cycle.

3. **`e2e/configurator-workflow.spec.ts`**
   - Open the Configurator via the gear button.
   - Add a station via the search box (using the `all-sites.json`
     fixture) and confirm a new station card appears.
   - Remove a station and confirm its card disappears.
   - Click "Rensa alla" and confirm the station list empties.
   - Re-add a station, toggle "Alla riktningar" off, open the direction
     dropdown, confirm both "Riktning" and "Slutstation" groups render,
     pick one option from each, and confirm both tags appear.
   - Click "Kopiera URL" and assert the clipboard contents (via
     `page.evaluate(() => navigator.clipboard.readText())`, with
     `contextOptions: { permissions: ['clipboard-read', 'clipboard-write'] }`
     set for this spec) match the visible URL preview.
   - Click "Använd" and confirm the browser URL changed and the board
     re-rendered to match the new configuration.

### CI

Add a step to `.github/workflows/deploy.yml`, after the existing `Test`
step and before `Build`:

```yaml
- name: Install Playwright browsers
  run: pnpm exec playwright install --with-deps chromium

- name: E2E tests
  run: pnpm test:e2e
```

A failing e2e test blocks the build/deploy steps, the same way a failing
`pnpm test` does today.

### package.json

Add `"test:e2e": "playwright test"`.

## Testing

This spec's own "testing" is the suite itself — there's no meta-test layer.
Success criteria: `pnpm test:e2e` passes locally and in CI, covering the
three flow groups above, with zero live network calls (verified by the
absence of any unmocked-route console warnings Playwright would otherwise
surface).
