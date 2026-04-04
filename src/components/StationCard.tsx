import type { StationConfig, TransportMode } from '../types'
import type { SiteDeparture } from '../hooks/useDepartures'
import { TRANSPORT_TYPES, MODES } from '../constants'

interface StationCardProps {
  station: StationConfig
  index: number
  isDragging: boolean
  directionQuery: string
  directionDropdownOpen: boolean
  availableDepartures: SiteDeparture[]
  onUpdate: (patch: Partial<StationConfig>) => void
  onRemove: () => void
  onDragStart: () => void
  onDrop: () => void
  onDragEnd: () => void
  onDirectionQueryChange: (value: string) => void
  onDirectionDropdownOpen: () => void
  onDirectionDropdownClose: () => void
  onAddDirectionTag: (tag: string) => void
  onRemoveDirectionTag: (tag: string) => void
}

function getDirectionTags(direction: string): string[] {
  if (direction === 'all') return []
  return direction.split('|').filter(Boolean)
}

function getDestinationOptions(
  station: StationConfig,
  availableDepartures: SiteDeparture[],
  query: string
): string[] {
  const allDestinations = availableDepartures
    .filter(({ departure: d, originSiteId }) =>
      originSiteId === station.siteId && d.line.transport_mode === station.mode
    )
    .map(({ departure: d }) => d.destination)
  const unique = [...new Set(allDestinations)]
  const q = query.trim().toLowerCase()
  if (!q) return unique
  return unique.filter(dest => dest.toLowerCase().includes(q))
}

export default function StationCard({
  station,
  index: _index,
  isDragging,
  directionQuery,
  directionDropdownOpen,
  availableDepartures,
  onUpdate,
  onRemove,
  onDragStart,
  onDrop,
  onDragEnd,
  onDirectionQueryChange,
  onDirectionDropdownOpen,
  onDirectionDropdownClose,
  onAddDirectionTag,
  onRemoveDirectionTag,
}: StationCardProps) {
  const availableModes = availableDepartures.some(d => d.originSiteId === station.siteId)
    ? MODES.filter(m => availableDepartures.some(d =>
        d.originSiteId === station.siteId && d.departure.line.transport_mode === m
      ))
    : MODES

  const tags = getDirectionTags(station.direction)
  const options = getDestinationOptions(station, availableDepartures, directionQuery)

  return (
    <div
      className={`configurator-card${isDragging ? ' dragging' : ''}`}
      draggable
      onDragStart={onDragStart}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
    >
      <div className="configurator-drag-handle">⠿</div>
      <div className="configurator-card-fields">
        <div className="configurator-card-name">{station.name}</div>
        <div className="configurator-card-row">
          <select
            className="configurator-select"
            value={station.mode}
            onChange={e => onUpdate({ mode: e.target.value as TransportMode, direction: 'all' })}
          >
            {availableModes.map(m => (
              <option key={m} value={m}>{TRANSPORT_TYPES[m].name}</option>
            ))}
          </select>
          <input
            className="configurator-walk-input"
            type="number"
            min={0}
            max={60}
            value={station.walkTime}
            onChange={e => onUpdate({ walkTime: parseInt(e.target.value, 10) || 0 })}
          />
          <span className="configurator-walk-label">min</span>
        </div>
        <div className="configurator-direction">
          <label className="configurator-direction-toggle">
            <input
              type="checkbox"
              checked={station.direction === 'all'}
              onChange={e => onUpdate({ direction: e.target.checked ? 'all' : '' })}
            />
            Alla riktningar
          </label>
          {station.direction !== 'all' && (
            <div className="configurator-direction-tags">
              {tags.map(tag => (
                <span key={tag} className="configurator-tag">
                  {tag}
                  <button
                    className="configurator-tag-remove"
                    onClick={() => onRemoveDirectionTag(tag)}
                  >×</button>
                </span>
              ))}
              <div className="configurator-direction-search-wrap">
                <input
                  className="configurator-direction-search"
                  placeholder={availableDepartures.length === 0 ? 'Inga avgångar att välja från' : 'Lägg till destination…'}
                  disabled={availableDepartures.length === 0}
                  value={directionQuery}
                  onChange={e => {
                    onDirectionQueryChange(e.target.value)
                    onDirectionDropdownOpen()
                  }}
                  onFocus={onDirectionDropdownOpen}
                  onBlur={() => setTimeout(onDirectionDropdownClose, 150)}
                />
                {directionDropdownOpen && (
                  <div className="configurator-direction-dropdown">
                    {options.length === 0 ? (
                      <div className="configurator-result-item configurator-result-status">Inga träffar</div>
                    ) : (
                      options.map(dest => (
                        <button
                          key={dest}
                          className="configurator-result-item"
                          onMouseDown={() => onAddDirectionTag(dest)}
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
      </div>
      <button className="configurator-remove" onClick={onRemove}>✕</button>
    </div>
  )
}
