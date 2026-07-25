# Direction-matching robustness fix

## Problem

The Configurator's destination picker (`StationCard.tsx`) only offers `destination`
values pulled from live departures (e.g. "T-Centralen", "Hjulsta") as suggestions
for building a direction filter. A train's `destination` is its specific terminus
for that run and can vary between trains that are physically heading the same
direction on the same line (e.g. some Duvbo-bound-toward-city trains show
"T-Centralen", others "Kungsträdgården", depending on where that particular train
terminates).

The SL API also returns a `direction` field on each departure — the stable,
canonical name for that line's direction (confirmed via a live call to
`https://transport.integration.sl.se/v1/sites/9324/departures`: trains destined
for both "T-Centralen" and "Kungsträdgården" all reported `direction: "Kungsträdgården"`
and `direction_code: 2`). This field is a far more robust value to filter on, but
today it's never surfaced in the UI — a user can only benefit from it by manually
typing the exact string into the search box, which isn't discoverable.

## Goal

Surface `direction` values as first-class, discoverable options in the Configurator,
distinguished from `destination` values, so users can build direction filters that
don't break when a specific train's terminus differs from the line's canonical
direction.

## Non-goals

- No change to the `StationConfig`/`AppConfig`/URL query format — `direction`
  remains a `'stockholm' | 'all' | keyword-string` field, fully backward compatible
  with existing shared URLs.
- No use of the numeric `direction_code` field — the human-readable `direction`
  string is sufficient for both matching and display, and keeps the data model
  (which already has `Departure.direction?: string`) unchanged.
- No change to `matchesDirection`'s matching algorithm in `utils.ts` — it already
  supports `=exact` keywords and already checks both `destination` and `direction`
  fields (case-insensitive). Only the *source* and *shape* of newly-added tags changes.

## Design

### Matching (`utils.ts`)

No code changes. `matchesDirection` already handles everything needed:
- `=exact` keywords do an exact (case-insensitive) match against `destination` or `direction`.
- Raw keywords do a substring match against both.

### Configurator UI (`StationCard.tsx`)

`getDestinationOptions` is replaced with two option builders that both filter by
`station.siteId` + `station.mode` and by the current search query:

- **Direction options**: unique `departure.direction` values.
- **Destination options**: unique `departure.destination` values, with any value
  already present in the direction set excluded (avoids showing the same string
  twice).

The dropdown renders two labeled groups, in this order:
1. **"Riktning"** — direction options. Selecting one calls
   `onAddDirectionTag` with an exact-match keyword: `` `=${value}` ``.
2. **"Slutstation"** — destination options. Selecting one calls
   `onAddDirectionTag` with the raw value, unchanged from today's behavior.

Each group is hidden if it has zero options after filtering (e.g. a query that
only matches destinations shows just the "Slutstation" group). If both are empty,
show the existing "Inga träffar" message.

### Tag display (`StationCard.tsx`)

Tag chips currently render the raw stored keyword. Exact-match keywords (leading
`=`) must render without the prefix — e.g. stored tag `=Kungsträdgården` displays
as `Kungsträdgården`. `removeDirectionTag` continues to operate on the full stored
(prefixed) value, so removal still works correctly; only the rendered label strips
the prefix.

### Edge cases

- A site/mode with no departures yet: both groups are empty, existing "Inga
  avgångar att välja från" disabled-input placeholder is unchanged.
- A `direction` value that happens to be identical to a `destination` value:
  deduped into the direction group only (per "Non-goals", we prefer the robust
  source when both exist).
- Legacy/manually-crafted URLs with raw (non-`=`) direction keywords: continue to
  substring-match as before — no behavior change for existing shared links.

## Testing

- `StationCard` unit tests: direction values appear as a distinct, labeled group
  before destination values; selecting a direction option calls `onAddDirectionTag`
  with an `=`-prefixed value; a stored `=`-prefixed tag renders without the `=`.
- `utils.test.ts`: no new tests needed for `matchesDirection` itself (already
  covered), but confirm existing exact-match tests still pass unchanged.
- Covered further by the Playwright regression suite (separate spec) once it
  exists, exercising the direction picker end-to-end against mocked departure data
  that includes divergent `destination`/`direction` values (mirroring the real
  Duvbo example above).
