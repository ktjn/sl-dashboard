# Direction-matching robustness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface the SL API's `direction` field as a discoverable, robust filter option in the Configurator's direction picker, alongside the existing (less stable) `destination` values.

**Architecture:** Pure-function helpers in `StationCard.tsx` compute two deduped, query-filtered option lists (direction values, destination values with direction values excluded). The dropdown renders them as two labeled groups. Picking a direction option adds an `=`-prefixed exact-match keyword (already supported by `matchesDirection` in `utils.ts` — no changes there); picking a destination option keeps today's raw substring keyword. Tag chips strip a leading `=` for display only.

**Tech Stack:** React 19, TypeScript, Vitest, @testing-library/react.

## Global Constraints

- No changes to `StationConfig`/`AppConfig`/URL query format (spec: "No changes to the `StationConfig`/`AppConfig`/URL query format").
- No changes to `matchesDirection` matching logic in `utils.ts` — it already supports `=exact` keywords (spec: "No code changes" to matching).
- No use of `direction_code` (spec: "No use of the numeric `direction_code` field").
- Existing shared URLs with raw (non-`=`) direction keywords must keep matching exactly as before (spec: "no behavior change for existing shared links").

---

### Task 1: Direction/destination grouping in the Configurator's direction picker

**Files:**
- Modify: `src/components/StationCard.tsx`
- Modify: `src/App.css` (append new rules; do not touch existing rules)
- Create: `src/components/StationCard.test.tsx`

**Interfaces:**
- Consumes: `StationConfig` and `SiteDeparture` types (unchanged, from `src/types.ts` and `src/hooks/useDepartures.ts`); existing `StationCardProps` (unchanged shape).
- Produces: no new exports — `StationCard` remains the default export with the same prop signature. Internal helpers `getUniqueDirections`, `getUniqueDestinations`, `filterByQuery`, `displayTag` are module-private (not exported), used only within `StationCard.tsx`.

- [ ] **Step 1: Write the failing tests**

Create `src/components/StationCard.test.tsx`:

```tsx
import type { ComponentProps } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import StationCard from './StationCard'
import type { StationConfig } from '../types'
import type { SiteDeparture } from '../hooks/useDepartures'

function makeStation(overrides: Partial<StationConfig> = {}): StationConfig {
  return { siteId: 9324, name: 'Duvbo', mode: 'METRO', walkTime: 10, direction: '', ...overrides }
}

function makeDeparture(destination: string, direction: string | undefined, originSiteId = 9324): SiteDeparture {
  return {
    originSiteId,
    departure: {
      destination,
      direction,
      display: '5 min',
      scheduled: '2026-04-04T12:10:00Z',
      line: { id: 10, designation: '10', transport_mode: 'METRO' }
    }
  }
}

const defaultDepartures: SiteDeparture[] = [
  makeDeparture('T-Centralen', 'Kungsträdgården'),
  makeDeparture('Hjulsta', 'Hjulsta'),
]

function renderCard(overrides: Partial<ComponentProps<typeof StationCard>> = {}) {
  const onAddDirectionTag = vi.fn()
  const props: ComponentProps<typeof StationCard> = {
    station: makeStation(),
    index: 0,
    isDragging: false,
    directionQuery: '',
    directionDropdownOpen: true,
    availableDepartures: defaultDepartures,
    onUpdate: vi.fn(),
    onRemove: vi.fn(),
    onDragStart: vi.fn(),
    onDrop: vi.fn(),
    onDragEnd: vi.fn(),
    onDirectionQueryChange: vi.fn(),
    onDirectionDropdownOpen: vi.fn(),
    onDirectionDropdownClose: vi.fn(),
    onAddDirectionTag,
    onRemoveDirectionTag: vi.fn(),
    ...overrides,
  }
  render(<StationCard {...props} />)
  return { onAddDirectionTag }
}

describe('StationCard direction picker', () => {
  it('groups options into Riktning (direction) and Slutstation (destination), excluding duplicates', () => {
    renderCard()
    expect(screen.getByText('Riktning')).toBeDefined()
    expect(screen.getByText('Slutstation')).toBeDefined()
    expect(screen.getByRole('button', { name: 'Kungsträdgården' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Hjulsta' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'T-Centralen' })).toBeDefined()
  })

  it('adds an exact-match tag when a direction option is picked', () => {
    const { onAddDirectionTag } = renderCard()
    fireEvent.click(screen.getByRole('button', { name: 'Kungsträdgården' }))
    expect(onAddDirectionTag).toHaveBeenCalledWith('=Kungsträdgården')
  })

  it('adds a raw substring tag when a destination option is picked', () => {
    const { onAddDirectionTag } = renderCard()
    fireEvent.click(screen.getByRole('button', { name: 'T-Centralen' }))
    expect(onAddDirectionTag).toHaveBeenCalledWith('T-Centralen')
  })

  it('renders an exact-match tag chip without the leading =', () => {
    renderCard({ station: makeStation({ direction: '=Kungsträdgården' }) })
    expect(screen.getByText('Kungsträdgården')).toBeDefined()
    expect(screen.queryByText('=Kungsträdgården')).toBeNull()
  })

  it('hides both groups and shows "Inga träffar" when the query matches nothing', () => {
    renderCard({ directionQuery: 'zzz-no-match' })
    expect(screen.queryByText('Riktning')).toBeNull()
    expect(screen.queryByText('Slutstation')).toBeNull()
    expect(screen.getByText('Inga träffar')).toBeDefined()
  })

  it('a value present in both destination and direction is listed only under Riktning', () => {
    renderCard({
      availableDepartures: [makeDeparture('Hjulsta', 'Hjulsta')],
    })
    expect(screen.getAllByRole('button', { name: 'Hjulsta' })).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test -- StationCard.test.tsx`
