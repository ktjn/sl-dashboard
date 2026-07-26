# Generic cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** De-personalize the app's copy/branding, untrack accidentally-committed scratch files, and fix the dead ESLint config so `pnpm lint` actually checks the (all-TypeScript) codebase — all without changing any runtime behavior or feature.

**Architecture:** Four independent-but-related tasks: copy changes (README/index.html), a `git rm --cached` for stray tracked files, an ESLint config change plus its three mechanical fixes, and one behavior-preserving React effect rewrite (the one non-mechanical finding the config change surfaces).

**Tech Stack:** Existing Vite/React/TypeScript/pnpm toolchain; adds `typescript-eslint` as a devDependency.

## Global Constraints

- No change to `DEFAULT_STATIONS` or any runtime/user-facing behavior (spec Non-goals: "no change to DEFAULT_STATIONS, the Configurator, or any user-facing feature").
- No type-aware ESLint rules (no `parserOptions.project`) — spec Non-goals.
- `pnpm lint` must exit 0 after all tasks are complete.
- `pnpm exec vitest run` and `pnpm test:e2e` must both stay green throughout.

---

### Task 1: De-personalize README and index.html

**Files:**
- Modify: `README.md`
- Modify: `index.html:8`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Rewrite the README intro and Features section**

In `README.md`, replace everything from the `# SL Departure Board` title
through the end of the `## Features` list (i.e. everything before the
`## Tech Stack` heading) with:

```markdown
# SL Departure Board

A configurable real-time departure board for Stockholm public transit (SL). Add any station, transport mode, and direction filter through the built-in configurator — your setup is encoded in the URL, so it's easy to bookmark or share.

## Features

- Real-time departures from the SL Transport API
- Configurable stations, transport modes (Tunnelbana, Pendeltåg, Tvärbanan, Buss), and direction filters
- Walking time indicators showing when to leave
- Responsive design for mobile and desktop

The default board shown on first load covers Metro from Duvbo and Commuter train + Tram from Sundbyberg, towards Stockholm — open the ⚙ menu to configure your own.
```

Leave every section from `## Tech Stack` onward (Tech Stack, Development,
Deployment, API) completely unchanged.

- [ ] **Step 2: Update the static page title**

In `index.html`, change line 8 from:

```html
    <title>SL Avgångar - Duvbo / Sundbyberg</title>
```

to:

```html
    <title>SL Avgångar</title>
```

- [ ] **Step 3: Verify nothing else references the old title text**

Run: `grep -rn "Duvbo / Sundbyberg" . --include="*.ts" --include="*.tsx" --include="*.html" --include="*.md"`
Expected: no matches (this exact string only existed in the two places just edited).

- [ ] **Step 4: Commit**

```bash
git add README.md index.html
git commit -m "docs: de-personalize README and page title"
```

---

### Task 2: Untrack accidentally-committed scratch files

**Files:**
- Remove (from git tracking only, not disk): `.superpowers/brainstorm/1542-1775282978/**`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Confirm the files are already covered by .gitignore**

