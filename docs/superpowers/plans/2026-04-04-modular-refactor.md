# Modularization Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the half-finished modularization of `App.tsx` by integrating the extracted modules (`types.ts`, `constants.ts`, `utils.ts`, `hooks/`, `components/`) and eliminating all duplication.

**Architecture:** `App.tsx` is currently 465 lines and still contains all types, constants, utility functions, and inline components — duplicated from the newly created module files that are untracked and unused. This plan fixes the extracted modules' regressions (walking-time prop loss, hardcoded site IDs, missing helpers) and then trims `App.tsx` to a thin orchestrator that imports from those modules.

**Tech Stack:** React 19, TypeScript 5, Vite 7. No test framework — verification is via `pnpm run typecheck` (runs `tsc`).

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/types.ts` | Modify | Add `StationConfig` and `AppConfig` types |
| `src/utils.ts` | Modify | Add `matchesDirection` and `parseConfigFromQuery` |
| `src/hooks/useDepartures.ts` | Rewrite | Accept `AppConfig` instead of hardcoded site IDs |
| `src/components/DepartureRow.tsx` | Modify | Accept `walkingTime` prop (restore per-station config) |
| `src/components/TransportSection.tsx` | Modify | Accept `walkingTime` prop (restore per-station config) |
| `src/App.tsx` | Rewrite | Remove all duplication; thin orchestrator using modules |

---

### Task 1: Add StationConfig and AppConfig to types.ts

**Files:**
- Modify: `src/types.ts`

`App.tsx` defines `StationConfig` and `AppConfig` inline but `types.ts` doesn't have them. They must live in `types.ts` so other modules can import them.

- [ ] **Step 1: Add the two types to types.ts**

Replace the full contents of `src/types.ts` with:

```typescript
export type TransportMode = 'METRO' | 'TRAM' | 'TRAIN' | 'BUS'

export interface TransportTypeConfig {
  name: string
  icon: string
  color: string
  bgColor: string
}

export interface Line {
  id: number
  designation: string
  transport_mode: TransportMode
}

export interface StopArea {
  name: string
}

export interface StopPoint {
  designation: string
}

export interface Journey {
  id: string
}

export interface Departure {
  destination: string
  direction?: string
  display: string
  scheduled: string
  expected?: string
  line: Line
  stop_area?: StopArea
  stop_point?: StopPoint
  journey?: Journey
}

export interface DeparturesResponse {
  departures: Departure[]
}

export interface StationConfig {
  siteId: number
  name: string
  mode: TransportMode
  walkTime: number
}

export interface AppConfig {
  stations: StationConfig[]
  directionFilter: 'stockholm' | 'all' | string[]
}
```

- [ ] **Step 2: Verify typecheck passes**

```bash
pnpm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "feat: add StationConfig and AppConfig to types.ts"
```

---

### Task 2: Extract matchesDirection and parseConfigFromQuery to utils.ts

**Files:**
- Modify: `src/utils.ts`
- Modify: `src/constants.ts`

`App.tsx` contains `matchesDirection` and `parseConfigFromQuery` which are not in `utils.ts`. Also `STOCKHOLM_DIRECTIONS` is duplicated between `App.tsx` and `constants.ts` — they must live only in `constants.ts`.

- [ ] **Step 1: Verify constants.ts already has STOCKHOLM_DIRECTIONS**

Open `src/constants.ts` and confirm `STOCKHOLM_DIRECTIONS` is exported. It should be there (lines 38-57). No change needed.

- [ ] **Step 2: Replace the full contents of utils.ts**

```typescript
import { LINE_COLORS, STOCKHOLM_DIRECTIONS, DEFAULT_STATIONS } from './constants'
import type { Departure, TransportMode, AppConfig, StationConfig } from './types'

export function isTowardsStockholm(departure: Departure): boolean {
  const dest = departure.destination.toLowerCase()
  const dir = departure.direction?.toLowerCase() || ''
  return STOCKHOLM_DIRECTIONS.some(d => dest.includes(d) || dir.includes(d))
}

export function matchesDirection(departure: Departure, filter: AppConfig['directionFilter']): boolean {
  if (filter === 'all') return true
  if (filter === 'stockholm') return isTowardsStockholm(departure)
  const dest = departure.destination.toLowerCase()
  const dir = departure.direction?.toLowerCase() || ''
  return filter.some(keyword => {
    if (keyword.startsWith('=')) {
      const exact = keyword.slice(1)
      return dest === exact || dir === exact
    }
    return dest.includes(keyword) || dir.includes(keyword)
  })
}

