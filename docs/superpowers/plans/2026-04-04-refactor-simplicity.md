# Refactor: Simplicity & Maintainability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove duplicated constants, fix a per-station departure filtering bug, and split the oversized Configurator component into focused pieces.

**Architecture:** All changes are additive simplifications — no new abstractions, no new files except one extracted component. Verification at each step uses `tsc` + `lint` (no test framework is installed).

**Tech Stack:** React 19, TypeScript 6, Vite — no test runner.

---

## Issues Found

| # | File | Problem |
|---|------|---------|
| 1 | `App.tsx:10-15` | `SECTION_NAMES` duplicates `TRANSPORT_TYPES[mode].name` from constants |
| 2 | `Configurator.tsx:13-18` | `MODE_LABELS` duplicates `TRANSPORT_TYPES[mode].name` from constants |
| 3 | `utils.ts:31-41` | `getLineColor` switch fallback duplicates `TRANSPORT_TYPES[mode].bgColor` |
| 4 | `useDepartures.ts:53-55` | `allMatched` filter is always true — `uniqueSiteIds` was built from `stations` |
| 5 | `useDepartures.ts:77` | `JSON.stringify(stations)` dep hack — `stations` is already a stable reference |
| 6 | `useDepartures.ts:58-65` | Filtered departures strip `originSiteId`, so `TransportSection` can't separate two same-mode stations |
| 7 | `Configurator.tsx` | 332 lines — the per-station card is a natural standalone component |

---

## File Map

| File | Change |
|------|--------|
| `src/constants.ts` | No change (already the single source of truth for mode metadata) |
| `src/utils.ts` | Simplify `getLineColor` fallback |
| `src/hooks/useDepartures.ts` | Remove redundant filter, fix dep, keep `originSiteId` in `departures` |
| `src/App.tsx` | Remove `SECTION_NAMES`, use `TRANSPORT_TYPES`, pre-filter departures per station |
| `src/components/TransportSection.tsx` | Remove internal mode filter (App now pre-filters per station) |
| `src/components/Configurator.tsx` | Remove `MODE_LABELS`, extract station card to new file |
| `src/components/StationCard.tsx` | **New** — extracted per-station card with all its handlers as props |

---

## Task 1: Deduplicate transport mode label constants

**Files:**
- Modify: `src/App.tsx:1-16`
- Modify: `src/components/Configurator.tsx:1-20`

### Problem
`SECTION_NAMES` in App.tsx and `MODE_LABELS` in Configurator.tsx are separate `Record<TransportMode, string>` maps that duplicate `.name` values already in `TRANSPORT_TYPES` (constants.ts).

- [ ] **Step 1: Remove `SECTION_NAMES` from App.tsx, use `TRANSPORT_TYPES`**

In `src/App.tsx`, delete lines 10-15:
```ts
const SECTION_NAMES: Record<TransportMode, string> = {
  METRO: 'Tunnelbana',
  TRAIN: 'Pendeltåg',
  TRAM: 'Tvärbanan',
  BUS: 'Buss',
}
```

Update the import to include `TRANSPORT_TYPES`:
```ts
import { TRANSPORT_TYPES } from './constants'
```

Update the `TransportSection` title prop (line ~103):
```tsx
title={`${TRANSPORT_TYPES[station.mode].name} från ${station.name}`}
```

Remove the unused `TransportMode` import from `./types` if it's no longer needed (it's not used elsewhere in App.tsx after this change).

- [ ] **Step 2: Remove `MODE_LABELS` from Configurator.tsx, use `TRANSPORT_TYPES`**

In `src/components/Configurator.tsx`, delete lines 13-18:
```ts
const MODE_LABELS: Record<TransportMode, string> = {
  METRO: 'Tunnelbana',
  TRAIN: 'Pendeltåg',
  TRAM: 'Spårvagn',
  BUS: 'Buss',
}
```

Add `TRANSPORT_TYPES` to the import from `../constants`:
```ts
import { TRANSPORT_TYPES } from '../constants'
```

Update the `<option>` label (line ~207):
```tsx
<option key={m} value={m}>{TRANSPORT_TYPES[m].name}</option>
```

- [ ] **Step 3: Verify**

