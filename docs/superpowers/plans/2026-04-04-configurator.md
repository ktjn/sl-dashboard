# Configurator Overlay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a ⚙ settings overlay to the dashboard where users can search for stations, set per-station walking time and direction filter, reorder the list, and apply or copy the resulting URL.

**Architecture:** Direction filtering moves from a single global `?direction=` param to a per-station 5th field in the URL (`siteId:name:mode:walkTime:direction`). A new `Configurator` overlay component manages local state, calls the SL station search API via `useStationSearch`, and generates the new URL via `buildQueryString`. Pressing Apply reloads the page with the new URL; Copy puts it in the clipboard.

**Tech Stack:** React 19, TypeScript 5, Vite 7. No test framework — `pnpm run typecheck` + `pnpm run lint` are the verification commands. Run from `C:/git/sl-dashboard`.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/types.ts` | Modify | Add `direction: string` to `StationConfig`; remove `directionFilter` from `AppConfig` |
| `src/constants.ts` | Modify | Add `direction: 'stockholm'` to each `DEFAULT_STATIONS` entry |
| `src/utils.ts` | Modify | Update `matchesDirection` signature; update `parseConfigFromQuery`; add `buildQueryString` |
| `src/hooks/useDepartures.ts` | Modify | Switch to per-station direction filtering; remove global `directionFilter` usage |
| `src/hooks/useStationSearch.ts` | Create | Debounced search hook against SL sites API |
| `src/components/Configurator.tsx` | Create | Overlay panel component with full configuration UI |
| `src/App.tsx` | Modify | Add `showConfigurator` state, ⚙ button in header, render `<Configurator>` |
| `src/App.css` | Modify | Add overlay and configurator panel styles |

---

### Task 1: Per-station direction — types, constants, utils

**Files:**
- Modify: `src/types.ts`
- Modify: `src/constants.ts`
- Modify: `src/utils.ts`

This task wires up the new URL format end-to-end at the data layer. `StationConfig` gets a `direction` field. `AppConfig` loses its global `directionFilter`. `parseConfigFromQuery` reads the 5th URL field (falling back to the legacy `?direction=` global param as a default). `buildQueryString` generates URLs in the new format. `matchesDirection` accepts a plain string instead of the old union type.

- [ ] **Step 1: Replace `src/types.ts`**

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
  direction: string  // 'stockholm' | 'all' | 'keyword1|keyword2'
}

export interface AppConfig {
  stations: StationConfig[]
}
```

- [ ] **Step 2: Update `src/constants.ts` — add `direction` to DEFAULT_STATIONS**

The import line (line 1) stays unchanged. Only the `DEFAULT_STATIONS` constant changes:

```typescript
export const DEFAULT_STATIONS: StationConfig[] = [
  { siteId: 9324, name: 'Duvbo', mode: 'METRO', walkTime: 10, direction: 'stockholm' },
  { siteId: 9325, name: 'Sundbyberg', mode: 'TRAIN', walkTime: 15, direction: 'stockholm' },
  { siteId: 9325, name: 'Sundbyberg', mode: 'TRAM', walkTime: 13, direction: 'stockholm' },
]
```

- [ ] **Step 3: Replace `src/utils.ts`**

Key changes:
- `matchesDirection` takes `string` instead of `AppConfig['directionFilter']`
- `parseConfigFromQuery` reads 5th field; falls back to legacy `?direction=` param as the per-station default; no longer returns `directionFilter`
- `buildQueryString` is new

