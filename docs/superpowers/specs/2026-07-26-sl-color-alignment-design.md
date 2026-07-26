# Align app colors with SL's current brand palette

## Problem

The app's colors don't match SL's actual current brand identity:

- Transit line/mode colors in `src/constants.ts` (`LINE_COLORS`,
  `TRANSPORT_TYPES`) use approximate/outdated shades rather than SL's
  current official values.
- The general UI chrome (`src/App.css`) uses a generic dark navy/purple
  "space dashboard" palette with no relationship to SL's brand at all —
  arbitrary blues, a generic green/amber/red status palette, etc.

## Goal

Replace every color in the app with the corresponding real, current SL
brand token, sourced directly from `sl.se`'s live CSS custom properties
(fetched and verified during design — see mapping below). Pure color
substitution: no layout, behavior, or component structure changes.

## Non-goals

- No light-theme variant — the app stays dark-themed, just rebuilt from
  SL's actual dark-end neutral tokens instead of an arbitrary navy palette.
- No new colors invented — every replacement value is a real SL design
  token (`--color-*` custom property currently live on sl.se), not a
  hand-picked approximation.
- No changes to which UI elements are colored or how (e.g. not adding new
  status states) — only the hex values themselves change.

## Design

### Source of truth

Colors are sourced from SL's live CSS (fetched via the site's own
`_next/static/chunks/*.css` bundles), specifically these `--color-*`
custom properties:

```
--color-metro-blue: #007db8      --color-metro-green: #148541
--color-metro-red: #d71d24       --color-tram-tvarbanan: #a36b00
--color-train-commuterrail: #cc417f
--color-primary-200: #afdff9     --color-primary-300: #7ab4ff
--color-primary-400: #2870f0     --color-primary-500: #0a47c2
--color-neutral-450: #8a8e93     --color-neutral-500: #73777d
--color-neutral-700: #20252c     --color-neutral-800: #12151a
--color-neutral-900: #000
--color-error-300: #f05555       --color-error-400: #ce3333
--color-success-300: #1d9f64
--color-warning-300: #fb9e53     --color-warning-400: #d07432
```

### Elevation system (dark theme)

The current CSS mixes several near-identical dark navy shades
(`#1a1a2e`, `#16213e`, `#0f3460`, `#0a1628`, `#1a2e4a`, `#1a3a5c`) without a
clear hierarchy. Replaced with a coherent 3-tier system using SL's real
neutral ramp:

| Tier | Old value(s) | New value | Used for |
|---|---|---|---|
| Page background | `#1a1a2e` | neutral-800 `#12151a` | `.app` |
| Elevated surface | `#16213e`, `#0f3460` | neutral-700 `#20252c` | header, footer, transport sections, configurator panel/header |
| Recessed/inset | `#0a1628`, `#1a2e4a`, `#1a3a5c` | neutral-900 `#000000` | inputs, dropdowns, URL preview, tag chip backgrounds |

### Brand blue

| Old | New | Used for |
|---|---|---|
| `#0066b3` (gradient start), `#004a82` (gradient end) | primary-400 `#2870f0` → primary-500 `#0a47c2` | header gradient |
| `#0066b3` | primary-500 `#0a47c2` | brand text, spinner border-top, configurator header bg |
| `#3b82f6` | primary-400 `#2870f0` | checkbox accent-color |
| `#93c5fd` | primary-300 `#7ab4ff` | tag chip text/border |
| `#7ec8e3` | primary-200 `#afdff9` | URL preview monospace text |
| `#0066b3` (`index.html` theme-color meta) | `#0a47c2` | browser chrome theming |

### Semantic status colors

| Old | New | Used for |
|---|---|---|
| `#ef4444`, `#e53e3e` (text/border/icon roles) | error-400 `#ce3333` | error message text, border-left accents, urgent leave-value, search error text |
| `#ef4444` → `#dc2626` (button bg → hover) | error-300 `#f05555` → error-400 `#ce3333` | clear-station button bg/hover |
| `#4ade80` | success-300 `#1d9f64` | live indicator dot, on-time walking-time colors |
| `#fbbf24` | warning-300 `#fb9e53` | leave-soon color (lighter) |
| `#f97316` | warning-400 `#d07432` | leave-soon color (stronger variant) |

### Muted text

| Old | New |
|---|---|
| `#8b9dc3` (pervasive secondary text, ~18 usages) | neutral-450 `#8a8e93` |
| `#6b7280` (too-late text) | neutral-500 `#73777d` |
| `#999` (Rensa alla button) | neutral-450 `#8a8e93` |

`#ffffff` is unchanged (already matches SL's neutral-100).

### Transit line/mode colors (`src/constants.ts`)

| Constant | Old | New |
|---|---|---|
| `LINE_COLORS` metro green (17,18,19) | `#009B3A` | `#148541` |
| `LINE_COLORS` metro red (13,14) | `#E8331B` | `#d71d24` |
| `LINE_COLORS` metro blue (10,11) | `#0066B3` | `#007db8` |
| `LINE_COLORS` Tvärbanan (30,31) | `#7D4E24` | `#a36b00` |
| `LINE_COLORS` Pendeltåg (40,41,42,43,44,45,46,48) | `#EC619F` | `#cc417f` |
| `TRANSPORT_TYPES.BUS.bgColor` | `#1E88E5` | `#2870f0` (primary blue — SL buses have no dedicated line color; kept distinct from the black Metro/Tram/Train badges for at-a-glance mode recognition in this app's UI, which is not something SL's own pictogram system needs to solve) |
| `TRANSPORT_TYPES.METRO.bgColor` | `#000000` | unchanged (matches SL's black mode-pictogram convention) |
| `TRANSPORT_TYPES.TRAM.bgColor` | `#7D4E24` | `#a36b00` (matches `LINE_COLORS` Tvärbanan) |
| `TRANSPORT_TYPES.TRAIN.bgColor` | `#EC619F` | `#cc417f` (matches `LINE_COLORS` Pendeltåg) |

## Testing

Pure CSS/constant value changes — no new tests needed. Existing tests
(`DepartureRow.test.tsx`, etc.) don't assert on specific hex values, so
they're unaffected. Verify:

- `pnpm exec vitest run` and `pnpm test:e2e` both stay green (no visual
  assertions in either suite to break).
- Manual check in `pnpm dev`: confirm the app renders with the new palette,
  all text remains legible against its background (no color combination
  becomes low-contrast), and the three metro line colors, Tvärbanan, and
  Pendeltåg badges show their new colors when real departure data loads.