```bash
cd /c/git/sl-dashboard && pnpm tsc && pnpm lint
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx src/components/Configurator.tsx
git commit -m "refactor: remove duplicate mode label maps, use TRANSPORT_TYPES.name"
```

---

## Task 2: Simplify `getLineColor` fallback

**Files:**
- Modify: `src/utils.ts:31-41`

### Problem
The `switch` fallback in `getLineColor` repeats the same hex values already stored in `TRANSPORT_TYPES[mode].bgColor`. When a new mode is added or a color changes, this requires updating two places.

- [ ] **Step 1: Replace switch with `TRANSPORT_TYPES` lookup**

In `src/utils.ts`, update the import:
```ts
import { LINE_COLORS, STOCKHOLM_DIRECTIONS, DEFAULT_STATIONS, TRANSPORT_TYPES } from './constants'
```

Replace the `getLineColor` function body:
```ts
export function getLineColor(lineId: number, transportMode: TransportMode): string {
  return LINE_COLORS[lineId] ?? TRANSPORT_TYPES[transportMode]?.bgColor ?? '#666666'
}
```

- [ ] **Step 2: Verify**

```bash
cd /c/git/sl-dashboard && pnpm tsc && pnpm lint
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/utils.ts
git commit -m "refactor: getLineColor fallback uses TRANSPORT_TYPES.bgColor"
```

---

## Task 3: Clean up `useDepartures` — redundant filter and JSON.stringify dep

**Files:**
- Modify: `src/hooks/useDepartures.ts`

### Problem A: Redundant `allMatched` filter
`withOrigin` is built by mapping over `uniqueSiteIds`, which was itself derived from `stations`. So the `allMatched` filter `stations.some(s => s.siteId === originSiteId)` is always true — every entry in `withOrigin` comes from a known site.

### Problem B: `JSON.stringify` dep hack
`stations` comes from `config.stations`, and `config` is `useMemo(() => parseConfigFromQuery(), [])` in App.tsx — it never changes reference during a session (the Configurator applies changes by navigating to a new URL). So `JSON.stringify(stations)` is unnecessary and confusing; `stations` itself can be the dep.

- [ ] **Step 1: Remove redundant allMatched filter**

In `src/hooks/useDepartures.ts`, replace:
```ts
// All departures for configured sites (all modes), before direction filter
const allMatched = withOrigin.filter(({ originSiteId }) =>
  stations.some(s => s.siteId === originSiteId)
)

// Direction-filtered departures shown on the board
const filtered = withOrigin
```

With:
```ts
// Direction-filtered departures shown on the board
const filtered = withOrigin
```

And update the `setAllDepartures` call:
```ts
setAllDepartures(withOrigin)
```

(Remove `setAllDepartures(allMatched)` line.)

- [ ] **Step 2: Fix the JSON.stringify dep**

Replace:
```ts
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [JSON.stringify(stations)])
```

With:
```ts
}, [stations])
```

- [ ] **Step 3: Verify**

```bash
cd /c/git/sl-dashboard && pnpm tsc && pnpm lint
```

Expected: no errors, no eslint-disable comments needed.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useDepartures.ts
git commit -m "refactor: remove redundant allMatched filter and JSON.stringify dep hack"
```

---

## Task 4: Fix per-station departure separation

**Files:**
- Modify: `src/hooks/useDepartures.ts`
- Modify: `src/App.tsx`
- Modify: `src/components/TransportSection.tsx`

### Problem
`useDepartures` returns `Departure[]` for `departures` (having stripped `originSiteId`). When two stations of the same mode are configured (e.g., two METRO stations at different sites), `TransportSection` can't tell them apart — it filters only by `transportMode`, so both sections show the same merged list. Fix: keep `originSiteId` in `departures`, pre-filter per station in `App.tsx`, pass a clean `Departure[]` slice to each `TransportSection`.

- [ ] **Step 1: Change `departures` return type to `SiteDeparture[]` in useDepartures**

In `src/hooks/useDepartures.ts`, update the interface:
```ts
interface UseDeparturesResult {
  departures: SiteDeparture[]       // was Departure[]
  allDepartures: SiteDeparture[]
  loading: boolean
  error: string | null
  lastUpdate: Date | null
  refetch: () => void
}
```

Update the state and the `filtered` assignment — stop stripping `originSiteId`:
```ts
const [departures, setDepartures] = useState<SiteDeparture[]>([])
```

Change:
```ts
const filtered = withOrigin
  .filter(({ departure: d, originSiteId }) => {
    const station = stations.find(s => s.siteId === originSiteId && s.mode === d.line.transport_mode)
    if (!station) return false
    return matchesDirection(d, station.direction)
  })
  .map(({ departure }) => departure)

