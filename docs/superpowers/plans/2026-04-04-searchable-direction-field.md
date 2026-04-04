# Searchable Direction Field Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the static direction dropdown + raw keyword text input in the Configurator with a tag-based UI where users search and pick real departure destinations.

**Architecture:** `App` passes its `departures` array to `Configurator` as a new prop. Each station card derives available destination options by filtering `departures` on `siteId` + `mode`. Direction state continues to use the existing `keyword1|keyword2` string — tags are a UI projection of that string. No URL format change.

**Tech Stack:** React 19, TypeScript, Vite, CSS (src/App.css)

---

## File Map

| File | Change |
|------|--------|
| `src/hooks/useDepartures.ts` | Expose `allDepartures` (pre-direction-filter) alongside `departures` |
| `src/App.tsx` | Pass `allDepartures` prop to `<Configurator>` |
| `src/components/Configurator.tsx` | Accept `allDepartures`; remove direction select + text input; add toggle + tag + search UI; remove `directionToDisplay`/`displayToDirection` helpers |
| `src/App.css` | Remove `.configurator-direction-label`, `.configurator-keywords-input`; add tag, toggle, and direction search styles |

**Why `allDepartures`:** `departures` from `useDepartures` are already filtered by the station's current direction setting. The Configurator needs *all* destinations for a station/mode so the user can pick any direction — including ones not matching the current filter.

---

### Task 1: Expose `allDepartures` from useDepartures and pass to Configurator

**Files:**
- Modify: `src/hooks/useDepartures.ts`
- Modify: `src/App.tsx` (line 124)
- Modify: `src/components/Configurator.tsx` (lines 1–10)

- [ ] **Step 1: Store pre-filter departures in `useDepartures`**

In `src/hooks/useDepartures.ts`, update `UseDeparturesResult` and the hook to also return unfiltered departures:

```ts
interface UseDeparturesResult {
  departures: Departure[]
  allDepartures: Departure[]   // pre-direction-filter, grouped by siteId+mode
  loading: boolean
  error: string | null
  lastUpdate: Date | null
  refetch: () => void
}
```

Inside `fetchDepartures`, split the existing `.flatMap + .filter` into two steps:

```ts
const withOrigin = allData.flatMap((data, index) => {
  const siteId = uniqueSiteIds[index]
  return data.departures.map(d => ({ departure: d, originSiteId: siteId }))
})

// All departures for configured siteId+mode, before direction filter
const allMatched = withOrigin
  .filter(({ departure: d, originSiteId }) =>
    stations.some(s => s.siteId === originSiteId && s.mode === d.line.transport_mode)
  )
  .map(({ departure }) => departure)

// Direction-filtered departures shown on the board
const filtered = withOrigin
  .filter(({ departure: d, originSiteId }) => {
    const station = stations.find(s => s.siteId === originSiteId && s.mode === d.line.transport_mode)
    if (!station) return false
    return matchesDirection(d, station.direction)
  })
  .map(({ departure }) => departure)

setDepartures(filtered)
setAllDepartures(allMatched)
```

Add `allDepartures` state:

```ts
const [allDepartures, setAllDepartures] = useState<Departure[]>([])
```

Update the return value:

```ts
return { departures, allDepartures, loading, error, lastUpdate, refetch: fetchDepartures }
```

- [ ] **Step 2: Add `allDepartures` to `ConfiguratorProps` and function signature**

In `src/components/Configurator.tsx`, update the import line and interface:

```tsx
import { useStationSearch } from '../hooks/useStationSearch'
import { buildQueryString } from '../utils'
import type { StationConfig, TransportMode, AppConfig, Departure } from '../types'

interface ConfiguratorProps {
  config: AppConfig
  allDepartures: Departure[]
  onClose: () => void
}
```

Update the function signature:

```tsx
export default function Configurator({ config, allDepartures, onClose }: ConfiguratorProps) {
```

- [ ] **Step 3: Pass `allDepartures` from App**

In `src/App.tsx`, destructure `allDepartures` from `useDepartures`:

```tsx
const { departures, allDepartures, loading, error, lastUpdate, refetch } = useDepartures(config)
```

Update the Configurator usage near the bottom:

```tsx
{showConfigurator && (
  <Configurator config={config} allDepartures={allDepartures} onClose={() => setShowConfigurator(false)} />
)}
```

