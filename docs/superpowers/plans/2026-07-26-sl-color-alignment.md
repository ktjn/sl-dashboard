# SL color alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace every color in the app with the corresponding real, current SL brand token (sourced from `sl.se`'s live CSS), covering both transit line/mode colors and the general UI chrome.

**Architecture:** Pure value substitution across three files (`src/constants.ts`, `index.html`, `src/App.css`) — no layout, component, or behavior changes. Two tasks: one for the transit-domain color constants (small), one for the full `App.css` UI-chrome palette (larger, mechanical).

**Tech Stack:** No new dependencies — plain CSS/TS literal edits.

## Global Constraints

- Every replacement value must be one of the real SL tokens listed in the
  spec's "Source of truth" section — no invented colors (spec Non-goals).
- No layout, component structure, or behavior changes — pure color
  substitution (spec Non-goals).
- No light-theme variant — stays dark-themed (spec Non-goals).
- `pnpm exec vitest run` and `pnpm test:e2e` must both stay green throughout
  (spec Testing).

---

### Task 1: Update transit line/mode colors and theme-color meta

**Files:**
- Modify: `src/constants.ts`
- Modify: `index.html:7`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing consumed by Task 2 (App.css doesn't reference these
  constants — they're independent files).

- [ ] **Step 1: Update `LINE_COLORS` in `src/constants.ts`**

Replace the `LINE_COLORS` object (lines 10-33) with:

```ts
export const LINE_COLORS: Record<number, string> = {
  // Metro green line
  17: '#148541',
  18: '#148541',
  19: '#148541',
  // Metro red line
  13: '#d71d24',
  14: '#d71d24',
  // Metro blue line
  10: '#007db8',
  11: '#007db8',
  // Tvärbanan
  30: '#a36b00',
  31: '#a36b00',
  // Pendeltåg (pink)
  40: '#cc417f',
  41: '#cc417f',
  42: '#cc417f',
  43: '#cc417f',
  44: '#cc417f',
  45: '#cc417f',
  46: '#cc417f',
  48: '#cc417f',
}
```

- [ ] **Step 2: Update `TRANSPORT_TYPES` in `src/constants.ts`**

Replace the `TRANSPORT_TYPES` object (lines 3-8) with:

```ts
export const TRANSPORT_TYPES: Record<TransportMode, TransportTypeConfig> = {
  METRO: { name: 'Tunnelbana', icon: 'T', color: '#ffffff', bgColor: '#000000' },
  TRAM: { name: 'Tvärbanan', icon: 'L', color: '#ffffff', bgColor: '#a36b00' },
  TRAIN: { name: 'Pendeltåg', icon: 'J', color: '#ffffff', bgColor: '#cc417f' },
  BUS: { name: 'Buss', icon: 'B', color: '#ffffff', bgColor: '#2870f0' }
}
```

(Only `TRAM.bgColor` and `TRAIN.bgColor` — updated to match `LINE_COLORS`
Tvärbanan/Pendeltåg — and `BUS.bgColor` — updated to SL's primary blue —
actually change; `METRO.bgColor` stays `#000000`.)

- [ ] **Step 3: Update the theme-color meta tag in `index.html`**

Change line 7 from:

```html
    <meta name="theme-color" content="#0066b3" />
```

to:

```html
    <meta name="theme-color" content="#0a47c2" />
```

- [ ] **Step 4: Run the unit and e2e suites**

Run: `pnpm exec vitest run`
Expected: PASS — 46/46 (no test asserts on specific hex values).

Run: `pnpm test:e2e`
Expected: PASS — 6/6.

- [ ] **Step 5: Commit**

```bash
git add src/constants.ts index.html
git commit -m "style: align transit line/mode colors with SL's current brand tokens"
```

---

### Task 2: Update App.css to SL's brand palette

**Files:**
- Modify: `src/App.css`

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: nothing — final task.

**Context:** `src/App.css` uses several old values in more than one
semantic role, so a single global find-and-replace per color is not always
safe. Two values need a special case handled *before* their general
replacement:

- `#ef4444` is the `.error button` background (line 367) AND the general
  error text/border/icon color everywhere else. The button needs
  error-300 `#f05555` (paired with its existing `#dc2626` hover, which
  becomes error-400 `#ce3333`); every other `#ef4444` becomes error-400
  `#ce3333`.
- `#0066b3` is the header gradient's *start* color (line 22, paired with
  `#004a82` as the gradient end) AND the general brand-blue color
  elsewhere. The gradient needs primary-400 `#2870f0` → primary-500
  `#0a47c2`; every other `#0066b3` becomes primary-500 `#0a47c2`.

