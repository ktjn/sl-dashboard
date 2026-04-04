# URL Parsing Bug Hunt — Design Spec

**Goal:** Install Vitest and write targeted unit tests for `parseConfigFromQuery` and `buildQueryString` in `src/utils.ts` to find and document existing bugs.

**Approach:** Targeted hand-crafted tests. No property-based testing, no source refactoring — test the existing public interface as-is. Tests that expose bugs are written to fail on the current code; that failure is the point.

---

## Scope

Two functions in `src/utils.ts`:

- `parseConfigFromQuery()` — reads `window.location.search`, splits on `,` then `:`, validates fields, returns `AppConfig`
- `buildQueryString(stations)` — inverse: encodes each station as `siteId:name:mode:walkTime:direction`, joins with `,`

The `direction` field in `buildQueryString` is written **raw** (not encoded), while `name` is `encodeURIComponent`-encoded. Since `:` and `,` are structural separators in the format, a `direction` value containing either character will silently corrupt the round-trip. That is the primary bug this test suite is designed to surface.

---

## Setup

**Install:** `vitest` and `@vitest/jsdom` (or configure jsdom via `vite.config.ts`).

**`vite.config.ts`:** Add test config block:
```ts
test: {
  environment: 'jsdom',
}
```

**`package.json` scripts:**
```json
"test": "vitest run",
"test:watch": "vitest"
```

**Test file:** `src/utils.test.ts`

**`window.location` stub helper** (top of test file):
```ts
function setLocation(search: string) {
  Object.defineProperty(window, 'location', {
    value: { search, origin: 'http://localhost', pathname: '/' },
    writable: true,
    configurable: true,
  })
}
```

This is needed because `parseConfigFromQuery` reads `window.location.search` directly.

---

## Test Suites

### Suite 1 — `parseConfigFromQuery`: valid inputs

These should all pass. They establish baseline correct behaviour.

| Test | Input | Expected |
|------|-------|----------|
| Single station, all 5 fields | `?stations=9324:Duvbo:METRO:10:stockholm` | `[{ siteId: 9324, name: 'Duvbo', mode: 'METRO', walkTime: 10, direction: 'stockholm' }]` |
| Multiple stations | `?stations=9324:Duvbo:METRO:10:stockholm,9325:Sundbyberg:TRAIN:15:all` | Two stations correctly parsed |
| 4-field station + legacy direction | `?stations=9324:Duvbo:METRO:10&direction=all` | `direction: 'all'` from legacy param |
| 4-field station, no legacy param | `?stations=9324:Duvbo:METRO:10` | `direction: 'stockholm'` (hardcoded fallback) |
| Name with `%20` encoding | `?stations=9324:My%20Station:METRO:10:all` | `name: 'My Station'` (decoded) |

### Suite 2 — `parseConfigFromQuery`: silent drops and fallbacks

These document surprising silent behaviours.

| Test | Input | Expected | Note |
|------|-------|----------|------|
| No `?stations=` param | `?` | `DEFAULT_STATIONS` | Silent fallback |
| All stations invalid | `?stations=abc:Duvbo:METRO:10:all` | `DEFAULT_STATIONS` | Silent fallback — all-invalid → default, not empty |
| One valid + one unknown mode | `?stations=9324:Duvbo:METRO:10:all,9325:X:FERRY:10:all` | Only METRO station returned | Unknown mode silently dropped |
| NaN `walkTime` | `?stations=9324:Duvbo:METRO:notanumber:all` | `DEFAULT_STATIONS` | Station silently dropped |
| NaN `siteId` | `?stations=abc:Duvbo:METRO:10:all` | `DEFAULT_STATIONS` | Station silently dropped |

### Suite 3 — `buildQueryString`: encoding

These verify that `name` encoding is correct, establishing that name round-trips safely.

| Test | Input | Expected behaviour |
|------|-------|--------------------|
| Name with `:` | `{ name: 'Foo:Bar', ... }` | URL contains `Foo%3ABar`; round-trips back to `'Foo:Bar'` |
| Name with `,` | `{ name: 'Foo,Bar', ... }` | URL contains `Foo%2CBar`; round-trips back to `'Foo,Bar'` |
| Direction with `\|` | `{ direction: 'stockholm\|centralen', ... }` | URL contains `stockholm\|centralen`; round-trips correctly |

### Suite 4 — Round-trip bugs (tests expected to FAIL on current code)

These expose the real bugs. Write them as regular `expect` assertions. They will fail, proving the bugs are real.

| Test | Bug | Mechanism |
|------|-----|-----------|
| Direction with `:` | `buildQueryString` writes direction raw; `parseConfigFromQuery` splits on `:` — extra segments are ignored, direction is truncated | `{ direction: 'foo:bar' }` → URL: `...10:foo:bar` → parsed `direction`: `'foo'` |
| Direction with `,` | `buildQueryString` writes direction raw; `parseConfigFromQuery` splits on `,` first — `bar` becomes a phantom station entry that fails validation and is silently dropped | `{ direction: 'foo,bar' }` → URL: `...10:foo,bar` → parsed as two station entries; second fails validation |

---

## Success Criteria

- All Suite 1, 2, 3 tests pass
- Suite 4 tests fail with clear output showing the truncated/corrupted value
- Running `pnpm test` exits non-zero due to Suite 4 failures, making the bugs undeniable

The failing tests are the deliverable — they prove bugs exist and will serve as regression tests once the bugs are fixed.
