# Generic cleanup: copy/branding, repo hygiene, dead lint config

## Problem

Three unrelated-but-modest hygiene issues, grouped into one cleanup pass:

1. The README and `index.html` frame the app around one person's specific
   commute ("from Duvbo and Sundbyberg stations towards Stockholm C"), even
   though the Configurator already supports any station, transport mode, and
   direction filter — the app's *code* is fully generic, but its *copy*
   isn't.
2. Seven files under `.superpowers/brainstorm/1542-1775282978/...` (scratch
   output from an earlier brainstorming session's visual companion) are
   tracked in git. They were committed before a `.gitignore` bug — `.sw?`
   and `.superpowers/` concatenated onto one dead line — was fixed in the
   direction-matching-robustness PR. The pattern is fixed for new commits;
   the already-tracked files remain.
3. `eslint.config.js`'s `files` glob is `**/*.{js,jsx}` only. The project is
   100% TypeScript, so `pnpm lint` currently lints nothing and exits 0
   unconditionally. This was flagged as a Minor finding in a prior PR
   review and deferred.

## Goal

Fix all three without changing any runtime behavior or removing any
feature. `DEFAULT_STATIONS` (Duvbo/Sundbyberg METRO+TRAIN+TRAM) stays
exactly as-is — it's a sensible default, not something to genericize away.

## Non-goals

- No change to `DEFAULT_STATIONS`, the Configurator, or any user-facing
  feature.
- No type-aware ESLint rules (`parserOptions.project`) — `tsconfig.json`'s
  `include` is `src`-only and `e2e/` is intentionally untyped (a separate,
  already-deferred Minor from the Playwright PR); adding type-aware linting
  would require reconciling that scope mismatch, which is out of scope
  here. Non-type-checked `typescript-eslint` rules are enough to make
  `pnpm lint` actually check the codebase.
- No SL color-palette work (separate piece already planned).

## Design

### 1. Copy/branding

`README.md`: rewrite the intro paragraph and Features list to describe the
app as a configurable SL departure board, not a personal-commute tool.
Mention the default board as an example, not the app's identity. Also
removes a stray leftover `.` line currently sitting under the `## Features`
heading (pre-existing formatting bug, unrelated to but caught during this
pass).

`index.html:8`: `<title>` changes from `"SL Avgångar - Duvbo / Sundbyberg"`
to `"SL Avgångar"`. `App.tsx:37-39` already overwrites `document.title` on
mount based on the actual configured stations
(`` `SL Avgångar – ${headerTitle}` ``); the static HTML title is only a
pre-hydration/social-preview fallback and shouldn't imply the two default
stations are the app's identity.

### 2. Repo hygiene

`git rm -r --cached .superpowers/brainstorm/1542-1775282978` removes the
seven tracked files (already excluded from future commits by the earlier
`.gitignore` fix — this just untracks the already-committed ones).

### 3. Dead lint config

`eslint.config.js`: add `typescript-eslint`'s non-type-checked `recommended`
config, widen `files` to `**/*.{js,jsx,ts,tsx}`, and add
`argsIgnorePattern: '^_'` alongside the existing `varsIgnorePattern`
(needed once TS files are linted — `StationCard.tsx`'s intentionally-unused
`_index` destructured prop is an *argument*, not a *variable*, so the
existing `varsIgnorePattern: '^[A-Z_]'` doesn't cover it).

Running this against the current codebase surfaces 5 findings, each with a
concrete fix (no behavior change):

- **`Configurator.test.tsx:8,18`** (`@typescript-eslint/no-explicit-any`) —
  two `any`-typed mock props in a `vi.mock('./StationCard', ...)` factory.
  Replace with a precise inline type for the mocked component's props
  (`station`, `onRemove`).
- **`StationCard.tsx:69`** (`@typescript-eslint/no-unused-vars`) — resolved
  by the `argsIgnorePattern: '^_'` config change above; no code edit.
- **`Configurator.tsx:59-81`** (`react-hooks/set-state-in-effect`) — the
  mode-auto-correct logic calls `setStations` synchronously inside a
  `useEffect` keyed on `availableDepartures`. Rewrite using React's
  documented "adjust state during render" pattern: track the previous
  `availableDepartures` value in state, and when it differs from the
  current render's value, call `setStations` conditionally in the render
  body (not inside an effect). This is the same escape hatch React's own
  docs describe for state that must be corrected in response to changed
  external data, without the extra effect-triggered render pass. Identical
  behavior; the `MODES`-filtering/`changed`-flag logic inside `setStations`
  is unchanged.
- **`useStationSearch.ts:29`** (`react-hooks/set-state-in-effect`) — the
  flagged `setLoading(true)` call is dead code: `loading`'s initial state
  is already `useState(allSitesCache === null)`, and the effect only
  proceeds past its guard clause when `allSitesCache === null` is true —
  meaning `loading` is already `true` every time this line would run.
  Delete the line; zero behavior change.

## Testing

No new tests — this is a behavior-preserving cleanup. The existing suite
must stay green:

- `Configurator.test.tsx`'s `'auto-corrects station mode if it is not
  available at the site'` test continues to pass after the render-time
  rewrite (same assertion, same trigger).
- `useStationSearch.test.ts` continues to pass after removing the dead
  `setLoading(true)` call (loading-state assertions are already driven by
  the initial-state calculation, not the removed line).
- `pnpm lint` exits 0.
- `pnpm exec vitest run` and `pnpm test:e2e` both stay green (`e2e/` files
  are covered by the widened glob syntactically but not type-checked, per
  Non-goals — confirm they don't newly fail non-type-checked lint rules
  either, since `files: '**/*.{js,jsx,ts,tsx}'` now includes them).