export function formatTime(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })
}

export function getLineColor(lineId: number, transportMode: TransportMode): string {
  if (LINE_COLORS[lineId]) return LINE_COLORS[lineId]

  switch (transportMode) {
    case 'METRO': return '#0066B3'
    case 'TRAM': return '#7D4E24'
    case 'TRAIN': return '#EC619F'
    case 'BUS': return '#1E88E5'
    default: return '#666666'
  }
}

// Parse query parameters to get station configuration.
// Format: ?stations=siteId:name:mode:walkTime,...
// Direction filter: ?direction=stockholm (default), ?direction=all, or ?direction=farsta,sickla
// Use = prefix for exact match: ?direction==farsta matches only "Farsta", not "Farsta strand"
export function parseConfigFromQuery(): AppConfig {
  const params = new URLSearchParams(window.location.search)
  const stationsParam = params.get('stations')
  const directionParam = params.get('direction')

  let stations: StationConfig[] = DEFAULT_STATIONS
  if (stationsParam) {
    const parsed: StationConfig[] = []
    for (const entry of stationsParam.split(',')) {
      const parts = entry.split(':')
      if (parts.length >= 4) {
        const siteId = parseInt(parts[0], 10)
        const name = decodeURIComponent(parts[1])
        const mode = parts[2].toUpperCase() as TransportMode
        const walkTime = parseInt(parts[3], 10)
        if (!isNaN(siteId) && name && ['METRO', 'TRAM', 'TRAIN', 'BUS'].includes(mode) && !isNaN(walkTime)) {
          parsed.push({ siteId, name, mode, walkTime })
        }
      }
    }
    if (parsed.length > 0) stations = parsed
  }

  let directionFilter: AppConfig['directionFilter'] = 'stockholm'
  if (directionParam) {
    if (directionParam.toLowerCase() === 'all') {
      directionFilter = 'all'
    } else if (directionParam.toLowerCase() !== 'stockholm') {
      directionFilter = directionParam.toLowerCase().split(',').map(s => s.trim())
    }
  }

  return { stations, directionFilter }
}
```

Note: `utils.ts` now imports `DEFAULT_STATIONS` from constants. We'll add that export in the next step.

- [ ] **Step 3: Add DEFAULT_STATIONS export to constants.ts**

Open `src/constants.ts` and append at the bottom (after `CLOCK_TICK_INTERVAL_MS`):

```typescript
import type { StationConfig } from './types'

export const DEFAULT_STATIONS: StationConfig[] = [
  { siteId: 9324, name: 'Duvbo', mode: 'METRO', walkTime: 10 },
  { siteId: 9325, name: 'Sundbyberg', mode: 'TRAIN', walkTime: 15 },
  { siteId: 9325, name: 'Sundbyberg', mode: 'TRAM', walkTime: 13 },
]
```

Wait — `constants.ts` cannot import from `types.ts` if `types.ts` imports from `constants.ts` (circular dependency). Check: `types.ts` does NOT import from `constants.ts`. Safe to add.

Actually, the import at the top of `constants.ts` already imports from `types.ts` (line 1: `import type { TransportMode, TransportTypeConfig } from './types'`). So adding `StationConfig` to that import is fine. The full updated top of `constants.ts`:

```typescript
import type { TransportMode, TransportTypeConfig, StationConfig } from './types'
```

And append at the bottom of `constants.ts`:

```typescript
export const DEFAULT_STATIONS: StationConfig[] = [
  { siteId: 9324, name: 'Duvbo', mode: 'METRO', walkTime: 10 },
  { siteId: 9325, name: 'Sundbyberg', mode: 'TRAIN', walkTime: 15 },
  { siteId: 9325, name: 'Sundbyberg', mode: 'TRAM', walkTime: 13 },
]
```

- [ ] **Step 4: Verify typecheck passes**

```bash
pnpm run typecheck
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/utils.ts src/constants.ts
git commit -m "feat: extract matchesDirection and parseConfigFromQuery to utils.ts"
```

---

### Task 3: Rewrite useDepartures to accept AppConfig

**Files:**
- Rewrite: `src/hooks/useDepartures.ts`

The current hook uses hardcoded `DUVBO_SITE_ID` and `SUNDBYBERG_SITE_ID` and always filters toward Stockholm. `App.tsx` has evolved to support configurable stations and direction filters. The hook must accept `AppConfig` to be usable.

- [ ] **Step 1: Replace the full contents of useDepartures.ts**

```typescript
import { useState, useEffect, useCallback } from 'react'
import { DEPARTURE_FETCH_INTERVAL_MS } from '../constants'
import { matchesDirection } from '../utils'
import type { Departure, DeparturesResponse, AppConfig } from '../types'