- [ ] **Step 1: Handle the two order-sensitive exceptions first**

Run these two commands (they target exact, unique substrings so they can't
accidentally match anything else in the file):

```bash
sed -i '367s/#ef4444/#f05555/' src/App.css
sed -i '22s/#0066b3 0%, #004a82 100%/#2870f0 0%, #0a47c2 100%/' src/App.css
```

- [ ] **Step 2: Verify the two exceptions landed correctly**

Run: `sed -n '367p;22p' src/App.css`
Expected:
```
22:  background: linear-gradient(135deg, #2870f0 0%, #0a47c2 100%);
367:  background: #f05555;
```
(Line 367's full content includes surrounding context — just confirm it now
reads `#f05555`, not `#ef4444`.)

- [ ] **Step 3: Apply the remaining global substitutions**

Run these in order (order doesn't matter for these — none of the target
values collide with any of the source values being searched for):

```bash
sed -i 's/#dc2626/#ce3333/g' src/App.css
sed -i 's/#ef4444/#ce3333/g' src/App.css
sed -i 's/#e53e3e/#ce3333/g' src/App.css
sed -i 's/rgba(239, 68, 68,/rgba(206, 51, 51,/g' src/App.css

sed -i 's/#1a1a2e/#12151a/g' src/App.css
sed -i 's/#16213e/#20252c/g' src/App.css
sed -i 's/#0f3460/#20252c/g' src/App.css
sed -i 's/#0a1628/#000000/g' src/App.css
sed -i 's/#1a2e4a/#000000/g' src/App.css
sed -i 's/#1a3a5c/#000000/g' src/App.css

sed -i 's/#0066b3/#0a47c2/g' src/App.css
sed -i 's/rgba(0, 102, 179,/rgba(10, 71, 194,/g' src/App.css

sed -i 's/#8b9dc3/#8a8e93/g' src/App.css
sed -i 's/#6b7280/#73777d/g' src/App.css
sed -i 's/color: #999;/color: #8a8e93;/' src/App.css

sed -i 's/#4ade80/#1d9f64/g' src/App.css
sed -i 's/rgba(74, 222, 128,/rgba(29, 159, 100,/g' src/App.css

sed -i 's/#fbbf24/#fb9e53/g' src/App.css
sed -i 's/rgba(251, 191, 36,/rgba(251, 158, 83,/g' src/App.css

sed -i 's/#f97316/#d07432/g' src/App.css

sed -i 's/rgba(236, 97, 159,/rgba(204, 65, 127,/g' src/App.css
sed -i 's/rgba(100, 100, 100,/rgba(115, 119, 125,/g' src/App.css

sed -i 's/#3b82f6/#2870f0/g' src/App.css
sed -i 's/rgba(59, 130, 246,/rgba(40, 112, 240,/g' src/App.css

sed -i 's/#93c5fd/#7ab4ff/g' src/App.css
sed -i 's/#7ec8e3/#afdff9/g' src/App.css
```

- [ ] **Step 4: Verify no old color values remain**

Run:
```bash
grep -oE '#(1a1a2e|0066b3|004a82|16213e|0f3460|0a1628|1a2e4a|1a3a5c|8b9dc3|6b7280|999|ef4444|dc2626|e53e3e|4ade80|fbbf24|f97316|3b82f6|93c5fd|7ec8e3)\b' src/App.css
```
Expected: no output (empty — every old value has been replaced).

Run:
```bash
grep -oE 'rgba\((239, 68, 68|74, 222, 128|251, 191, 36|236, 97, 159|100, 100, 100|59, 130, 246|0, 102, 179)' src/App.css
```
Expected: no output.

- [ ] **Step 5: Run the unit and e2e suites**

Run: `pnpm exec vitest run`
Expected: PASS — 46/46.

Run: `pnpm test:e2e`
Expected: PASS — 6/6.

- [ ] **Step 6: Manually verify in the dev server**

Run: `pnpm dev`, open the app, and confirm:
- The page background, header, footer, and cards render in the new
  dark-neutral tones (no leftover navy/purple).
- The header gradient and any brand-blue accents (spinner, configurator
  header) show the new SL blue.
- Live departures (if reachable) show the updated Metro/Tvärbanan/Pendeltåg
  line colors.
- Text remains legible against its background everywhere — no color
  combination reads as low-contrast or hard to read.
- Error, success (live indicator), and warning/leave-soon states still
  read clearly as their respective status colors.

- [ ] **Step 7: Commit**

```bash
git add src/App.css
git commit -m "style: align UI chrome colors with SL's current brand palette"
```
