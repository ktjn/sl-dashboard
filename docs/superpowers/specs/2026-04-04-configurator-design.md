# Configurator Overlay Design

**Date:** 2026-04-04  
**Status:** Approved

## Goal

A settings panel on the dashboard that lets you build, reorder, and configure departure stations, then apply or copy the resulting URL. No separate page — it lives as an overlay on the existing dashboard.

---

## URL Format Change

The current global `?direction=` parameter is replaced by a per-station 5th field in the `stations` param.

**New format:**
```
?stations=siteId:name:mode:walkTime:direction,...
```

**Direction values per station:**
- `stockholm` — filter departures toward Stockholm (default)
- `all` — show all directions
- `keyword1|keyword2` — custom substring match; `|` separates multiple keywords

**Example:**
```
?stations=9324:Duvbo:METRO:10:stockholm,9325:Sundbyberg:TRAIN:15:all,9325:Sundbyberg:TRAM:13:farsta|sickla
```

**Backwards compatibility:** The old `?direction=stockholm` global param continues to parse as a fallback. If a station entry has fewer than 5 fields, direction defaults to `stockholm`. The old `DEFAULT_STATIONS` constant receives a `direction: 'stockholm'` default.

---

## Files

| File | Change |
|---|---|
| `src/types.ts` | Add `direction: string` field to `StationConfig` |
| `src/utils.ts` | Update `parseConfigFromQuery` to read 5th field; add `buildQueryString(config: AppConfig): string` |
| `src/hooks/useStationSearch.ts` | New — debounced search hook against SL sites API |
| `src/components/Configurator.tsx` | New — full overlay component |
| `src/App.tsx` | Add ⚙ settings button in header; render `<Configurator>` conditionally |
| `src/App.css` | Overlay and configurator styles |
| `src/constants.ts` | Update `DEFAULT_STATIONS` to include `direction: 'stockholm'` on each entry |

---

## Data Flow

```
User clicks ⚙  →  Configurator opens with current AppConfig as initial state
User edits     →  local state updates  →  URL preview regenerates (pure function)
Copy URL       →  navigator.clipboard.writeText(buildQueryString(localConfig))
Apply          →  window.location.href = buildQueryString(localConfig)  (page reloads)
```

The configurator holds a local copy of the station list. Nothing changes on the live dashboard until Apply is pressed.

---

## Component: Configurator.tsx

Single self-contained component. No sub-components.

**Props:**
```typescript
interface ConfiguratorProps {
  config: AppConfig        // current config from URL (read-only seed)
  onClose: () => void
}
```

**Local state:**
```typescript
stations: StationConfig[]   // editable copy, seeded from props.config
query: string               // search input value
```

**Station card fields (per entry):**
- Drag handle (HTML5 drag-and-drop — no extra dependencies)
- Station name (display only, from search result)
- Mode dropdown: `METRO | TRAM | TRAIN | BUS` (all 4 options always shown)
- Walk time: number input (minutes)
- Direction dropdown: `→ Stockholm | All | Custom…`
  - Selecting "Custom…" reveals a text input; user types space- or comma-separated keywords; stored internally and in URL as `|`-separated
- Delete button (✕)

**Adding a station:**
- User types in search field → `useStationSearch` fetches results (debounced 300 ms)
- Results show station name and site ID
- Clicking a result adds a new card at the bottom with defaults: mode = `METRO` (first in the fixed order `METRO → TRAIN → TRAM → BUS`), walk time = 10, direction = `stockholm`
- Same siteId can appear multiple times with different modes (matching existing behavior for Sundbyberg)

**Reordering:**
- HTML5 `draggable` on each card
- `onDragStart` / `onDragOver` / `onDrop` handlers update the stations array order

**URL preview:**
- Rendered below the station list, updates on every state change
- Calls `buildQueryString(localConfig)` — pure function, no side effects
- Prepends `window.location.origin + window.location.pathname` for a full copyable URL

**Buttons:**
- **Copy URL** — `navigator.clipboard.writeText(fullUrl)`
- **Apply** — `window.location.href = fullUrl`

---

## Hook: useStationSearch.ts

```typescript
interface StationSearchResult {
  id: number
  name: string
}

function useStationSearch(query: string): {
  results: StationSearchResult[]
  loading: boolean
  error: string | null
}
```

- Fetches `https://transport.integration.sl.se/v1/sites/?q=<query>` with 300 ms debounce
- Empty query → no fetch, returns `results: []`
- API error → `error` string shown inline below search field; `results: []`
- No mode information is returned by the search API — mode dropdown always shows all 4 options

---

## Utility: buildQueryString

```typescript
function buildQueryString(config: AppConfig): string
```

- Serialises `config.stations` to the 5-field format: `siteId:name:mode:walkTime:direction`
- Custom direction keywords joined with `|`
- Returns a full URL: `window.location.origin + window.location.pathname + '?' + params`
- Pure function — no DOM access except reading `window.location` at call time

---

## Settings Button Placement

Small ⚙ icon added to the existing dashboard header (top-right area, inside `.header-content`). Hidden when the configurator is already open. No label — icon only.

---

## Error Handling

- Search fetch fails → inline "Could not load results" below the search field; user can retry by modifying the query
- No manual siteId entry — search is the only way to add stations
- Apply with empty station list → not prevented; dashboard will show "Inga avgångar just nu"

---

## Out of Scope

- Persisting config to localStorage (URL is the source of truth)
- Detecting which transport modes are actually available at a station
- Validating walk time range
- Mobile / touch drag-and-drop (HTML5 drag events don't fire on mobile; reorder handles can be added later)
