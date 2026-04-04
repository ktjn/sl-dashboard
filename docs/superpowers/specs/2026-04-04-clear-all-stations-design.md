# Clear All Stations — Design Spec

**Goal:** Add a "Rensa alla" button to the Configurator that removes all stations from the list in one click.

---

## Behaviour

- Button appears to the right of the "Stationer" section label
- Only rendered when `stations.length > 0` (hidden when list is already empty)
- On click: clears `stations` state to `[]` and `directionQueries` state to `[]`
- No confirmation dialog — the Configurator can be closed without applying, so the action is recoverable
- After clearing, the existing empty state message is shown: "Inga stationer. Sök nedan för att lägga till."

## Files

| File | Change |
|------|--------|
| `src/components/Configurator.tsx` | Add button next to the "Stationer" label, conditionally rendered |
| `src/App.css` | Add `.configurator-clear-all` style — small, muted/destructive appearance |

## Markup

Inside the `<div className="configurator-section">` that contains the station list, replace:

```tsx
<div className="configurator-label">Stationer</div>
```

With:

```tsx
<div className="configurator-section-header">
  <div className="configurator-label">Stationer</div>
  {stations.length > 0 && (
    <button className="configurator-clear-all" onClick={() => { setStations([]); setDirectionQueries([]) }}>
      Rensa alla
    </button>
  )}
</div>
```

## Styling

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
