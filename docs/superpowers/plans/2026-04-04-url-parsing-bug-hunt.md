# URL Parsing Bug Hunt Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Install Vitest, write targeted unit tests for `parseConfigFromQuery` and `buildQueryString`, and prove two existing round-trip bugs with failing tests.

**Architecture:** One new test file (`src/utils.test.ts`) tests the existing public interface without modifying source code. `parseConfigFromQuery` reads `window.location.search` directly, so tests use `Object.defineProperty` to stub `window.location` per test. Suites 1–3 establish correct baseline behaviour (should all pass). Suite 4 writes assertions that fail on the current code, proving the bugs exist.

**Tech Stack:** Vitest, jsdom (for `window.location`), TypeScript

---

## File Map

| File | Change |
|------|--------|
| `package.json` | Add `"test"` and `"test:watch"` scripts |
| `vite.config.ts` | Add `test: { environment: 'jsdom' }` block |
| `src/utils.test.ts` | **New** — all four test suites |

---

## Task 1: Install Vitest and configure jsdom

**Files:**
- Modify: `package.json`
- Modify: `vite.config.ts`

- [ ] **Step 1: Install vitest and jsdom**

```bash
cd /c/git/sl-dashboard && pnpm add -D vitest @vitest/coverage-v8 jsdom
```

Expected: packages added to `devDependencies`.

- [ ] **Step 2: Add test scripts to `package.json`**

In `package.json`, inside the `"scripts"` block, add:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: Configure Vitest environment in `vite.config.ts`**

Replace the contents of `vite.config.ts` with:

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE_PATH || '/',
  test: {
    environment: 'jsdom',
  },
})
```

- [ ] **Step 4: Create an empty test file to verify the runner works**

Create `src/utils.test.ts` with:

```ts
import { describe, it } from 'vitest'

describe('placeholder', () => {
  it('runs', () => {})
})
```

- [ ] **Step 5: Run tests to verify setup**

```bash
cd /c/git/sl-dashboard && pnpm test
```

Expected output contains:
```
✓ src/utils.test.ts (1)
Test Files  1 passed (1)
```

- [ ] **Step 6: Commit**

```bash
git add package.json vite.config.ts src/utils.test.ts pnpm-lock.yaml
git commit -m "test: install vitest with jsdom environment"
```

---

## Task 2: Suite 1 — `parseConfigFromQuery` valid inputs

**Files:**
- Modify: `src/utils.test.ts`

- [ ] **Step 1: Replace the placeholder with Suite 1**

Replace the entire contents of `src/utils.test.ts` with:

```ts
import { describe, it, expect } from 'vitest'
import { parseConfigFromQuery, buildQueryString } from './utils'
import { DEFAULT_STATIONS } from './constants'

function setLocation(search: string) {
  Object.defineProperty(window, 'location', {
    value: { search, origin: 'http://localhost', pathname: '/' },
    writable: true,
    configurable: true,
  })
}

// ─── Suite 1: parseConfigFromQuery — valid inputs ────────────────────────────

describe('parseConfigFromQuery — valid inputs', () => {
  it('parses a single station with all 5 fields', () => {
    setLocation('?stations=9324:Duvbo:METRO:10:stockholm')
    const { stations } = parseConfigFromQuery()
    expect(stations).toEqual([
      { siteId: 9324, name: 'Duvbo', mode: 'METRO', walkTime: 10, direction: 'stockholm' },
    ])
  })

  it('parses multiple stations', () => {
    setLocation('?stations=9324:Duvbo:METRO:10:stockholm,9325:Sundbyberg:TRAIN:15:all')
    const { stations } = parseConfigFromQuery()
    expect(stations).toEqual([
      { siteId: 9324, name: 'Duvbo', mode: 'METRO', walkTime: 10, direction: 'stockholm' },
      { siteId: 9325, name: 'Sundbyberg', mode: 'TRAIN', walkTime: 15, direction: 'all' },
    ])
  })

  it('uses legacy ?direction= param for a 4-field station', () => {
    setLocation('?stations=9324:Duvbo:METRO:10&direction=all')
    const { stations } = parseConfigFromQuery()
    expect(stations[0].direction).toBe('all')
  })

  it('defaults direction to "stockholm" when no 5th field and no legacy param', () => {
    setLocation('?stations=9324:Duvbo:METRO:10')
    const { stations } = parseConfigFromQuery()
    expect(stations[0].direction).toBe('stockholm')
  })

  it('decodes percent-encoded station names', () => {
    setLocation('?stations=9324:My%20Station:METRO:10:all')
    const { stations } = parseConfigFromQuery()
    expect(stations[0].name).toBe('My Station')
  })
})
```

- [ ] **Step 2: Run and verify Suite 1 passes**

```bash
cd /c/git/sl-dashboard && pnpm test
```

Expected:
```
✓ src/utils.test.ts (5)
  ✓ parseConfigFromQuery — valid inputs (5)