Run: `git check-ignore -v .superpowers/brainstorm/1542-1775282978/content/waiting.html`
Expected: prints a match against the `.superpowers/` line in `.gitignore` (confirming these files won't be re-added by accident after untracking).

- [ ] **Step 2: Untrack the files**

```bash
git rm -r --cached .superpowers/brainstorm/1542-1775282978
```

Expected output: 7 `rm '.superpowers/brainstorm/1542-1775282978/...'` lines, one per file (5 under `content/`, 2 under `state/`).

- [ ] **Step 3: Confirm they're gone from tracking but still ignored**

Run: `git ls-files | grep superpowers/brainstorm`
Expected: no output (no longer tracked).

- [ ] **Step 4: Commit**

```bash
git commit -m "chore: untrack accidentally-committed brainstorm scratch files"
```

---

### Task 3: Enable TypeScript linting and fix the mechanical findings

**Files:**
- Modify: `package.json` (add `typescript-eslint` devDependency)
- Modify: `eslint.config.js`
- Modify: `src/components/Configurator.test.tsx`
- Modify: `src/hooks/useStationSearch.ts`

**Interfaces:**
- Consumes: nothing from Tasks 1-2.
- Produces: an `eslint.config.js` whose `files` glob covers `**/*.{js,jsx,ts,tsx}`, used (unchanged) by Task 4. After this task, `pnpm lint` reports exactly one remaining error (`Configurator.tsx`'s `react-hooks/set-state-in-effect`), fixed in Task 4.

- [ ] **Step 1: Add typescript-eslint**

Run: `pnpm add -D typescript-eslint`
Expected: `typescript-eslint` added to `package.json` devDependencies, `pnpm-lock.yaml` updated.

- [ ] **Step 2: Widen the ESLint config to cover TypeScript files**

Replace the full contents of `eslint.config.js` with:

```js
import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]', argsIgnorePattern: '^_' }],
    },
  },
])
```

(The base `no-unused-vars` rule is turned off in favor of
`@typescript-eslint/no-unused-vars`, which understands TypeScript syntax;
`argsIgnorePattern: '^_'` is new — it's why `StationCard.tsx`'s
intentionally-unused `_index` prop needs no code change.)

- [ ] **Step 3: Run lint to see the current finding count**

Run: `pnpm lint`
Expected: 5 errors — 2 `@typescript-eslint/no-explicit-any` in
`Configurator.test.tsx`, 1 `react-hooks/set-state-in-effect` in
`Configurator.tsx`, 1 `react-hooks/set-state-in-effect` in
`useStationSearch.ts`. (`StationCard.tsx`'s `_index` should NOT appear —
confirms the `argsIgnorePattern` change worked.)

- [ ] **Step 4: Fix the `any` types in Configurator.test.tsx**

In `src/components/Configurator.test.tsx`, add this import alongside the
existing ones at the top of the file:

```tsx
import type { SiteSearchResult } from '../hooks/useStationSearch'
```

Then change line 8 from:

```tsx
  default: ({ station, onRemove }: any) => (
```

to:

```tsx
  default: ({ station, onRemove }: { station: { name: string; mode: string }; onRemove: () => void }) => (
```

And change line 18 from:

```tsx
  results: [] as any[],
```

to:

```tsx
  results: [] as SiteSearchResult[],
```

- [ ] **Step 5: Remove the dead setLoading(true) call in useStationSearch.ts**

In `src/hooks/useStationSearch.ts`, delete this line (currently line 29,
directly inside the `useEffect` body, right after the guard clause and
`fetchedRef.current = true`):

```ts
    setLoading(true)
```

This is dead code: `loading`'s initial state is `useState(allSitesCache
=== null)` (line 22), and the effect only reaches this point when
`allSitesCache === null` is true (per the guard clause on the line above),
meaning `loading` is already `true` every time this line would execute.
Deleting it is a zero-behavior-change fix, not a functional change.

- [ ] **Step 6: Run lint to confirm exactly one finding remains**

Run: `pnpm lint`
Expected: 1 error — `react-hooks/set-state-in-effect` in
`Configurator.tsx` (fixed in Task 4).

- [ ] **Step 7: Run the unit and e2e suites**

Run: `pnpm exec vitest run`
Expected: PASS — 45/45 (the `Configurator.test.tsx` type changes are
type-only; `useStationSearch.test.ts`'s assertions about the `loading`
value are driven by the initial-state calculation, unaffected by removing
the redundant `setLoading(true)`).

Run: `pnpm test:e2e`
Expected: PASS — 6/6.

- [ ] **Step 8: Commit**

```bash
git add package.json pnpm-lock.yaml eslint.config.js src/components/Configurator.test.tsx src/hooks/useStationSearch.ts
git commit -m "chore: enable TypeScript ESLint checking and fix mechanical findings"
```

---

### Task 4: Rewrite Configurator's mode-auto-correct effect

**Files:**
- Modify: `src/components/Configurator.tsx:59-81`

**Interfaces:**
- Consumes: the ESLint config from Task 3 (unchanged by this task — this task just fixes the one finding it left open).
- Produces: `pnpm lint` exits 0. Nothing else depends on this task.

- [ ] **Step 1: Replace the effect with React's "adjust state during render" pattern**

In `src/components/Configurator.tsx`, replace this block (currently lines
59-81, immediately after the "Fetch data for initial stations" effect):

```tsx
  // When departure data loads for a site, auto-correct any station whose mode is not available there
  useEffect(() => {
    setStations(prev => {
      let changed = false
      const next = prev.map(station => {
        const siteHasData = availableDepartures.some(d => d.originSiteId === station.siteId)
        if (!siteHasData) return station

        const validModes = MODES.filter(m =>
          availableDepartures.some(d =>
            d.originSiteId === station.siteId && d.departure.line.transport_mode === m
          )
        )

        if (validModes.length > 0 && !validModes.includes(station.mode)) {
          changed = true
          return { ...station, mode: validModes[0], direction: 'all' }
        }
        return station
      })
      return changed ? next : prev
    })
  }, [availableDepartures])
```

with:

```tsx
  // When departure data loads for a site, auto-correct any station whose mode is not available there.
  // Uses React's "adjust state during render" pattern instead of an effect, since calling setState
  // synchronously inside useEffect triggers an extra render pass (react-hooks/set-state-in-effect).
  const [prevAvailableDepartures, setPrevAvailableDepartures] = useState(availableDepartures)
  if (availableDepartures !== prevAvailableDepartures) {
    setPrevAvailableDepartures(availableDepartures)
    setStations(prev => {
      let changed = false
      const next = prev.map(station => {
        const siteHasData = availableDepartures.some(d => d.originSiteId === station.siteId)
        if (!siteHasData) return station

        const validModes = MODES.filter(m =>
          availableDepartures.some(d =>
            d.originSiteId === station.siteId && d.departure.line.transport_mode === m
          )
        )

        if (validModes.length > 0 && !validModes.includes(station.mode)) {
          changed = true
          return { ...station, mode: validModes[0], direction: 'all' }
        }
        return station
      })
      return changed ? next : prev
    })
  }
```

Do not change anything else in the file — `useEffect` stays imported and
used (the "Fetch data for initial stations" effect immediately above this
block still needs it).

- [ ] **Step 2: Run lint to confirm zero findings remain**

Run: `pnpm lint`
Expected: exit code 0, no errors.

- [ ] **Step 3: Run the full test suites**

Run: `pnpm exec vitest run`
Expected: PASS — 45/45, including `Configurator.test.tsx`'s
`'auto-corrects station mode if it is not available at the site'` test
(same assertion, same trigger — this rewrite is behavior-preserving).

Run: `pnpm test:e2e`
Expected: PASS — 6/6, including `configurator-workflow.spec.ts` (exercises
the Configurator UI end-to-end; unaffected by this internal rewrite).

- [ ] **Step 4: Manually verify in the dev server**

Run: `pnpm dev`, open the app, open the Configurator, and add a station via
search whose available departures don't include METRO (the Configurator's
default mode for newly-added stations) — confirm the station's mode field
auto-updates to a mode that IS available at that site once its departure
data loads, exactly as before this rewrite.

- [ ] **Step 5: Commit**

```bash
git add src/components/Configurator.tsx
git commit -m "refactor: rewrite Configurator's mode auto-correct as render-time state adjustment"
```
