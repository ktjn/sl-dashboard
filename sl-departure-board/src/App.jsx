import { useState, useEffect, useCallback } from 'react'
import './App.css'

const DUVBO_SITE_ID = 9324 // Duvbo (metro)
const SUNDBYBERG_SITE_ID = 9325 // Sundbyberg (train, tram)

// Transport type configurations
const TRANSPORT_TYPES = {
  METRO: { name: 'Tunnelbana', icon: 'T', color: '#ffffff', bgColor: '#000000' },
  TRAM: { name: 'Spårvagn', icon: 'L', color: '#ffffff', bgColor: '#7D4E24' },
  TRAIN: { name: 'Pendeltåg', icon: 'J', color: '#ffffff', bgColor: '#EC619F' },
  BUS: { name: 'Buss', icon: 'B', color: '#ffffff', bgColor: '#1E88E5' }
}

// Line colors based on SL design
const LINE_COLORS = {
  // Metro blue line
  10: '#0066B3',
  11: '#0066B3',
  // Tvärbanan
  30: '#7D4E24',
  31: '#7D4E24',
  // Pendeltåg (pink)
  40: '#EC619F',
  41: '#EC619F',
  42: '#EC619F',
  43: '#EC619F',
  44: '#EC619F',
  45: '#EC619F',
  46: '#EC619F',
  48: '#EC619F',
}

// Directions towards Stockholm C
const STOCKHOLM_DIRECTIONS = [
  'kungsträdgården',
  'stockholm',
  't-centralen',
  'slussen',
  'gullmarsplan',
  'farsta',
  'hagsätra',
  'skarpnäck',
  'bagarmossen',
  'nynäshamn',
  'västerhaninge',
  'jordbro',
  'haninge',
  'tumba',
  'södertälje',
  'gnesta',
  'sickla',
  'hammarby',
]

function isTowardsStockholm(departure) {
  const dest = departure.destination.toLowerCase()
  const dir = departure.direction?.toLowerCase() || ''
  return STOCKHOLM_DIRECTIONS.some(d => dest.includes(d) || dir.includes(d))
}

function formatTime(dateString) {
  const date = new Date(dateString)
  return date.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })
}

function getLineColor(lineId, transportMode) {
  if (LINE_COLORS[lineId]) return LINE_COLORS[lineId]

  switch (transportMode) {
    case 'METRO': return '#0066B3'
    case 'TRAM': return '#7D4E24'
    case 'TRAIN': return '#EC619F'
    case 'BUS': return '#1E88E5'
    default: return '#666666'
  }
}

function DepartureRow({ departure }) {
  const displayTime = departure.display
  const isSoon = displayTime === 'Nu' || (displayTime.includes('min') && parseInt(displayTime) <= 2)
  const lineColor = getLineColor(departure.line.id, departure.line.transport_mode)

  return (
    <div className={`departure-row ${isSoon ? 'departing-soon' : ''}`}>
      <div className="line-info">
        <div className="line-badge" style={{ backgroundColor: lineColor }}>
          <span className="line-number">{departure.line.designation}</span>
        </div>
      </div>
      <div className="destination-info">
        <span className="destination">{departure.destination}</span>
        {departure.stop_area && (
          <span className="via">{departure.stop_area.name}</span>
        )}
      </div>
      {departure.stop_point?.designation && departure.line.transport_mode === 'TRAIN' && (
        <div className="track">
          <span className="track-label">Spår</span>
          <span className="track-number">{departure.stop_point.designation}</span>
        </div>
      )}
      <div className="time-info">
        <span className={`minutes ${isSoon ? 'blink' : ''}`}>
          {displayTime}
        </span>
        <span className="actual-time">{formatTime(departure.expected || departure.scheduled)}</span>
      </div>
    </div>
  )
}

function TransportSection({ title, departures, transportMode }) {
  const typeConfig = TRANSPORT_TYPES[transportMode]
  if (!typeConfig) return null

  const filteredDepartures = departures
    .filter(d => d.line.transport_mode === transportMode)
    .slice(0, 6)

  if (filteredDepartures.length === 0) return null

  return (
    <div className="transport-section">
      <div className="section-header">
        <div className="transport-icon" style={{ backgroundColor: typeConfig.bgColor, color: typeConfig.color }}>
          {typeConfig.icon}
        </div>
        <span className="section-title">{title}</span>
      </div>
      <div className="departures-list">
        {filteredDepartures.map((dep, idx) => (
          <DepartureRow key={`${dep.journey?.id || idx}-${dep.scheduled}`} departure={dep} />
        ))}
      </div>
    </div>
  )
}

function App() {
  const [departures, setDepartures] = useState([])
  const [currentTime, setCurrentTime] = useState(new Date())
  const [lastUpdate, setLastUpdate] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchDepartures = useCallback(async () => {
    try {
      // Fetch from both stations in parallel
      const [duvboResponse, sundbybergResponse] = await Promise.all([
        fetch(`https://transport.integration.sl.se/v1/sites/${DUVBO_SITE_ID}/departures`),
        fetch(`https://transport.integration.sl.se/v1/sites/${SUNDBYBERG_SITE_ID}/departures`)
      ])

      if (!duvboResponse.ok || !sundbybergResponse.ok) {
        throw new Error(`API error: ${duvboResponse.status} / ${sundbybergResponse.status}`)
      }

      const [duvboData, sundbybergData] = await Promise.all([
        duvboResponse.json(),
        sundbybergResponse.json()
      ])

      // Get metro from Duvbo, train and tram from Sundbyberg
      const metroDepartures = duvboData.departures
        .filter(d => d.line.transport_mode === 'METRO')
        .filter(isTowardsStockholm)

      const otherDepartures = sundbybergData.departures
        .filter(d => d.line.transport_mode === 'TRAIN' || d.line.transport_mode === 'TRAM')
        .filter(isTowardsStockholm)

      // Combine and sort by departure time
      const allDepartures = [...metroDepartures, ...otherDepartures]

      setDepartures(allDepartures)
      setLastUpdate(new Date())
      setError(null)
    } catch (err) {
      console.error('Failed to fetch departures:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // Initial load
    fetchDepartures()

    // Update departures every 30 seconds
    const departureInterval = setInterval(fetchDepartures, 30000)

    // Update clock every second
    const clockInterval = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    return () => {
      clearInterval(departureInterval)
      clearInterval(clockInterval)
    }
  }, [fetchDepartures])

  const formatCurrentTime = (date) => {
    return date.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  return (
    <div className="app">
      <header className="header">
        <div className="header-content">
          <div className="sl-logo">SL</div>
          <div className="station-info">
            <h1>Duvbo / Sundbyberg</h1>
            <p className="subtitle">Avgångar mot Stockholm C</p>
          </div>
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
            <button onClick={fetchDepartures}>Försök igen</button>
          </div>
        )}

        {!loading && !error && departures.length === 0 && (
          <div className="no-departures">
            <p>Inga avgångar mot Stockholm C just nu</p>
          </div>
        )}

        {!loading && departures.length > 0 && (
          <>
            <TransportSection
              title="Tunnelbana från Duvbo"
              departures={departures}
              transportMode="METRO"
            />
            <TransportSection
              title="Pendeltåg från Sundbyberg"
              departures={departures}
              transportMode="TRAIN"
            />
            <TransportSection
              title="Tvärbanan från Sundbyberg"
              departures={departures}
              transportMode="TRAM"
            />
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
    </div>
  )
}

export default App