Test Files  1 passed (1)
```

- [ ] **Step 3: Commit**

```bash
git add src/utils.test.ts
git commit -m "test: Suite 1 — parseConfigFromQuery valid inputs"
```

---

## Task 3: Suite 2 — Silent drops and fallbacks

**Files:**
- Modify: `src/utils.test.ts`

- [ ] **Step 1: Append Suite 2 to `src/utils.test.ts`**

Add the following after the closing `})` of the Suite 1 `describe` block:

```ts
// ─── Suite 2: parseConfigFromQuery — silent drops and fallbacks ──────────────

describe('parseConfigFromQuery — silent drops and fallbacks', () => {
  it('returns DEFAULT_STATIONS when no ?stations= param', () => {
    setLocation('?')
    const { stations } = parseConfigFromQuery()
    expect(stations).toEqual(DEFAULT_STATIONS)
  })

  it('returns DEFAULT_STATIONS when all stations fail validation (silent fallback, not empty array)', () => {
    setLocation('?stations=abc:Duvbo:METRO:10:all')
    const { stations } = parseConfigFromQuery()
    expect(stations).toEqual(DEFAULT_STATIONS)
  })

  it('silently drops station with unknown mode, keeps valid ones', () => {
    setLocation('?stations=9324:Duvbo:METRO:10:all,9325:X:FERRY:10:all')
    const { stations } = parseConfigFromQuery()
    expect(stations).toHaveLength(1)
    expect(stations[0].siteId).toBe(9324)
  })

  it('silently drops station with NaN walkTime', () => {
    setLocation('?stations=9324:Duvbo:METRO:notanumber:all')
    const { stations } = parseConfigFromQuery()
    expect(stations).toEqual(DEFAULT_STATIONS)
  })

  it('silently drops station with NaN siteId', () => {
    setLocation('?stations=abc:Duvbo:METRO:10:all')
    const { stations } = parseConfigFromQuery()
    expect(stations).toEqual(DEFAULT_STATIONS)
  })
})
```

- [ ] **Step 2: Run and verify Suites 1–2 all pass**

```bash
cd /c/git/sl-dashboard && pnpm test
```

Expected:
```
✓ src/utils.test.ts (10)
  ✓ parseConfigFromQuery — valid inputs (5)
  ✓ parseConfigFromQuery — silent drops and fallbacks (5)
Test Files  1 passed (1)
```

- [ ] **Step 3: Commit**

```bash
git add src/utils.test.ts
git commit -m "test: Suite 2 — parseConfigFromQuery silent drops and fallbacks"
```

---

## Task 4: Suite 3 — `buildQueryString` encoding

**Files:**
- Modify: `src/utils.test.ts`

- [ ] **Step 1: Append Suite 3 to `src/utils.test.ts`**

Add the following after the closing `})` of the Suite 2 `describe` block:

```ts
// ─── Suite 3: buildQueryString — encoding ────────────────────────────────────

describe('buildQueryString — encoding', () => {
  it('round-trips a station name containing a colon', () => {
    const original = [{ siteId: 9324, name: 'Foo:Bar', mode: 'METRO' as const, walkTime: 10, direction: 'all' }]
    const url = buildQueryString(original)
    setLocation('?' + url.split('?')[1])
    const { stations } = parseConfigFromQuery()
    expect(stations[0].name).toBe('Foo:Bar')
  })

  it('round-trips a station name containing a comma', () => {
    const original = [{ siteId: 9324, name: 'Foo,Bar', mode: 'METRO' as const, walkTime: 10, direction: 'all' }]
    const url = buildQueryString(original)
    setLocation('?' + url.split('?')[1])
    const { stations } = parseConfigFromQuery()
    expect(stations[0].name).toBe('Foo,Bar')
  })

  it('round-trips a direction containing a pipe (normal multi-keyword)', () => {
    const original = [{ siteId: 9324, name: 'Duvbo', mode: 'METRO' as const, walkTime: 10, direction: 'stockholm|centralen' }]
    const url = buildQueryString(original)
    setLocation('?' + url.split('?')[1])
    const { stations } = parseConfigFromQuery()
    expect(stations[0].direction).toBe('stockholm|centralen')
  })
})
```

- [ ] **Step 2: Run and verify Suites 1–3 all pass**

```bash
cd /c/git/sl-dashboard && pnpm test
```

Expected:
```
✓ src/utils.test.ts (13)
  ✓ parseConfigFromQuery — valid inputs (5)
  ✓ parseConfigFromQuery — silent drops and fallbacks (5)
  ✓ buildQueryString — encoding (3)
