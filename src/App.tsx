import { useState, useMemo } from 'react'
import './App.css'
import { useDepartures } from './hooks/useDepartures'
import { useClock } from './hooks/useClock'
import { parseConfigFromQuery } from './utils'
import TransportSection from './components/TransportSection'
import Configurator from './components/Configurator'
import { TRANSPORT_TYPES } from './constants'

function formatCurrentTime(date: Date): string {
  return date.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export default function App() {
  const config = useMemo(() => parseConfigFromQuery(), [])
  const { stations } = config

  const { departures, allDepartures, loading, error, lastUpdate, refetch } = useDepartures(config)
  const currentTime = useClock()
  const [showConfigurator, setShowConfigurator] = useState(false)

  const headerTitle = useMemo(() => {
    const uniqueNames = [...new Set(stations.map(s => s.name))]
    return uniqueNames.join(' / ')
  }, [stations])

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
            <div className="clock">
              <div className="time">{formatCurrentTime(currentTime)}</div>
              <div className="date">
                {currentTime.toLocaleDateString('sv-SE', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long'
                })}
              </div>
            </div>
            {!showConfigurator && (
              <button
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
        {loading && (
          <div className="loading">
            <div className="loading-spinner"></div>
            <p>Hämtar avgångar...</p>
          </div>
        )}

        {error && (
          <div className="error">
            <p>Kunde inte hämta avgångar: {error}</p>
            <button onClick={refetch}>Försök igen</button>
          </div>
        )}

        {!loading && !error && departures.length === 0 && (
          <div className="no-departures">
            <p>Inga avgångar just nu</p>
          </div>
        )}

        {!loading && departures.length > 0 && (
          <>
            {stations.map((station, index) => (
              <TransportSection
                key={`${station.siteId}-${station.mode}-${index}`}
                title={`${TRANSPORT_TYPES[station.mode].name} från ${station.name}`}
                departures={departures}
                transportMode={station.mode}
                currentTime={currentTime}
                walkingTime={station.walkTime}
              />
            ))}
          </>
        )}
      </main>

      <footer className="footer">
        {lastUpdate && (
          <span>Uppdaterad: {formatCurrentTime(lastUpdate)}</span>
        )}
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