```typescript
import { LINE_COLORS, STOCKHOLM_DIRECTIONS, DEFAULT_STATIONS } from './constants'
import type { Departure, TransportMode, AppConfig, StationConfig } from './types'

export function isTowardsStockholm(departure: Departure): boolean {
  const dest = departure.destination.toLowerCase()
  const dir = departure.direction?.toLowerCase() || ''
  return STOCKHOLM_DIRECTIONS.some(d => dest.includes(d) || dir.includes(d))
}

// direction: 'stockholm' | 'all' | 'keyword1|keyword2'
export function matchesDirection(departure: Departure, direction: string): boolean {
  if (direction === 'all') return true
  if (direction === 'stockholm') return isTowardsStockholm(departure)
  const keywords = direction.split('|').filter(Boolean)
  const dest = departure.destination.toLowerCase()
  const dir = departure.direction?.toLowerCase() || ''
  return keywords.some(keyword => {
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
// New format: ?stations=siteId:name:mode:walkTime:direction,...
// Legacy fallback: ?direction=stockholm applies as default direction for stations without a 5th field
export function parseConfigFromQuery(): AppConfig {
  const params = new URLSearchParams(window.location.search)
  const stationsParam = params.get('stations')
  const legacyDirection = params.get('direction')?.toLowerCase() ?? 'stockholm'

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
        const direction = parts[4] ?? legacyDirection
        if (!isNaN(siteId) && name && ['METRO', 'TRAM', 'TRAIN', 'BUS'].includes(mode) && !isNaN(walkTime)) {
          parsed.push({ siteId, name, mode, walkTime, direction })
        }
      }
    }
    if (parsed.length > 0) stations = parsed
  }

  return { stations }
}

// Build a full URL from a station list.
// Format: origin + pathname + ?stations=siteId:name:mode:walkTime:direction,...
export function buildQueryString(stations: StationConfig[]): string {
  const parts = stations.map(s =>
    [s.siteId, encodeURIComponent(s.name), s.mode, s.walkTime, s.direction].join(':')
  )
  return `${window.location.origin}${window.location.pathname}?stations=${parts.join(',')}`
}
```

- [ ] **Step 4: Verify typecheck**

```bash
pnpm run typecheck
```

Expected: errors in `useDepartures.ts` and `App.tsx` because they still reference `config.directionFilter`. These are intentional — fixed in Task 2.

- [ ] **Step 5: Commit**

```bash
git add src/types.ts src/constants.ts src/utils.ts
git commit -m "feat: per-station direction in URL format, add buildQueryString"
```

---

### Task 2: Update useDepartures and App.tsx to use per-station direction

**Files:**
- Modify: `src/hooks/useDepartures.ts`
- Modify: `src/App.tsx`

`useDepartures` currently applies a single global direction filter across all departures. Now it must match each departure to its station config (by transport mode) and apply that station's direction. `App.tsx` needs to drop the `directionFilter` destructure and update the subtitle derivation.

- [ ] **Step 1: Replace `src/hooks/useDepartures.ts`**

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

  const { stations } = config
  const uniqueSiteIds = [...new Set(stations.map(s => s.siteId))]

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
        .filter(d => {
          const station = stations.find(s => s.mode === d.line.transport_mode)
          if (!station) return false
          return matchesDirection(d, station.direction)
        })

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
  }, [JSON.stringify(uniqueSiteIds), JSON.stringify(stations.map(s => s.direction))])

  useEffect(() => {
    fetchDepartures()
    const interval = setInterval(fetchDepartures, DEPARTURE_FETCH_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [fetchDepartures])

  return { departures, loading, error, lastUpdate, refetch: fetchDepartures }
}
```

- [ ] **Step 2: Replace `src/App.tsx`**

The only changes from the current file are: remove `directionFilter` from the destructure, and update the `subtitle` memo to derive from stations instead.

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
  const { stations } = config

  const { departures, loading, error, lastUpdate, refetch } = useDepartures(config)
  const currentTime = useClock()

  const headerTitle = useMemo(() => {
    const uniqueNames = [...new Set(stations.map(s => s.name))]
    return uniqueNames.join(' / ')
  }, [stations])

  const subtitle = useMemo(() => {
    const directions = [...new Set(stations.map(s => s.direction))]
    if (directions.length === 1) {
      if (directions[0] === 'all') return 'Alla avgångar'
      if (directions[0] === 'stockholm') return 'Avgångar mot Stockholm C'
      return `Avgångar mot ${directions[0].split('|').join(', ')}`
    }
    return 'Avgångstavla'
  }, [stations])

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

- [ ] **Step 3: Verify typecheck and lint**

```bash
pnpm run typecheck && pnpm run lint
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useDepartures.ts src/App.tsx
git commit -m "feat: switch to per-station direction filtering"
```

---

### Task 3: Create useStationSearch hook

**Files:**
- Create: `src/hooks/useStationSearch.ts`

Debounced search against the SL sites API. Returns matching stations with their IDs for display in the configurator search results.

- [ ] **Step 1: Create `src/hooks/useStationSearch.ts`**

```typescript
import { useState, useEffect } from 'react'

export interface SiteSearchResult {
  id: number
  name: string
}

interface UseStationSearchResult {
  results: SiteSearchResult[]
  loading: boolean
  error: string | null
}

export function useStationSearch(query: string): UseStationSearchResult {
  const [results, setResults] = useState<SiteSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      setError(null)
      return
    }

    setLoading(true)
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(
          `https://transport.integration.sl.se/v1/sites/?q=${encodeURIComponent(query.trim())}`
        )
        if (!response.ok) throw new Error(`API error: ${response.status}`)
        const data = await response.json()
        const sites: SiteSearchResult[] = (data.sites ?? []).map((s: { id: number; name: string }) => ({
          id: s.id,
          name: s.name,
        }))
        setResults(sites)
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Sökning misslyckades')
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [query])

  return { results, loading, error }
}
```

- [ ] **Step 2: Verify typecheck**

```bash
pnpm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useStationSearch.ts
git commit -m "feat: add useStationSearch hook for SL sites API"
```

---

### Task 4: Create Configurator component

**Files:**
- Create: `src/components/Configurator.tsx`

The full overlay panel. Manages a local copy of the station list. Supports drag-to-reorder (HTML5 drag-and-drop), station search, per-card walk time and direction editing, URL preview, Copy and Apply.

- [ ] **Step 1: Create `src/components/Configurator.tsx`**

```typescript
import { useState, useRef } from 'react'
import { useStationSearch } from '../hooks/useStationSearch'
import { buildQueryString } from '../utils'
import type { StationConfig, TransportMode, AppConfig } from '../types'

