import { useState, useRef, useCallback, useMemo, useEffect } from 'react'
import { useStationSearch } from '../hooks/useStationSearch'
import { buildQueryString } from '../utils'
import { MODES } from '../constants'
import type { StationConfig, AppConfig } from '../types'
import type { SiteDeparture } from '../hooks/useDepartures'
import StationCard from './StationCard'

interface ConfiguratorProps {
  config: AppConfig
  allDepartures: SiteDeparture[]
  onClose: () => void
}

export default function Configurator({ config, allDepartures, onClose }: ConfiguratorProps) {
  const [stations, setStations] = useState<StationConfig[]>(config.stations)
  const [query, setQuery] = useState('')
  const [showResults, setShowResults] = useState(false)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [copied, setCopied] = useState(false)
  const [directionQueries, setDirectionQueries] = useState<string[]>(() =>
    config.stations.map(() => '')
  )
  const [directionDropdownOpen, setDirectionDropdownOpen] = useState<number | null>(null)
  const [extraDepartures, setExtraDepartures] = useState<SiteDeparture[]>([])
  const fetchedSiteIds = useRef(new Set(allDepartures.map(d => d.originSiteId)))
  const searchRef = useRef<HTMLDivElement>(null)

  // Always merge fresh prop data with any extra departures fetched for new stations
  const availableDepartures = useMemo(
    () => [...allDepartures, ...extraDepartures],
    [allDepartures, extraDepartures]
  )

  const fetchDeparturesForSite = useCallback(async (siteId: number) => {
    if (fetchedSiteIds.current.has(siteId)) return
    fetchedSiteIds.current.add(siteId)
    try {
      const r = await fetch(`https://transport.integration.sl.se/v1/sites/${siteId}/departures`)
      if (!r.ok) return
      const data = await r.json()
      const newDeps: SiteDeparture[] = (data.departures ?? []).map(
        (d: SiteDeparture['departure']) => ({ departure: d, originSiteId: siteId })
      )
      setExtraDepartures(prev => [...prev, ...newDeps])
    } catch {
      // no destinations available for this site
    }
  }, [])

  // When departure data loads for a site, auto-correct any station whose mode is not available there
  useEffect(() => {
    setStations(prev => prev.map(station => {
      const siteHasData = availableDepartures.some(d => d.originSiteId === station.siteId)
      if (!siteHasData) return station
      const validModes = MODES.filter(m =>
        availableDepartures.some(d =>
          d.originSiteId === station.siteId && d.departure.line.transport_mode === m
        )
      )
      if (validModes.length > 0 && !validModes.includes(station.mode)) {
        return { ...station, mode: validModes[0], direction: 'all' }
      }
      return station
    }))
  }, [availableDepartures])

  const { results, loading: searchLoading, error: searchError } = useStationSearch(query)

  const generatedUrl = buildQueryString(stations)

  function updateStation(index: number, patch: Partial<StationConfig>) {
    setStations(prev => prev.map((s, i) => i === index ? { ...s, ...patch } : s))
  }

  function removeStation(index: number) {
    setStations(prev => prev.filter((_, i) => i !== index))
    setDirectionQueries(prev => prev.filter((_, i) => i !== index))
  }

  function addStation(id: number, name: string) {
    const newStation: StationConfig = {
      siteId: id,
      name,
      mode: 'METRO',
      walkTime: 10,
      direction: 'all',
    }
    setStations(prev => [...prev, newStation])
    setDirectionQueries(prev => [...prev, ''])
    setQuery('')
    setShowResults(false)
    fetchDeparturesForSite(id)
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
    setDirectionQueries(prev => {
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

  function addDirectionTag(index: number, tag: string) {
    const direction = stations[index].direction
    const current = direction === 'all' ? [] : direction.split('|').filter(Boolean)
    if (current.includes(tag)) return
    const next = [...current, tag]
    updateStation(index, { direction: next.join('|') })
    setDirectionQueries(prev => prev.map((q, i) => (i === index ? '' : q)))
    setDirectionDropdownOpen(null)
  }

  function removeDirectionTag(index: number, tag: string) {
    const direction = stations[index].direction
    const current = direction === 'all' ? [] : direction.split('|').filter(Boolean)
    const next = current.filter(t => t !== tag)
    updateStation(index, { direction: next.length === 0 ? 'all' : next.join('|') })
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
            <div className="configurator-section-header">
              <div className="configurator-label">Stationer</div>
              {stations.length > 0 && (
                <button
                  type="button"
                  className="configurator-clear-all"
                  onClick={() => { setStations([]); setDirectionQueries([]) }}
                >
                  Rensa alla
                </button>
              )}
            </div>
            {stations.length === 0 && (
              <p className="configurator-empty">Inga stationer. Sök nedan för att lägga till.</p>
            )}
            {stations.map((station, index) => (
              <StationCard
                key={`${station.siteId}-${station.mode}-${index}`}
                station={station}
                index={index}
                isDragging={dragIndex === index}
                directionQuery={directionQueries[index] ?? ''}
                directionDropdownOpen={directionDropdownOpen === index}
                availableDepartures={availableDepartures}
                onUpdate={(patch) => updateStation(index, patch)}
                onRemove={() => removeStation(index)}
                onDragStart={() => handleDragStart(index)}
                onDrop={() => handleDrop(index)}
                onDragEnd={() => setDragIndex(null)}
                onDirectionQueryChange={(value) =>
                  setDirectionQueries(prev => prev.map((q, i) => (i === index ? value : q)))
                }
                onDirectionDropdownOpen={() => setDirectionDropdownOpen(index)}
                onDirectionDropdownClose={() => setDirectionDropdownOpen(null)}
                onAddDirectionTag={(tag) => addDirectionTag(index, tag)}
                onRemoveDirectionTag={(tag) => removeDirectionTag(index, tag)}
              />
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