Expected: FAIL — `getByText('Riktning')` etc. not found, because `StationCard.tsx` doesn't yet group options or emit `=`-prefixed tags.

- [ ] **Step 3: Implement the grouping in StationCard.tsx**

In `src/components/StationCard.tsx`, replace the existing `getDestinationOptions` function (lines 30-44) with:

```tsx
function displayTag(tag: string): string {
  return tag.startsWith('=') ? tag.slice(1) : tag
}

function getUniqueDirections(
  station: StationConfig,
  availableDepartures: SiteDeparture[]
): string[] {
  const values = availableDepartures
    .filter(({ departure: d, originSiteId }) =>
      originSiteId === station.siteId && d.line.transport_mode === station.mode
    )
    .map(({ departure: d }) => d.direction)
    .filter((d): d is string => Boolean(d))
  return [...new Set(values)]
}

function getUniqueDestinations(
  station: StationConfig,
  availableDepartures: SiteDeparture[],
  excluded: Set<string>
): string[] {
  const values = availableDepartures
    .filter(({ departure: d, originSiteId }) =>
      originSiteId === station.siteId && d.line.transport_mode === station.mode
    )
    .map(({ departure: d }) => d.destination)
    .filter(dest => !excluded.has(dest))
  return [...new Set(values)]
}

function filterByQuery(values: string[], query: string): string[] {
  const q = query.trim().toLowerCase()
  if (!q) return values
  return values.filter(v => v.toLowerCase().includes(q))
}
```

Then, inside the `StationCard` component body, replace:

```tsx
  const tags = getDirectionTags(station.direction)
  const options = getDestinationOptions(station, availableDepartures, directionQuery)
```

with:

```tsx
  const tags = getDirectionTags(station.direction)
  const rawDirections = getUniqueDirections(station, availableDepartures)
  const directionOptions = filterByQuery(rawDirections, directionQuery)
  const destinationOptions = filterByQuery(
    getUniqueDestinations(station, availableDepartures, new Set(rawDirections)),
    directionQuery
  )
```

Then replace the tag-rendering block:

```tsx
              {tags.map(tag => (
                <span key={tag} className="configurator-tag">
                  {tag}
                  <button
                    className="configurator-tag-remove"
                    onClick={() => onRemoveDirectionTag(tag)}
                  >×</button>
                </span>
              ))}
```

with:

```tsx
              {tags.map(tag => (
                <span key={tag} className="configurator-tag">
                  {displayTag(tag)}
                  <button
                    className="configurator-tag-remove"
                    onClick={() => onRemoveDirectionTag(tag)}
                  >×</button>
                </span>
              ))}
```

Then replace the dropdown-options block:

```tsx
                {directionDropdownOpen && (
                  <div className="configurator-direction-dropdown">
                    {options.length === 0 ? (
                      <div className="configurator-result-item configurator-result-status">Inga träffar</div>
                    ) : (
                      options.map(dest => (
                        <button
                          key={dest}
                          className="configurator-result-item"
                          onClick={() => onAddDirectionTag(dest)}
                        >
                          {dest}
                        </button>
                      ))
                    )}
                  </div>
                )}
```

with:

```tsx
                {directionDropdownOpen && (
                  <div className="configurator-direction-dropdown">
                    {directionOptions.length === 0 && destinationOptions.length === 0 ? (
                      <div className="configurator-result-item configurator-result-status">Inga träffar</div>
                    ) : (
                      <>
                        {directionOptions.length > 0 && (
                          <div className="configurator-direction-group">
                            <div className="configurator-direction-group-label">Riktning</div>
                            {directionOptions.map(dir => (
                              <button
                                key={dir}
                                className="configurator-result-item"
                                onClick={() => onAddDirectionTag(`=${dir}`)}
                              >
                                {dir}
                              </button>
                            ))}
                          </div>
                        )}
                        {destinationOptions.length > 0 && (
                          <div className="configurator-direction-group">
                            <div className="configurator-direction-group-label">Slutstation</div>
                            {destinationOptions.map(dest => (
                              <button
                                key={dest}
                                className="configurator-result-item"
                                onClick={() => onAddDirectionTag(dest)}
                              >
                                {dest}
                              </button>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test -- StationCard.test.tsx`
Expected: PASS (all 6 tests)

- [ ] **Step 5: Add styling for the new option groups**

In `src/App.css`, immediately after the `.configurator-direction-dropdown { ... }` rule (ends at line 899), append:

```css
.configurator-direction-group + .configurator-direction-group {
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.configurator-direction-group-label {
  padding: 0.35rem 0.75rem 0.2rem;
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #8b9dc3;
}
```

- [ ] **Step 6: Run the full test suite and typecheck**

Run: `pnpm typecheck && pnpm test`
Expected: PASS — no type errors, all existing tests (including `Configurator.test.tsx`, which mocks `StationCard` and is unaffected) still pass.

- [ ] **Step 7: Manually verify in the dev server**

Run: `pnpm dev`, open the app, open the Configurator (⚙), toggle "Alla riktningar" off on a station with live departures, and confirm the dropdown shows "Riktning" and "Slutstation" groups, that picking a "Riktning" value adds a tag, and that the tag displays without a leading `=`.

- [ ] **Step 8: Commit**

```bash
git add src/components/StationCard.tsx src/components/StationCard.test.tsx src/App.css
git commit -m "feat: surface direction values as a robust filter option in the direction picker"
```
