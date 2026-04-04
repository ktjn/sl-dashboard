import { useState, useRef } from 'react'
import { useStationSearch } from '../hooks/useStationSearch'
import { buildQueryString } from '../utils'
import type { StationConfig, TransportMode, AppConfig, Departure } from '../types'

interface ConfiguratorProps {
  config: AppConfig
  allDepartures: Departure[]
  onClose: () => void
}

const MODE_LABELS: Record<TransportMode, string> = {
  METRO: 'Tunnelbana',
  TRAIN: 'Pendeltåg',
  TRAM: 'Spårvagn',
  BUS: 'Buss',
}

const MODES: TransportMode[] = ['METRO', 'TRAIN', 'TRAM', 'BUS']

export default function Configurator({ config, allDepartures: _allDepartures, onClose }: ConfiguratorProps) {
  const [stations, setStations] = useState<StationConfig[]>(config.stations)
  const [query, setQuery] = useState('')
  const [showResults, setShowResults] = useState(false)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [copied, setCopied] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)

  const { results, loading: searchLoading, error: searchError } = useStationSearch(query)

  const generatedUrl = buildQueryString(stations)

  function updateStation(index: number, patch: Partial<StationConfig>) {
    setStations(prev => prev.map((s, i) => i === index ? { ...s, ...patch } : s))
  }

  function removeStation(index: number) {
    setStations(prev => prev.filter((_, i) => i !== index))
  }

  function addStation(id: number, name: string) {
    const newStation: StationConfig = {
      siteId: id,
      name,
      mode: 'METRO',
      walkTime: 10,
      direction: 'stockholm',
    }
    setStations(prev => [...prev, newStation])
    setQuery('')
    setShowResults(false)
  }

  function handleDragStart(index: number) {
    setDragIndex(index)
  }

  function handleDrop(index: number) {
    if (dragIndex === null || dragIndex === index) return
    setStations(prev => {
      const next = [...prev]
      const [moved] = next.splice(dragIndex, 1)
      next.splice(index, 0, moved)
      return next
    })
    setDragIndex(null)
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(generatedUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleApply() {
    window.location.href = generatedUrl
  }

  function directionToDisplay(direction: string): string {
    if (direction === 'stockholm') return 'stockholm'
    if (direction === 'all') return 'all'
    return 'custom'
  }

  function displayToDirection(value: string, current: string): string {
    if (value === 'stockholm') return 'stockholm'
    if (value === 'all') return 'all'
    // 'custom' — keep existing custom keywords if already custom, else empty
    if (directionToDisplay(current) === 'custom') return current
    return ''
  }

  return (
    <div className="configurator-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="configurator-panel">
        <div className="configurator-header">
          <span>Konfigurera tavla</span>
          <button className="configurator-close" onClick={onClose}>✕</button>
        </div>

        <div className="configurator-body">
          {/* Station list */}
          <div className="configurator-section">
            <div className="configurator-label">Stationer</div>
            {stations.length === 0 && (
              <p className="configurator-empty">Inga stationer. Sök nedan för att lägga till.</p>
            )}
            {stations.map((station, index) => (
              <div
                key={`${station.siteId}-${station.mode}-${index}`}
                className={`configurator-card${dragIndex === index ? ' dragging' : ''}`}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDrop(index)}
                onDragEnd={() => setDragIndex(null)}
              >
                <div className="configurator-drag-handle">⠿</div>
                <div className="configurator-card-fields">
                  <div className="configurator-card-name">{station.name}</div>
                  <div className="configurator-card-row">
                    <select
                      className="configurator-select"
                      value={station.mode}
                      onChange={e => updateStation(index, { mode: e.target.value as TransportMode })}
                    >
                      {MODES.map(m => (
                        <option key={m} value={m}>{MODE_LABELS[m]}</option>
                      ))}
                    </select>
                    <input
                      className="configurator-walk-input"
                      type="number"
                      min={0}
                      max={60}
                      value={station.walkTime}
                      onChange={e => updateStation(index, { walkTime: parseInt(e.target.value, 10) || 0 })}
                    />
                    <span className="configurator-walk-label">min</span>
                  </div>
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
                </div>
                <button className="configurator-remove" onClick={() => removeStation(index)}>✕</button>
              </div>
            ))}
          </div>

          {/* Search */}
          <div className="configurator-section" ref={searchRef}>
            <div className="configurator-label">Lägg till station</div>
            <input
              className="configurator-search"
              placeholder="Sök stationsnamn…"
              value={query}
              onChange={e => { setQuery(e.target.value); setShowResults(true) }}
              onFocus={() => setShowResults(true)}
            />
            {showResults && query.trim() && (
              <div className="configurator-results">
                {searchLoading && <div className="configurator-result-item configurator-result-status">Söker…</div>}
                {searchError && <div className="configurator-result-item configurator-result-status configurator-result-error">Kunde inte hämta resultat</div>}
                {!searchLoading && !searchError && results.length === 0 && (
                  <div className="configurator-result-item configurator-result-status">Inga träffar</div>
                )}
                {results.map(result => (
                  <button
                    key={result.id}
                    className="configurator-result-item"
                    onClick={() => addStation(result.id, result.name)}
                  >
                    <span className="configurator-result-name">{result.name}</span>
                    <span className="configurator-result-id">{result.id}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* URL preview */}
          <div className="configurator-section">
            <div className="configurator-label">Genererad URL</div>
            <div className="configurator-url-preview">{generatedUrl}</div>
            <div className="configurator-actions">
              <button className="configurator-btn" onClick={handleCopy}>
                {copied ? '✓ Kopierad' : '📋 Kopiera URL'}
              </button>
              <button className="configurator-btn configurator-btn-apply" onClick={handleApply}>
                Använd
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