interface UseDeparturesResult {
  departures: Departure[]
  loading: boolean
  error: string | null
  lastUpdate: Date | null
  refetch: () => void
}

export function useDepartures(config: AppConfig): UseDeparturesResult {
  const [departures, setDepartures] = useState<Departure[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  const { stations, directionFilter } = config
  const uniqueSiteIds = [...new Set(stations.map(s => s.siteId))]
  const configuredModes = new Set(stations.map(s => s.mode))

  const fetchDepartures = useCallback(async () => {
    try {
      const responses = await Promise.all(
        uniqueSiteIds.map(siteId =>
          fetch(`https://transport.integration.sl.se/v1/sites/${siteId}/departures`)
        )
      )

      const failedResponse = responses.find(r => !r.ok)
      if (failedResponse) {
        throw new Error(`API error: ${failedResponse.status}`)
      }

      const allData: DeparturesResponse[] = await Promise.all(
        responses.map(r => r.json())
      )

      const filtered = allData
        .flatMap(data => data.departures)
        .filter(d => configuredModes.has(d.line.transport_mode))
        .filter(d => matchesDirection(d, directionFilter))

      setDepartures(filtered)
      setLastUpdate(new Date())
      setError(null)
    } catch (err) {
      console.error('Failed to fetch departures:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(uniqueSiteIds), JSON.stringify([...configuredModes]), JSON.stringify(directionFilter)])

  useEffect(() => {
    fetchDepartures()
    const interval = setInterval(fetchDepartures, DEPARTURE_FETCH_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [fetchDepartures])

  return { departures, loading, error, lastUpdate, refetch: fetchDepartures }
}
```

**Note on the eslint-disable:** `uniqueSiteIds`, `configuredModes`, and `directionFilter` are derived from `config` using array/Set operations, producing new references on every render. Serializing them to JSON for the dependency array is the simplest stable approach without adding a deep-equality library. The disable comment suppresses the exhaustive-deps warning for the serialized strings.

- [ ] **Step 2: Verify typecheck passes**

```bash
pnpm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useDepartures.ts
git commit -m "feat: useDepartures accepts AppConfig instead of hardcoded site IDs"
```

---

### Task 4: Add walkingTime prop to DepartureRow

**Files:**
- Modify: `src/components/DepartureRow.tsx`

The current `DepartureRow` derives walking time from `WALKING_TIMES[transportMode]`, which is mode-based. But `StationConfig.walkTime` is per-station (e.g. Sundbyberg TRAIN = 15 min, Sundbyberg TRAM = 13 min). The prop must come from the parent.

- [ ] **Step 1: Replace the full contents of DepartureRow.tsx**

```typescript
import { memo } from 'react'
import { formatTime, getLineColor } from '../utils'
import type { Departure } from '../types'

interface DepartureRowProps {
  departure: Departure
  currentTime: Date
  walkingTime: number
}

function DepartureRow({ departure, currentTime, walkingTime }: DepartureRowProps) {
  const transportMode = departure.line.transport_mode
  const lineColor = getLineColor(departure.line.id, transportMode)

  const departureTime = new Date(departure.expected || departure.scheduled)
  const leaveTime = new Date(departureTime.getTime() - walkingTime * 60000)
  const minutesUntilLeave = Math.round((leaveTime.getTime() - currentTime.getTime()) / 60000)

  const tooLate = minutesUntilLeave < -1
  const shouldLeaveNow = minutesUntilLeave >= -1 && minutesUntilLeave <= 0
  const shouldLeaveSoon = minutesUntilLeave <= 2 && minutesUntilLeave > 0

  const leaveDisplay = tooLate ? 'För sent' : minutesUntilLeave <= 0 ? 'Nu!' : `${minutesUntilLeave} min`
  const isUrgent = shouldLeaveNow || shouldLeaveSoon

  return (
    <div className={`departure-row ${tooLate ? 'too-late' : shouldLeaveNow ? 'leave-now' : shouldLeaveSoon ? 'leave-soon' : ''}`}>
      <div className="line-info">
        <div className="line-badge" style={{ backgroundColor: lineColor }}>
          <span className="line-number">{departure.line.designation}</span>
        </div>
      </div>
      <div className="destination-info">
        <span className="destination">{departure.destination}</span>
        {departure.stop_area && (
          <span className="via">{departure.stop_area.name}</span>
        )}
      </div>
      <div className="leave-time">
        <span className="leave-label">Gå</span>
        <span className={`leave-value ${tooLate ? 'too-late' : shouldLeaveNow ? 'blink urgent' : shouldLeaveSoon ? 'soon' : ''}`}>
          {leaveDisplay}
        </span>
      </div>
      {departure.stop_point?.designation && transportMode === 'TRAIN' && (
        <div className="track">
          <span className="track-label">Spår</span>
          <span className="track-number">{departure.stop_point.designation}</span>
        </div>
      )}
      <div className="time-info">
        <span className={`minutes ${isUrgent ? 'blink' : ''}`}>
          {departure.display}
        </span>
        <span className="actual-time">{formatTime(departure.expected || departure.scheduled)}</span>
      </div>
    </div>
  )
}

export default memo(DepartureRow)
```

- [ ] **Step 2: Verify typecheck passes**

```bash
pnpm run typecheck
```

Expected: errors about `TransportSection.tsx` not passing `walkingTime` to `DepartureRow` — that's expected and will be fixed in Task 5.

- [ ] **Step 3: Commit**

```bash
git add src/components/DepartureRow.tsx
git commit -m "feat: DepartureRow accepts walkingTime prop for per-station config"
```

---

### Task 5: Add walkingTime prop to TransportSection

**Files:**
- Modify: `src/components/TransportSection.tsx`

`TransportSection` must receive `walkingTime` from its parent (which knows the per-station config) and pass it down to `DepartureRow`.

- [ ] **Step 1: Replace the full contents of TransportSection.tsx**

```typescript
import { TRANSPORT_TYPES } from '../constants'
import type { Departure, TransportMode } from '../types'
import DepartureRow from './DepartureRow'

interface TransportSectionProps {
  title: string
  departures: Departure[]
  transportMode: TransportMode
  currentTime: Date
  walkingTime: number
}

export default function TransportSection({ title, departures, transportMode, currentTime, walkingTime }: TransportSectionProps) {
  const typeConfig = TRANSPORT_TYPES[transportMode]
  if (!typeConfig) return null

  const filteredDepartures = departures
    .filter(d => d.line.transport_mode === transportMode)
    .slice(0, 6)

  if (filteredDepartures.length === 0) return null

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
        {filteredDepartures.map((dep, idx) => (
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

- [ ] **Step 2: Verify typecheck passes**

```bash
pnpm run typecheck
```

Expected: errors only from `App.tsx` still having old inline definitions — fixed in Task 6.

- [ ] **Step 3: Commit**

```bash
git add src/components/TransportSection.tsx
git commit -m "feat: TransportSection accepts and forwards walkingTime prop"
```

---

### Task 6: Rewrite App.tsx as a thin orchestrator

**Files:**
- Rewrite: `src/App.tsx`

Remove all duplicated types, constants, utilities, inline components, and logic. `App.tsx` should only: parse config, orchestrate hooks, and render layout.

- [ ] **Step 1: Replace the full contents of App.tsx**

```typescript
import { useMemo } from 'react'
import './App.css'
import { useDepartures } from './hooks/useDepartures'
import { useClock } from './hooks/useClock'
import { parseConfigFromQuery } from './utils'
import TransportSection from './components/TransportSection'
import type { TransportMode } from './types'

const SECTION_NAMES: Record<TransportMode, string> = {
  METRO: 'Tunnelbana',
  TRAIN: 'Pendeltåg',
  TRAM: 'Tvärbanan',
  BUS: 'Buss',
}

function formatCurrentTime(date: Date): string {
  return date.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export default function App() {
  const config = useMemo(() => parseConfigFromQuery(), [])
  const { stations, directionFilter } = config

  const { departures, loading, error, lastUpdate, refetch } = useDepartures(config)
  const currentTime = useClock()

  const headerTitle = useMemo(() => {
    const uniqueNames = [...new Set(stations.map(s => s.name))]
    return uniqueNames.join(' / ')
  }, [stations])

  const subtitle = useMemo(() => {
    if (directionFilter === 'all') return 'Alla avgångar'
    if (directionFilter === 'stockholm') return 'Avgångar mot Stockholm C'
    return `Avgångar mot ${directionFilter.join(', ')}`
  }, [directionFilter])

  return (
    <div className="app">
      <header className="header">
        <div className="header-content">
          <div className="sl-logo">SL</div>
          <div className="station-info">
            <h1>{headerTitle}</h1>
            <p className="subtitle">{subtitle}</p>
          </div>
          <div className="clock">
            <div className="time">{formatCurrentTime(currentTime)}</div>
            <div className="date">
              {currentTime.toLocaleDateString('sv-SE', {
                weekday: 'long',
                day: 'numeric',
                month: 'long'
              })}
            </div>
          </div>
        </div>
      </header>

      <main className="main-content">
        {loading && (
          <div className="loading">
            <div className="loading-spinner"></div>
            <p>Hämtar avgångar...</p>
          </div>
        )}

        {error && (
          <div className="error">
            <p>Kunde inte hämta avgångar: {error}</p>
            <button onClick={refetch}>Försök igen</button>
          </div>
        )}

        {!loading && !error && departures.length === 0 && (
          <div className="no-departures">
            <p>Inga avgångar just nu</p>
          </div>
        )}

        {!loading && departures.length > 0 && (
          <>
            {stations.map((station, index) => (
              <TransportSection
                key={`${station.siteId}-${station.mode}-${index}`}
                title={`${SECTION_NAMES[station.mode]} från ${station.name}`}
                departures={departures}
                transportMode={station.mode}
                currentTime={currentTime}
                walkingTime={station.walkTime}
              />
            ))}
          </>
        )}
      </main>

      <footer className="footer">
        {lastUpdate && (
          <span>Uppdaterad: {formatCurrentTime(lastUpdate)}</span>
        )}
        <span className="live-indicator">
          <span className="live-dot"></span>
          Realtid från SL
        </span>
      </footer>
    </div>
  )
}
```

- [ ] **Step 2: Verify typecheck passes cleanly**

```bash
pnpm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Verify lint passes**

```bash
pnpm run lint
```

Expected: no errors.

- [ ] **Step 4: Smoke-test in dev server**

```bash
pnpm run dev
```

Open the app and verify:
- Header shows station names and current time (updates every second)
- Departure sections appear for each configured station/mode
- "Gå" times show per-station walking times (Duvbo METRO = 10 min, Sundbyberg TRAIN = 15 min, Sundbyberg TRAM = 13 min)
- Error state shows a "Försök igen" button
- Query param `?direction=all` shows all directions

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx
git commit -m "refactor: App.tsx uses modular hooks and components, removes all duplication"
```

---

## Self-Review

**Spec coverage:**
- ✅ Duplicate type definitions removed from App.tsx → Task 1 adds them to types.ts
- ✅ Duplicate constants removed → Task 2 adds DEFAULT_STATIONS to constants.ts
- ✅ Duplicate utils removed → Task 2 extracts matchesDirection and parseConfigFromQuery
- ✅ useDepartures hardcoded IDs fixed → Task 3
- ✅ Per-station walkTime regression fixed → Tasks 4 & 5
- ✅ Hardcoded `30000` ms replaced with `DEPARTURE_FETCH_INTERVAL_MS` → Task 3
- ✅ App.tsx slimmed to thin orchestrator → Task 6
- ✅ useClock hook used in App.tsx → Task 6

**Placeholder scan:** No TBDs, TODOs, or "similar to task N" references found.

**Type consistency:**
- `AppConfig` defined in Task 1, used in Tasks 2, 3, 6 ✅
- `StationConfig` defined in Task 1, used in Tasks 2, 6 ✅
- `walkingTime: number` prop defined in Tasks 4 and 5, passed in Task 6 ✅
- `useDepartures(config: AppConfig)` signature in Task 3, called in Task 6 ✅
- `parseConfigFromQuery()` defined in Task 2, called in Task 6 ✅