- [ ] **Step 4: Verify no TypeScript errors**

```bash
cd C:/git/sl-dashboard && pnpm run build
```

Expected: Build succeeds with no errors.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useDepartures.ts src/App.tsx src/components/Configurator.tsx
git commit -m "feat: expose allDepartures from useDepartures, pass to Configurator"
```

---

### Task 2: Replace direction helpers with tag helpers

**Files:**
- Modify: `src/components/Configurator.tsx`

- [ ] **Step 1: Add per-card direction search state**

In `Configurator.tsx`, after the existing `const [copied, setCopied] = useState(false)` line, add:

```tsx
const [directionQueries, setDirectionQueries] = useState<string[]>(() =>
  config.stations.map(() => '')
)
const [directionDropdownOpen, setDirectionDropdownOpen] = useState<number | null>(null)
```

- [ ] **Step 2: Update `addStation` to keep `directionQueries` in sync**

Replace the existing `addStation` function:

```tsx
function addStation(id: number, name: string) {
  const newStation: StationConfig = {
    siteId: id,
    name,
    mode: 'METRO',
    walkTime: 10,
    direction: 'all',
  }
  setStations(prev => [...prev, newStation])
  setDirectionQueries(prev => [...prev, ''])
  setQuery('')
  setShowResults(false)
}
```

- [ ] **Step 3: Update `removeStation` to keep `directionQueries` in sync**

Replace the existing `removeStation` function:

```tsx
function removeStation(index: number) {
  setStations(prev => prev.filter((_, i) => i !== index))
  setDirectionQueries(prev => prev.filter((_, i) => i !== index))
}
```

- [ ] **Step 4: Delete `directionToDisplay` and `displayToDirection`**

Remove these two functions entirely (they are around lines 78–90 of the current file):

```tsx
// DELETE:
function directionToDisplay(direction: string): string { ... }
function displayToDirection(value: string, current: string): string { ... }
```

- [ ] **Step 5: Add tag helper functions**

Add these helpers after the `handleApply` function:

```tsx
function getDirectionTags(direction: string): string[] {
  if (direction === 'all') return []
  return direction.split('|').filter(Boolean)
}

function setDirectionTags(index: number, tags: string[]) {
  updateStation(index, { direction: tags.length === 0 ? 'all' : tags.join('|') })
}

function addDirectionTag(index: number, tag: string) {
  const current = getDirectionTags(stations[index].direction)
  if (current.includes(tag)) return
  setDirectionTags(index, [...current, tag])
  setDirectionQueries(prev => prev.map((q, i) => (i === index ? '' : q)))
  setDirectionDropdownOpen(null)
}

function removeDirectionTag(index: number, tag: string) {
  setDirectionTags(index, getDirectionTags(stations[index].direction).filter(t => t !== tag))
}

function getDestinationOptions(station: StationConfig, query: string): string[] {
  const allDestinations = allDepartures
    .filter(d => d.line.transport_mode === station.mode)
    .map(d => d.destination)
  const unique = [...new Set(allDestinations)]
  const q = query.trim().toLowerCase()
  if (!q) return unique
  return unique.filter(dest => dest.toLowerCase().includes(q))
}
```

- [ ] **Step 6: Verify no TypeScript errors**

```bash
cd C:/git/sl-dashboard && pnpm run build
```

Expected: Build succeeds. (There will be JSX errors in the next task since we haven't replaced the JSX yet — that's fine if there are type errors, fix them; JSX compile errors for the removed helpers are expected.)

- [ ] **Step 7: Commit**

```bash
git add src/components/Configurator.tsx
git commit -m "refactor: replace direction helpers with tag helpers"
```

---

### Task 3: Replace direction JSX in station card

**Files:**
- Modify: `src/components/Configurator.tsx`

- [ ] **Step 1: Remove the old direction rows and replace**

In the `stations.map(...)` JSX, find and remove these two blocks:

```tsx
// REMOVE block 1 — the direction select row:
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