interface ConfiguratorProps {
  config: AppConfig
  onClose: () => void
}

const MODE_LABELS: Record<TransportMode, string> = {
  METRO: 'Tunnelbana',
  TRAIN: 'Pendeltåg',
  TRAM: 'Spårvagn',
  BUS: 'Buss',
}

const MODES: TransportMode[] = ['METRO', 'TRAIN', 'TRAM', 'BUS']

export default function Configurator({ config, onClose }: ConfiguratorProps) {
  const [stations, setStations] = useState<StationConfig[]>(config.stations)
  const [query, setQuery] = useState('')
  const [showResults, setShowResults] = useState(false)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [copied, setCopied] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)

  const { results, loading: searchLoading, error: searchError } = useStationSearch(query)

  const generatedUrl = buildQueryString(stations)

  function updateStation(index: number, patch: Partial<StationConfig>) {
    setStations(prev => prev.map((s, i) => i === index ? { ...s, ...patch } : s))
  }

  function removeStation(index: number) {
    setStations(prev => prev.filter((_, i) => i !== index))
  }

  function addStation(id: number, name: string) {
    const newStation: StationConfig = {
      siteId: id,
      name,
      mode: 'METRO',
      walkTime: 10,
      direction: 'stockholm',
    }
    setStations(prev => [...prev, newStation])
    setQuery('')
    setShowResults(false)
  }

  function handleDragStart(index: number) {
    setDragIndex(index)
  }

  function handleDrop(index: number) {
    if (dragIndex === null || dragIndex === index) return
    setStations(prev => {
      const next = [...prev]
      const [moved] = next.splice(dragIndex, 1)
      next.splice(index, 0, moved)
      return next
    })
    setDragIndex(null)
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(generatedUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleApply() {
    window.location.href = generatedUrl
  }

  function directionToDisplay(direction: string): string {
    if (direction === 'stockholm') return 'stockholm'
    if (direction === 'all') return 'all'
    return 'custom'
  }

  function displayToDirection(value: string, current: string): string {
    if (value === 'stockholm') return 'stockholm'
    if (value === 'all') return 'all'
    // 'custom' — keep existing custom keywords if already custom, else empty
    if (directionToDisplay(current) === 'custom') return current
    return ''
  }

  return (
    <div className="configurator-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="configurator-panel">
        <div className="configurator-header">
          <span>Konfigurera tavla</span>
          <button className="configurator-close" onClick={onClose}>✕</button>
        </div>

        <div className="configurator-body">
          {/* Station list */}
          <div className="configurator-section">
            <div className="configurator-label">Stationer</div>
            {stations.length === 0 && (
              <p className="configurator-empty">Inga stationer. Sök nedan för att lägga till.</p>
            )}
            {stations.map((station, index) => (
              <div
                key={`${station.siteId}-${station.mode}-${index}`}
                className={`configurator-card${dragIndex === index ? ' dragging' : ''}`}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDrop(index)}
                onDragEnd={() => setDragIndex(null)}
              >
                <div className="configurator-drag-handle">⠿</div>
                <div className="configurator-card-fields">
                  <div className="configurator-card-name">{station.name}</div>
                  <div className="configurator-card-row">
                    <select
                      className="configurator-select"
                      value={station.mode}
                      onChange={e => updateStation(index, { mode: e.target.value as TransportMode })}
                    >
                      {MODES.map(m => (
                        <option key={m} value={m}>{MODE_LABELS[m]}</option>
                      ))}
                    </select>
                    <input
                      className="configurator-walk-input"
                      type="number"
                      min={0}
                      max={60}
                      value={station.walkTime}
                      onChange={e => updateStation(index, { walkTime: parseInt(e.target.value, 10) || 0 })}
                    />
                    <span className="configurator-walk-label">min</span>
                  </div>
                  <div className="configurator-card-row">
                    <span className="configurator-direction-label">Riktning</span>
                    <select
                      className="configurator-select"
                      value={directionToDisplay(station.direction)}
                      onChange={e => {
                        const newDir = displayToDirection(e.target.value, station.direction)
                        updateStation(index, { direction: newDir })
                      }}
                    >
                      <option value="stockholm">→ Stockholm</option>
                      <option value="all">Alla riktningar</option>
                      <option value="custom">Anpassad…</option>
                    </select>
                  </div>
                  {directionToDisplay(station.direction) === 'custom' && (
                    <input
                      className="configurator-keywords-input"
                      placeholder="t.ex. farsta sickla"
                      value={station.direction.split('|').join(' ')}
                      onChange={e => {
                        const keywords = e.target.value
                          .split(/[\s,]+/)
                          .map(k => k.trim().toLowerCase())
                          .filter(Boolean)
                          .join('|')
                        updateStation(index, { direction: keywords || 'stockholm' })
                      }}
                    />
                  )}
                </div>
                <button className="configurator-remove" onClick={() => removeStation(index)}>✕</button>
              </div>
            ))}
          </div>

          {/* Search */}
          <div className="configurator-section" ref={searchRef}>
            <div className="configurator-label">Lägg till station</div>
            <input
              className="configurator-search"
              placeholder="Sök stationsnamn…"
              value={query}
              onChange={e => { setQuery(e.target.value); setShowResults(true) }}
              onFocus={() => setShowResults(true)}
            />
            {showResults && query.trim() && (
              <div className="configurator-results">
                {searchLoading && <div className="configurator-result-item configurator-result-status">Söker…</div>}
                {searchError && <div className="configurator-result-item configurator-result-status configurator-result-error">Kunde inte hämta resultat</div>}
                {!searchLoading && !searchError && results.length === 0 && (
                  <div className="configurator-result-item configurator-result-status">Inga träffar</div>
                )}
                {results.map(result => (
                  <button
                    key={result.id}
                    className="configurator-result-item"
                    onClick={() => addStation(result.id, result.name)}
                  >
                    <span className="configurator-result-name">{result.name}</span>
                    <span className="configurator-result-id">{result.id}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* URL preview */}
          <div className="configurator-section">
            <div className="configurator-label">Genererad URL</div>
            <div className="configurator-url-preview">{generatedUrl}</div>
            <div className="configurator-actions">
              <button className="configurator-btn" onClick={handleCopy}>
                {copied ? '✓ Kopierad' : '📋 Kopiera URL'}
              </button>
              <button className="configurator-btn configurator-btn-apply" onClick={handleApply}>
                Använd
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify typecheck and lint**

```bash
pnpm run typecheck && pnpm run lint
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/Configurator.tsx
git commit -m "feat: add Configurator overlay component"
```

---

### Task 5: Wire up settings button in App.tsx and add CSS

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.css`

Add the ⚙ button to the dashboard header and render `<Configurator>` when it's open. Add all overlay and panel styles to App.css.

- [ ] **Step 1: Update `src/App.tsx`**

Two changes from the Task 2 version:
1. Import `useState` and `Configurator`
2. Add `showConfigurator` state, ⚙ button in header, conditional `<Configurator>` render

```typescript
import { useState, useMemo } from 'react'
import './App.css'
import { useDepartures } from './hooks/useDepartures'
import { useClock } from './hooks/useClock'
import { parseConfigFromQuery } from './utils'
import TransportSection from './components/TransportSection'
import Configurator from './components/Configurator'
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
  const { stations } = config

  const { departures, loading, error, lastUpdate, refetch } = useDepartures(config)
  const currentTime = useClock()
  const [showConfigurator, setShowConfigurator] = useState(false)

  const headerTitle = useMemo(() => {
    const uniqueNames = [...new Set(stations.map(s => s.name))]
    return uniqueNames.join(' / ')
  }, [stations])

  const subtitle = useMemo(() => {
    const directions = [...new Set(stations.map(s => s.direction))]
    if (directions.length === 1) {
      if (directions[0] === 'all') return 'Alla avgångar'
      if (directions[0] === 'stockholm') return 'Avgångar mot Stockholm C'
      return `Avgångar mot ${directions[0].split('|').join(', ')}`
    }
    return 'Avgångstavla'
  }, [stations])

  return (
    <div className="app">
      <header className="header">
        <div className="header-content">
          <div className="sl-logo">SL</div>
          <div className="station-info">
            <h1>{headerTitle}</h1>
            <p className="subtitle">{subtitle}</p>
          </div>
          <div className="header-right">
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
            {!showConfigurator && (
              <button
                className="settings-button"
                onClick={() => setShowConfigurator(true)}
                title="Konfigurera"
              >
                ⚙
              </button>
            )}
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

      {showConfigurator && (
        <Configurator config={config} onClose={() => setShowConfigurator(false)} />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Append configurator styles to `src/App.css`**

Add the following block at the end of the existing `src/App.css` (after the last `}` of the scrollbar section):

```css
/* Settings button */
.header-right {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.settings-button {
  background: rgba(255, 255, 255, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #ffffff;
  font-size: 1.2rem;
  width: 40px;
  height: 40px;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
  flex-shrink: 0;
}

.settings-button:hover {
  background: rgba(255, 255, 255, 0.25);
}

/* Configurator overlay */
.configurator-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  z-index: 100;
  display: flex;
  justify-content: flex-end;
}

.configurator-panel {
  background: #16213e;
  width: 420px;
  max-width: 100vw;
  height: 100%;
  display: flex;
  flex-direction: column;
  box-shadow: -4px 0 24px rgba(0, 0, 0, 0.4);
  animation: slide-in 0.2s ease;
}

@keyframes slide-in {
  from { transform: translateX(100%); }
  to { transform: translateX(0); }
}

.configurator-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem 1.5rem;
  background: #0f3460;
  font-size: 1rem;
  font-weight: 600;
  flex-shrink: 0;
}

.configurator-close {
  background: transparent;
  border: none;
  color: #8b9dc3;
  font-size: 1.1rem;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
}

.configurator-close:hover {
  color: #ffffff;
  background: rgba(255, 255, 255, 0.1);
}

.configurator-body {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.configurator-section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.configurator-label {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #8b9dc3;
  margin-bottom: 0.25rem;
}

.configurator-empty {
  color: #8b9dc3;
  font-size: 0.9rem;
  padding: 0.5rem 0;
}

/* Station card */
.configurator-card {
  background: #0f3460;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  padding: 0.75rem;
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 0.75rem;
  align-items: start;
  cursor: default;
}

.configurator-card.dragging {
  opacity: 0.4;
}

.configurator-drag-handle {
  cursor: grab;
  color: #8b9dc3;
  font-size: 1.2rem;
  padding-top: 2px;
  user-select: none;
}

.configurator-card-fields {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.configurator-card-name {
  font-weight: 600;
  font-size: 0.95rem;
}

.configurator-card-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.configurator-select {
  background: #1a2e4a;
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: #ffffff;
  border-radius: 6px;
  padding: 0.3rem 0.5rem;
  font-size: 0.85rem;
  cursor: pointer;
}

.configurator-walk-input {
  background: #1a2e4a;
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: #ffffff;
  border-radius: 6px;
  padding: 0.3rem 0.5rem;
  font-size: 0.85rem;
  width: 56px;
  text-align: center;
}

.configurator-walk-label {
  font-size: 0.8rem;
  color: #8b9dc3;
}

.configurator-direction-label {
  font-size: 0.8rem;
  color: #8b9dc3;
  flex-shrink: 0;
}

.configurator-keywords-input {
  background: #1a2e4a;
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: #ffffff;
  border-radius: 6px;
  padding: 0.3rem 0.5rem;
  font-size: 0.85rem;
  width: 100%;
}

.configurator-remove {
  background: transparent;
  border: none;
  color: #8b9dc3;
  font-size: 1rem;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  line-height: 1;
}

.configurator-remove:hover {
  color: #ef4444;
}

/* Search */
.configurator-search {
  background: #1a2e4a;
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: #ffffff;
  border-radius: 8px;
  padding: 0.6rem 0.75rem;
  font-size: 0.9rem;
  width: 100%;
}

.configurator-search::placeholder {
  color: #8b9dc3;
}

.configurator-results {
  background: #0a1628;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  overflow: hidden;
}

.configurator-result-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.6rem 0.75rem;
  width: 100%;
  background: transparent;
  border: none;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  color: #ffffff;
  text-align: left;
  cursor: pointer;
  font-size: 0.9rem;
}

.configurator-result-item:last-child {
  border-bottom: none;
}

.configurator-result-item:hover:not(.configurator-result-status) {
  background: rgba(255, 255, 255, 0.06);
}

.configurator-result-status {
  color: #8b9dc3;
  cursor: default;
  font-size: 0.85rem;
}

.configurator-result-error {
  color: #ef4444;
}

.configurator-result-id {
  font-size: 0.78rem;
  color: #8b9dc3;
  font-variant-numeric: tabular-nums;
}

/* URL preview */
.configurator-url-preview {
  background: #0a1628;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  padding: 0.75rem;
  font-family: monospace;
  font-size: 0.75rem;
  color: #7ec8e3;
  word-break: break-all;
}

.configurator-actions {
  display: flex;
  gap: 0.5rem;
}

.configurator-btn {
  flex: 1;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: #ffffff;
  border-radius: 8px;
  padding: 0.6rem;
  font-size: 0.9rem;
  cursor: pointer;
  transition: background 0.2s;
}

.configurator-btn:hover {
  background: rgba(255, 255, 255, 0.15);
}

.configurator-btn-apply {
  background: rgba(0, 102, 179, 0.4);
  border-color: rgba(0, 102, 179, 0.6);
}

.configurator-btn-apply:hover {
  background: rgba(0, 102, 179, 0.6);
}
```

- [ ] **Step 3: Verify typecheck and lint**

```bash
pnpm run typecheck && pnpm run lint
```

Expected: no errors.

- [ ] **Step 4: Smoke-test in dev server**

```bash
pnpm run dev
```

Open the app and verify:
- Dashboard shows correctly with existing stations and directions
- ⚙ button appears top-right in the header; clicking it opens the configurator panel
- Clicking the backdrop or ✕ closes the panel
- Existing station cards show correct name, mode, walk time, direction
- Drag handles allow reordering
- Direction dropdown shows "Stockholm" selected by default
- Selecting "Anpassad…" shows a keywords text input
- Searching for "duvbo" or "sundbyberg" shows results from the SL API
- Clicking a result adds a new card
- URL preview updates as you edit
- "Kopiera URL" copies to clipboard; button briefly shows "✓ Kopierad"
- "Använd" reloads the page with the new URL and the dashboard reflects the new config

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/App.css
git commit -m "feat: wire up configurator button and overlay in dashboard"
```

---

## Self-Review

**Spec coverage:**
- ✅ Overlay on dashboard → Task 5 adds settings button, renders `<Configurator>` conditionally
- ✅ Station search via SL API → Task 3 `useStationSearch`, used in Task 4
- ✅ Per-station direction → Tasks 1 & 2 (types, URL format, filtering)
- ✅ Drag-to-reorder → Task 4 HTML5 drag-and-drop
- ✅ Walk time per station → Task 4 number input
- ✅ Mode selector → Task 4 dropdown with all 4 modes
- ✅ Custom direction with `|` separator → Task 4 keywords input, splits/joins on `|`
- ✅ URL preview → Task 4 uses `buildQueryString`
- ✅ Copy URL → Task 4 `navigator.clipboard.writeText`
- ✅ Apply → Task 4 `window.location.href`
- ✅ Backwards compat for `?direction=` global param → Task 1 `parseConfigFromQuery` fallback
- ✅ `buildQueryString` → Task 1
- ✅ Overlay CSS with slide-in animation → Task 5

**Placeholder scan:** No TBDs, TODOs, or "similar to Task N". All code blocks are complete.

**Type consistency:**
- `StationConfig.direction: string` defined Task 1, used in Tasks 2, 4 ✅
- `AppConfig { stations: StationConfig[] }` (no `directionFilter`) defined Task 1, used in Tasks 2, 4, 5 ✅
- `buildQueryString(stations: StationConfig[]): string` defined Task 1, called in Task 4 ✅
- `matchesDirection(departure, direction: string)` defined Task 1, called in Task 2 ✅
- `ConfiguratorProps { config: AppConfig; onClose: () => void }` defined Task 4, passed in Task 5 ✅
- `SiteSearchResult { id: number; name: string }` defined Task 3, used in Task 4 ✅
- `useStationSearch(query: string)` defined Task 3, called in Task 4 ✅
