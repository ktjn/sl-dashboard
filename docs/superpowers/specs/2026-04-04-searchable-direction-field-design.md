# Searchable Direction Field

**Date:** 2026-04-04

## Summary

Replace the static direction dropdown + raw keyword text input in the Configurator with a tag-based search UI backed by live departure destinations.

## Problem

The current direction field has three options: "→ Stockholm" (hardcoded preset), "Alla riktningar", and "Anpassad…" (which reveals a raw pipe-separated text input). The custom text input is unfriendly — users must know destination keywords and the `|` separator format by heart. There's no discoverability.

## Design

### Direction field replacement

Each station card's direction row is replaced with:

1. **"Alla riktningar" toggle** — a pill/checkbox. When active, `direction = 'all'`. When inactive, shows the tag + search UI below.

2. **Selected destination tags** — a row of removable chips showing currently-selected destinations (e.g. "Farsta strand ×", "Hagsätra ×"). Maps to the existing `keyword1|keyword2` format.

3. **Search input** — a text field that filters unique destination names extracted from live `departures` for the station's `siteId` + `mode`. Shows a dropdown of matches. Clicking a result adds it as a tag (no duplicates).

4. **Empty state** — if `departures` for this station are empty (not yet loaded or no data), the search input is disabled with placeholder text "Inga avgångar att välja från".

### Data flow

`App` passes its `departures: Departure[]` array as a new prop to `Configurator`. Inside each station card, available destinations are derived inline by filtering `departures` where `siteId` matches and `line.transport_mode` matches, then collecting unique `departure.destination` values.

### Direction format

No change to the URL format. Tags map directly to `keyword1|keyword2`. The `'stockholm'` hardcoded preset is removed — users pick real destinations from live data.

### Removed

- The `<select>` with `stockholm / all / custom` options
- The raw keyword text `<input>` (custom mode)
- The `directionToDisplay` and `displayToDirection` helper functions in `Configurator.tsx`

## Architecture

Changes are confined to:

- `src/App.tsx` — pass `departures` prop to `Configurator`
- `src/components/Configurator.tsx` — accept `departures` prop; replace direction UI; add destination filtering logic and tag state per station card
- `src/utils.ts` — remove or update `matchesDirection` if needed (no change expected — keyword matching already works)
- `src/types.ts` — update `ConfiguratorProps` to include `departures: Departure[]`

No new files needed. No hook changes needed.

## Edge cases

- **No departures loaded yet:** search disabled, placeholder shown.
- **Direction already set to `'all'`:** toggle renders active, no tags shown.
- **Direction has existing keywords from URL:** parse `keyword1|keyword2` into initial tags on mount.
- **Duplicate tag:** ignore if user tries to add an already-selected destination.
- **All tags removed:** direction defaults to `'all'` to avoid silently showing no departures.
