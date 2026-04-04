# Clear All Stations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Rensa alla" button next to the "Stationer" section label in the Configurator that clears all stations in one click.

**Architecture:** Single-task change. A wrapper div replaces the bare `configurator-label` div so the label and button sit on the same row. The button is conditionally rendered only when the station list is non-empty, and on click resets both `stations` and `directionQueries` state to empty arrays.

**Tech Stack:** React 19, TypeScript, CSS (existing App.css)

---

## File Map

| File | Change |
|------|--------|
| `src/components/Configurator.tsx` | Wrap "Stationer" label + add conditional clear button |
| `src/App.css` | Add `.configurator-section-header` and `.configurator-clear-all` styles |

---

## Task 1: Add "Rensa alla" button

**Files:**
- Modify: `src/components/Configurator.tsx:154-155`
- Modify: `src/App.css` (after `.configurator-label` block, around line 712)

- [ ] **Step 1: Replace the bare label with a header row in `Configurator.tsx`**

Find (lines 154–155):
```tsx
          <div className="configurator-section">
            <div className="configurator-label">Stationer</div>
```

Replace with:
```tsx
          <div className="configurator-section">
            <div className="configurator-section-header">
              <div className="configurator-label">Stationer</div>
              {stations.length > 0 && (
                <button
                  className="configurator-clear-all"
                  onClick={() => { setStations([]); setDirectionQueries([]) }}
                >
                  Rensa alla
                </button>
              )}
            </div>
```

- [ ] **Step 2: Add styles to `src/App.css`**

After the `.configurator-label` block (around line 712), add:

```css
.configurator-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.configurator-clear-all {
  font-size: 0.75rem;
  color: #999;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
}

.configurator-clear-all:hover {
  color: #e53e3e;
}
```

- [ ] **Step 3: Verify TypeScript and lint**

```bash
cd /c/git/sl-dashboard && pnpm tsc && pnpm lint
```

Expected: no errors.

- [ ] **Step 4: Run tests**

```bash
cd /c/git/sl-dashboard && pnpm test
```

Expected: 20 passed (0 failed) — no regressions.

- [ ] **Step 5: Commit**

```bash
git add src/components/Configurator.tsx src/App.css
git commit -m "feat: add Rensa alla button to Configurator station list"
```

---

## Self-Review

**Spec coverage:**
- [x] Button next to "Stationer" label → Step 1
- [x] Only shown when `stations.length > 0` → Step 1 (conditional render)
- [x] Clears `stations` and `directionQueries` → Step 1 (`onClick`)
- [x] Styling — flex row, muted/hover red → Step 2

**Placeholder scan:** None.

**Type consistency:** `setStations` and `setDirectionQueries` are both `Dispatch<SetStateAction<...>>` — already in scope in `Configurator.tsx`, no new types introduced.