// REMOVE block 2 — the custom keywords input:
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
```

Replace both with:

```tsx
<div className="configurator-direction">
  <label className="configurator-direction-toggle">
    <input
      type="checkbox"
      checked={station.direction === 'all'}
      onChange={e => updateStation(index, { direction: e.target.checked ? 'all' : '' })}
    />
    Alla riktningar
  </label>
  {station.direction !== 'all' && (
    <div className="configurator-direction-tags">
      {getDirectionTags(station.direction).map(tag => (
        <span key={tag} className="configurator-tag">
          {tag}
          <button
            className="configurator-tag-remove"
            onClick={() => removeDirectionTag(index, tag)}
          >×</button>
        </span>
      ))}
      <div className="configurator-direction-search-wrap">
        <input
          className="configurator-direction-search"
          placeholder={allDepartures.length === 0 ? 'Inga avgångar att välja från' : 'Lägg till destination…'}
          disabled={allDepartures.length === 0}
          value={directionQueries[index] ?? ''}
          onChange={e => {
            setDirectionQueries(prev => prev.map((q, i) => (i === index ? e.target.value : q)))
            setDirectionDropdownOpen(index)
          }}
          onFocus={() => setDirectionDropdownOpen(index)}
          onBlur={() => setTimeout(() => setDirectionDropdownOpen(null), 150)}
        />
        {directionDropdownOpen === index && (
          <div className="configurator-direction-dropdown">
            {getDestinationOptions(station, directionQueries[index] ?? '').length === 0 ? (
              <div className="configurator-result-item configurator-result-status">Inga träffar</div>
            ) : (
              getDestinationOptions(station, directionQueries[index] ?? '').map(dest => (
                <button
                  key={dest}
                  className="configurator-result-item"
                  onMouseDown={() => addDirectionTag(index, dest)}
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
```

- [ ] **Step 2: Verify no TypeScript errors**

```bash
cd C:/git/sl-dashboard && pnpm run build
```

Expected: Build succeeds with no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/Configurator.tsx
git commit -m "feat: replace direction select with tag-based destination search"
```

---

### Task 4: Style the new direction UI

**Files:**
- Modify: `src/App.css`

- [ ] **Step 1: Remove old direction styles**

In `src/App.css`, delete these two rules (around lines 787–801):

```css
/* DELETE: */
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
```

- [ ] **Step 2: Add new direction styles**

Insert the following after the `.configurator-walk-label` rule (around line 785):

```css
/* Direction toggle + tags */
.configurator-direction {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.configurator-direction-toggle {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.85rem;
  color: #8b9dc3;
  cursor: pointer;
  user-select: none;
}

.configurator-direction-toggle input[type="checkbox"] {
  accent-color: #3b82f6;
  cursor: pointer;
}

.configurator-direction-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  align-items: flex-start;
}

.configurator-tag {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  background: #1a3a5c;
  border: 1px solid rgba(59, 130, 246, 0.4);
  color: #93c5fd;
  border-radius: 12px;
  padding: 0.15rem 0.5rem 0.15rem 0.6rem;
  font-size: 0.8rem;
}

.configurator-tag-remove {
  background: transparent;
  border: none;
  color: #93c5fd;
  cursor: pointer;
  font-size: 0.85rem;
  line-height: 1;
  padding: 0;
  opacity: 0.7;
}

.configurator-tag-remove:hover {
  opacity: 1;
  color: #ef4444;
}

.configurator-direction-search-wrap {
  position: relative;
  width: 100%;
}

.configurator-direction-search {
  background: #1a2e4a;
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: #ffffff;
  border-radius: 6px;
  padding: 0.3rem 0.5rem;
  font-size: 0.85rem;
  width: 100%;
}

.configurator-direction-search::placeholder {
  color: #8b9dc3;
}

.configurator-direction-search:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.configurator-direction-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  background: #0a1628;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  overflow-y: auto;
  max-height: 180px;
  z-index: 10;
}
```

- [ ] **Step 3: Verify build and visual appearance**

```bash
cd C:/git/sl-dashboard && pnpm run build
```

Expected: Build succeeds. Open `pnpm run dev`, open the configurator, confirm:
- Each station card shows "Alla riktningar" checkbox
- Unchecking it shows a search input
- Typing filters real departure destinations
- Clicking a destination adds it as a blue tag
- Clicking × on a tag removes it
- Removing all tags resets to "Alla riktningar" (checked)

- [ ] **Step 4: Commit**

```bash
git add src/App.css
git commit -m "feat: style direction tag search UI"
```