setDepartures(filtered)
```

To:
```ts
const filtered = withOrigin.filter(({ departure: d, originSiteId }) => {
  const station = stations.find(s => s.siteId === originSiteId && s.mode === d.line.transport_mode)
  if (!station) return false
  return matchesDirection(d, station.direction)
})

setDepartures(filtered)
```

- [ ] **Step 2: Pre-filter departures per station in App.tsx**

In `src/App.tsx`, update the `departures.length === 0` guard and the section render. Currently `departures` is `Departure[]`; it's now `SiteDeparture[]`. Update:

The loading guard line:
```tsx
{!loading && departures.length === 0 && (
```
Stays the same (`.length` still works on `SiteDeparture[]`).

Update the `TransportSection` block to pre-filter:
```tsx
{!loading && departures.length > 0 && (
  <>
    {stations.map((station, index) => {
      const stationDepartures = departures
        .filter(d => d.originSiteId === station.siteId && d.departure.line.transport_mode === station.mode)
        .map(d => d.departure)
      return (
        <TransportSection
          key={`${station.siteId}-${station.mode}-${index}`}
          title={`${TRANSPORT_TYPES[station.mode].name} från ${station.name}`}
          departures={stationDepartures}
          currentTime={currentTime}
          walkingTime={station.walkTime}
        />
      )
    })}
  </>
)}
```

Note: `transportMode` prop is no longer needed on `TransportSection` since filtering is done before passing.

- [ ] **Step 3: Simplify TransportSection — remove internal mode filter**

In `src/components/TransportSection.tsx`, remove `transportMode` from props and remove the `.filter()`:

```tsx
interface TransportSectionProps {
  title: string
  departures: Departure[]
  currentTime: Date
  walkingTime: number
}

export default function TransportSection({ title, departures, currentTime, walkingTime }: TransportSectionProps) {
  const shownDepartures = departures.slice(0, 6)

  if (shownDepartures.length === 0) return null

  return (
    <div className="transport-section">
      <div className="section-header">
        <span className="section-title">{title}</span>
        <span className="walking-time">{walkingTime} min gångväg</span>
      </div>
      <div className="departures-list">
        {shownDepartures.map((dep, idx) => (
          <DepartureRow
            key={`${dep.journey?.id || idx}-${dep.scheduled}`}
            departure={dep}
            currentTime={currentTime}
            walkingTime={walkingTime}
          />
        ))}
      </div>
    </div>
  )
}
```

Wait — the section header also renders the transport icon via `typeConfig`. We need to keep that. The icon should come from the departure's own mode, which is uniform per section (since App pre-filters by mode). Read the first departure's mode to get the icon:

```tsx
import { TRANSPORT_TYPES } from '../constants'
import type { Departure } from '../types'
import DepartureRow from './DepartureRow'

interface TransportSectionProps {
  title: string
  departures: Departure[]
  currentTime: Date
  walkingTime: number
}

export default function TransportSection({ title, departures, currentTime, walkingTime }: TransportSectionProps) {
  const shownDepartures = departures.slice(0, 6)
  if (shownDepartures.length === 0) return null

  const typeConfig = TRANSPORT_TYPES[shownDepartures[0].line.transport_mode]

  return (
    <div className="transport-section">
      <div className="section-header">
        <div className="transport-icon" style={{ backgroundColor: typeConfig.bgColor, color: typeConfig.color }}>
          {typeConfig.icon}
        </div>
        <span className="section-title">{title}</span>
        <span className="walking-time">{walkingTime} min gångväg</span>
      </div>
      <div className="departures-list">
        {shownDepartures.map((dep, idx) => (
          <DepartureRow
            key={`${dep.journey?.id || idx}-${dep.scheduled}`}
            departure={dep}
            currentTime={currentTime}
            walkingTime={walkingTime}
          />
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Verify**

```bash
cd /c/git/sl-dashboard && pnpm tsc && pnpm lint
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useDepartures.ts src/App.tsx src/components/TransportSection.tsx
git commit -m "fix: separate departures per station — prevents same-mode stations from merging"
```

---

## Task 5: Extract StationCard from Configurator

**Files:**
- Create: `src/components/StationCard.tsx`
- Modify: `src/components/Configurator.tsx`

### Problem
`Configurator.tsx` is 332 lines. The per-station card (lines ~182–280) is a natural unit with clear inputs (station data, available departures, direction query state) and callbacks (update, remove, drag, direction tag management). Extracting it makes both files easier to read.

- [ ] **Step 1: Create `src/components/StationCard.tsx`**

```tsx
import type { StationConfig, TransportMode } from '../types'
import type { SiteDeparture } from '../hooks/useDepartures'
import { TRANSPORT_TYPES } from '../constants'

const MODES: TransportMode[] = ['METRO', 'TRAIN', 'TRAM', 'BUS']

interface StationCardProps {
  station: StationConfig
  index: number
  isDragging: boolean
  directionQuery: string
  directionDropdownOpen: boolean
  availableDepartures: SiteDeparture[]
  onUpdate: (patch: Partial<StationConfig>) => void
  onRemove: () => void
  onDragStart: () => void
  onDrop: () => void
  onDragEnd: () => void
  onDirectionQueryChange: (value: string) => void
  onDirectionDropdownOpen: () => void
  onDirectionDropdownClose: () => void
  onAddDirectionTag: (tag: string) => void
  onRemoveDirectionTag: (tag: string) => void
}

function getDirectionTags(direction: string): string[] {
  if (direction === 'all') return []
  return direction.split('|').filter(Boolean)
}

function getDestinationOptions(
  station: StationConfig,
  availableDepartures: SiteDeparture[],
  query: string
): string[] {
  const allDestinations = availableDepartures
    .filter(({ departure: d, originSiteId }) =>
      originSiteId === station.siteId && d.line.transport_mode === station.mode
    )
    .map(({ departure: d }) => d.destination)
  const unique = [...new Set(allDestinations)]
  const q = query.trim().toLowerCase()
  if (!q) return unique
  return unique.filter(dest => dest.toLowerCase().includes(q))
}

export default function StationCard({
  station,
  index,
  isDragging,
  directionQuery,
  directionDropdownOpen,
  availableDepartures,
  onUpdate,
  onRemove,
  onDragStart,
  onDrop,
  onDragEnd,
  onDirectionQueryChange,
  onDirectionDropdownOpen,
  onDirectionDropdownClose,
  onAddDirectionTag,
  onRemoveDirectionTag,
}: StationCardProps) {
  const availableModes = availableDepartures.some(d => d.originSiteId === station.siteId)
    ? MODES.filter(m => availableDepartures.some(d =>
        d.originSiteId === station.siteId && d.departure.line.transport_mode === m
      ))
    : MODES

  const tags = getDirectionTags(station.direction)
  const options = getDestinationOptions(station, availableDepartures, directionQuery)

  return (
    <div
      key={`${station.siteId}-${station.mode}-${index}`}
      className={`configurator-card${isDragging ? ' dragging' : ''}`}
      draggable
      onDragStart={onDragStart}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
    >
      <div className="configurator-drag-handle">⠿</div>
      <div className="configurator-card-fields">
        <div className="configurator-card-name">{station.name}</div>
        <div className="configurator-card-row">
          <select
            className="configurator-select"
            value={station.mode}
            onChange={e => onUpdate({ mode: e.target.value as TransportMode, direction: 'all' })}
          >
            {availableModes.map(m => (
              <option key={m} value={m}>{TRANSPORT_TYPES[m].name}</option>
            ))}
          </select>
          <input
            className="configurator-walk-input"
            type="number"
            min={0}
            max={60}
            value={station.walkTime}
            onChange={e => onUpdate({ walkTime: parseInt(e.target.value, 10) || 0 })}
          />
          <span className="configurator-walk-label">min</span>
        </div>
        <div className="configurator-direction">
          <label className="configurator-direction-toggle">
            <input
              type="checkbox"
              checked={station.direction === 'all'}
              onChange={e => onUpdate({ direction: e.target.checked ? 'all' : '' })}
            />
            Alla riktningar
          </label>
          {station.direction !== 'all' && (
            <div className="configurator-direction-tags">
              {tags.map(tag => (
                <span key={tag} className="configurator-tag">
                  {tag}
                  <button
                    className="configurator-tag-remove"
                    onClick={() => onRemoveDirectionTag(tag)}
                  >×</button>
                </span>
              ))}
              <div className="configurator-direction-search-wrap">
                <input
                  className="configurator-direction-search"
                  placeholder={availableDepartures.length === 0 ? 'Inga avgångar att välja från' : 'Lägg till destination…'}
                  disabled={availableDepartures.length === 0}
                  value={directionQuery}
                  onChange={e => {
                    onDirectionQueryChange(e.target.value)
                    onDirectionDropdownOpen()
                  }}
                  onFocus={onDirectionDropdownOpen}
                  onBlur={() => setTimeout(onDirectionDropdownClose, 150)}
                />
                {directionDropdownOpen && (
                  <div className="configurator-direction-dropdown">
                    {options.length === 0 ? (
                      <div className="configurator-result-item configurator-result-status">Inga träffar</div>
                    ) : (
                      options.map(dest => (
                        <button
                          key={dest}
                          className="configurator-result-item"
                          onMouseDown={() => onAddDirectionTag(dest)}
                        >
                          {dest}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      <button className="configurator-remove" onClick={onRemove}>✕</button>
    </div>
  )
}
```

- [ ] **Step 2: Update `Configurator.tsx` to use `StationCard`**

Remove the `MODE_LABELS` constant (already done in Task 1), the `getDirectionTags` and `getDestinationOptions` functions (now in StationCard), and the inline card JSX. Replace with:

```ts
import StationCard from './StationCard'
```

The full station list section in `Configurator.tsx` becomes:

```tsx
{stations.map((station, index) => (
  <StationCard
    key={`${station.siteId}-${station.mode}-${index}`}
    station={station}
    index={index}
    isDragging={dragIndex === index}
    directionQuery={directionQueries[index] ?? ''}
    directionDropdownOpen={directionDropdownOpen === index}
    availableDepartures={availableDepartures}
    onUpdate={(patch) => updateStation(index, patch)}
    onRemove={() => removeStation(index)}
    onDragStart={() => handleDragStart(index)}
    onDrop={() => handleDrop(index)}
    onDragEnd={() => setDragIndex(null)}
    onDirectionQueryChange={(value) =>
      setDirectionQueries(prev => prev.map((q, i) => (i === index ? value : q)))
    }
    onDirectionDropdownOpen={() => setDirectionDropdownOpen(index)}
    onDirectionDropdownClose={() => setDirectionDropdownOpen(null)}
    onAddDirectionTag={(tag) => addDirectionTag(index, tag)}
    onRemoveDirectionTag={(tag) => removeDirectionTag(index, tag)}
  />
))}
```

Also remove `TRANSPORT_TYPES` import if it was only used for MODE_LABELS (after Task 1, it may still be needed — keep if referenced).

- [ ] **Step 3: Verify**

```bash
cd /c/git/sl-dashboard && pnpm tsc && pnpm lint
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/StationCard.tsx src/components/Configurator.tsx
git commit -m "refactor: extract StationCard component from Configurator"
```

---

## Self-Review

**Spec coverage:**
- [x] Duplicate `SECTION_NAMES` / `MODE_LABELS` → Task 1
- [x] Duplicate `getLineColor` switch fallback → Task 2
- [x] Redundant `allMatched` filter → Task 3
- [x] `JSON.stringify` dep hack → Task 3
- [x] Per-station departure separation bug → Task 4
- [x] Configurator size / StationCard extraction → Task 5

**Placeholder scan:** No TBDs or hand-wavy steps. Every step has the full code.

**Type consistency:**
- `SiteDeparture` is defined in `useDepartures.ts` and imported where needed
- `StationCard` props match the Configurator callbacks exactly
- `TransportSection` no longer takes `transportMode` — confirmed removed from both definition and call site