Test Files  1 passed (1)
```

- [ ] **Step 3: Commit**

```bash
git add src/utils.test.ts
git commit -m "test: Suite 3 — buildQueryString encoding round-trips"
```

---

## Task 5: Suite 4 — Round-trip bugs (expected to fail)

**Files:**
- Modify: `src/utils.test.ts`

These tests are written to **fail on the current code**. The failures are the deliverable — they prove the bugs exist. Do not fix the source code.

- [ ] **Step 1: Append Suite 4 to `src/utils.test.ts`**

Add the following after the closing `})` of the Suite 3 `describe` block:

```ts
// ─── Suite 4: Round-trip bugs — these FAIL on current code ───────────────────
//
// BUG 1: buildQueryString does not encode the `direction` field.
//         The `:` and `,` characters are structural separators in the URL format.
//         A direction value containing either character silently corrupts the round-trip.

describe('round-trip bugs — FAIL on current code', () => {
  it('BUG: direction containing ":" is truncated after round-trip', () => {
    // buildQueryString writes direction raw: ...10:foo:bar
    // parseConfigFromQuery splits on ':' → parts[4] = 'foo', ':bar' is lost
    const original = [{ siteId: 9324, name: 'Duvbo', mode: 'METRO' as const, walkTime: 10, direction: 'foo:bar' }]
    const url = buildQueryString(original)
    setLocation('?' + url.split('?')[1])
    const { stations } = parseConfigFromQuery()
    expect(stations[0].direction).toBe('foo:bar') // actual: 'foo'
  })

  it('BUG: direction containing "," corrupts station list after round-trip', () => {
    // buildQueryString writes direction raw: ...10:foo,bar
    // parseConfigFromQuery splits on ',' first → 'bar' becomes a phantom entry,
    // fails validation and is dropped; direction is also truncated to 'foo'
    const original = [{ siteId: 9324, name: 'Duvbo', mode: 'METRO' as const, walkTime: 10, direction: 'foo,bar' }]
    const url = buildQueryString(original)
    setLocation('?' + url.split('?')[1])
    const { stations } = parseConfigFromQuery()
    expect(stations[0].direction).toBe('foo,bar') // actual: 'foo'
  })
})
```

- [ ] **Step 2: Run and verify Suite 4 fails**

```bash
cd /c/git/sl-dashboard && pnpm test
```

Expected output (Suite 4 failures prove the bugs):
```
❯ src/utils.test.ts (15)
  ✓ parseConfigFromQuery — valid inputs (5)
  ✓ parseConfigFromQuery — silent drops and fallbacks (5)
  ✓ buildQueryString — encoding (3)
  × round-trip bugs — FAIL on current code (2)
    × BUG: direction containing ":" is truncated after round-trip
      AssertionError: expected 'foo' to be 'foo:bar'
    × BUG: direction containing "," corrupts station list after round-trip
      AssertionError: expected 'foo' to be 'foo,bar'

Test Files  1 failed (1)
```

13 tests pass, 2 fail. The 2 failures are the bugs.

- [ ] **Step 3: Commit**

```bash
git add src/utils.test.ts
git commit -m "test: Suite 4 — prove direction encoding bugs with failing round-trip tests"
```

---

## Self-Review

**Spec coverage:**
- [x] Install Vitest + jsdom → Task 1
- [x] Suite 1 valid inputs → Task 2
- [x] Suite 2 silent drops/fallbacks → Task 3
- [x] Suite 3 encoding round-trips → Task 4
- [x] Suite 4 bug-proving failing tests → Task 5
- [x] `window.location` stub helper → Task 2 (in test file)

**Placeholder scan:** No TBDs. Every test has exact input, exact `expect`, and the comment in Suite 4 explains what the actual value will be when the test fails.

**Type consistency:** `'METRO' as const` used consistently in all round-trip tests. `StationConfig` shape matches `{ siteId, name, mode, walkTime, direction }` throughout.
