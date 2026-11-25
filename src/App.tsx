import { useEffect, useMemo, useState } from 'react'
import './App.css'
import Clock from './components/Clock'
import Configurator from './components/Configurator'
import DeviationNotice from './components/DeviationNotice'
import TransportSection from './components/TransportSection'
import { TRANSPORT_TYPES } from './constants'
import { majorIncidents, stationDeviations } from './deviations'
import { useClock } from './hooks/useClock'
import { useDepartures } from './hooks/useDepartures'
import { useDeviations } from './hooks/useDeviations'
import { parseConfigFromQuery } from './utils'

function formatCurrentTime(date: Date): string {
  return date.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export default function App() {
  const [config, setConfig] = useState(() => parseConfigFromQuery())
  const { stations } = config

  const { groupedDepartures, allDepartures, loading, error, lastUpdate, refetch } = useDepartures(config)
  const currentTime = useClock()
  const deviations = useDeviations(config)
  const major = useMemo(() => majorIncidents(deviations, stations, currentTime), [deviations, stations, currentTime])
  const [showConfigurator, setShowConfigurator] = useState(false)

  // Listen for URL changes (e.g. from history.pushState in Configurator)
  useEffect(() => {
    const handleUrlChange = () => {
      setConfig(parseConfigFromQuery())
    }
    window.addEventListener('popstate', handleUrlChange)
    return () => window.removeEventListener('popstate', handleUrlChange)
  }, [])

  const headerTitle = useMemo(() => {
    const uniqueNames = [...new Set(stations.map(s => s.name))]
    return uniqueNames.join(' / ')
  }, [stations])

  useEffect(() => {
    document.title = `SL Avgångar – ${headerTitle}`
  }, [headerTitle])

  const subtitle = useMemo(() => {
    const directions = [...new Set(stations.map(s => s.direction))]
    if (directions.length === 1) {
      if (directions[0] === 'all') return 'Alla avgångar'
      if (directions[0] === 'stockholm') return 'Avgångar mot Stockholm C'
      return `Avgångar mot ${directions[0].split('|').join(', ')}`
    }
    return 'Avgångstavla'
  }, [stations])

  return (
    <div className="app">
      <header className="header">
        <div className="header-content">
          <div className="sl-logo">SL</div>
          <div className="station-info">
            <h1>{headerTitle}</h1>
            <p className="subtitle">{subtitle}</p>
          </div>
          <div className="header-right">
            <Clock />
            {!showConfigurator && (
              <button
                type="button"
                className="settings-button"
                onClick={() => setShowConfigurator(true)}
                title="Konfigurera"
              >
                ⚙
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="main-content">
        <DeviationNotice messages={major} severity="major" />

        {loading && (
          <div className="loading">
            <div className="loading-spinner"></div>
            <p>Hämtar avgångar...</p>
          </div>
        )}

        {error && (
          <div className="error">
            <p>Kunde inte hämta avgångar: {error}</p>
            <button type="button" onClick={refetch}>
              Försök igen
            </button>
          </div>
        )}

        {!loading && !error && groupedDepartures.every(g => g.departures.length === 0) && (
          <div className="no-departures">
            <p>Inga avgångar just nu</p>
          </div>
        )}

        {!loading &&
          (() => {
            const keyCounts = new Map<string, number>()
            return stations.map((station, index) => {
              const baseKey = `${station.siteId}-${station.mode}-${station.direction}`
              const occurrence = keyCounts.get(baseKey) ?? 0
              keyCounts.set(baseKey, occurrence + 1)

              const stationDepartures = groupedDepartures.find(g => g.stationIndex === index)?.departures ?? []
              if (stationDepartures.length === 0) return null

              return (
                <TransportSection
                  key={`${baseKey}-${occurrence}`}
                  title={`${TRANSPORT_TYPES[station.mode].name} från ${station.name}`}
                  departures={stationDepartures}
                  currentTime={currentTime}
                  walkingTime={station.walkTime}
                  deviations={stationDeviations(deviations, station, currentTime)}
                />
              )
            })
          })()}
      </main>

      <footer className="footer">
        {lastUpdate && <span>Uppdaterad: {formatCurrentTime(lastUpdate)}</span>}
        <span className="live-indicator">
          <span className="live-dot"></span>
          Realtid från SL
        </span>
      </footer>

      {showConfigurator && (
        <Configurator config={config} allDepartures={allDepartures} onClose={() => setShowConfigurator(false)} />
      )}
    </div>
  )
}
