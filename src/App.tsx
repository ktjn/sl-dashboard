import { useState, useEffect, useCallback, useMemo } from 'react'
import './App.css'

type TransportMode = 'METRO' | 'TRAM' | 'TRAIN' | 'BUS'

interface TransportTypeConfig {
  name: string
  icon: string
  color: string
  bgColor: string
}

const TRANSPORT_TYPES: Record<TransportMode, TransportTypeConfig> = {
  METRO: { name: 'Tunnelbana', icon: 'T', color: '#ffffff', bgColor: '#000000' },
  TRAM: { name: 'Spårvagn', icon: 'L', color: '#ffffff', bgColor: '#7D4E24' },
  TRAIN: { name: 'Pendeltåg', icon: 'J', color: '#ffffff', bgColor: '#EC619F' },
  BUS: { name: 'Buss', icon: 'B', color: '#ffffff', bgColor: '#1E88E5' }
}

const LINE_COLORS: Record<number, string> = {
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

// Station configuration
interface StationConfig {
  siteId: number
  name: string
  mode: TransportMode
  walkTime: number
}

// Default configuration (current settings)
const DEFAULT_STATIONS: StationConfig[] = [
  { siteId: 9324, name: 'Duvbo', mode: 'METRO', walkTime: 10 },
  { siteId: 9325, name: 'Sundbyberg', mode: 'TRAIN', walkTime: 15 },
  { siteId: 9325, name: 'Sundbyberg', mode: 'TRAM', walkTime: 13 },
]

// Configuration parsed from query params
interface AppConfig {
  stations: StationConfig[]
  directionFilter: 'stockholm' | 'all' | string[]
}

// Parse query parameters to get station configuration
// Format: ?stations=siteId:name:mode:walkTime,siteId:name:mode:walkTime,...
// Example: ?stations=9324:Duvbo:METRO:10,9325:Sundbyberg:TRAIN:15,9325:Sundbyberg:TRAM:13
// Direction filter: ?direction=stockholm (default), ?direction=all, or ?direction=farsta,sickla
function parseConfigFromQuery(): AppConfig {
  const params = new URLSearchParams(window.location.search)
  const stationsParam = params.get('stations')
  const directionParam = params.get('direction')

  // Parse stations
  let stations: StationConfig[] = DEFAULT_STATIONS
  if (stationsParam) {
    const parsed: StationConfig[] = []
    const entries = stationsParam.split(',')

    for (const entry of entries) {
      const parts = entry.split(':')
      if (parts.length >= 4) {
        const siteId = parseInt(parts[0], 10)
        const name = decodeURIComponent(parts[1])
        const mode = parts[2].toUpperCase() as TransportMode
        const walkTime = parseInt(parts[3], 10)

        if (!isNaN(siteId) && name && ['METRO', 'TRAM', 'TRAIN', 'BUS'].includes(mode) && !isNaN(walkTime)) {
          parsed.push({ siteId, name, mode, walkTime })
        }
      }
    }
    if (parsed.length > 0) {
      stations = parsed
    }
  }

  // Parse direction filter
  let directionFilter: 'stockholm' | 'all' | string[] = 'stockholm'
  if (directionParam) {
    if (directionParam.toLowerCase() === 'all') {
      directionFilter = 'all'
    } else if (directionParam.toLowerCase() !== 'stockholm') {
      // Custom direction keywords
      directionFilter = directionParam.toLowerCase().split(',').map(s => s.trim())
    }
  }

  return { stations, directionFilter }
}

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

interface Line {
  id: number
  designation: string
  transport_mode: TransportMode
}

interface StopArea {
  name: string
}

interface StopPoint {
  designation: string
}

interface Journey {
  id: string
}

interface Departure {
  destination: string
  direction?: string
  display: string
  scheduled: string
  expected?: string
  line: Line
  stop_area?: StopArea
  stop_point?: StopPoint
  journey?: Journey
}

interface DeparturesResponse {
  departures: Departure[]
}

function isTowardsStockholm(departure: Departure): boolean {
  const dest = departure.destination.toLowerCase()
  const dir = departure.direction?.toLowerCase() || ''
  return STOCKHOLM_DIRECTIONS.some(d => dest.includes(d) || dir.includes(d))
}

function matchesDirection(departure: Departure, filter: 'stockholm' | 'all' | string[]): boolean {
  if (filter === 'all') return true
  if (filter === 'stockholm') return isTowardsStockholm(departure)
  // Custom direction keywords
  const dest = departure.destination.toLowerCase()
  const dir = departure.direction?.toLowerCase() || ''
  return filter.some(keyword => dest.includes(keyword) || dir.includes(keyword))
}

function formatTime(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })
}

function getLineColor(lineId: number, transportMode: TransportMode): string {
  if (LINE_COLORS[lineId]) return LINE_COLORS[lineId]

  switch (transportMode) {
    case 'METRO': return '#0066B3'
    case 'TRAM': return '#7D4E24'
    case 'TRAIN': return '#EC619F'
    case 'BUS': return '#1E88E5'
    default: return '#666666'
  }
}

interface DepartureRowProps {
  departure: Departure
  currentTime: Date
  walkingTime: number
}

function DepartureRow({ departure, currentTime, walkingTime }: DepartureRowProps) {
  const displayTime = departure.display
  const transportMode = departure.line.transport_mode
  const lineColor = getLineColor(departure.line.id, transportMode)

  const departureTime = new Date(departure.expected || departure.scheduled)
  const leaveTime = new Date(departureTime.getTime() - walkingTime * 60000)
  const minutesUntilLeave = Math.round((leaveTime.getTime() - currentTime.getTime()) / 60000)

  const isSoon = displayTime === 'Nu' || (displayTime.includes('min') && parseInt(displayTime) <= 2)
  const tooLate = minutesUntilLeave < -1
  const shouldLeaveNow = minutesUntilLeave >= -1 && minutesUntilLeave <= 0
  const shouldLeaveSoon = minutesUntilLeave <= 2 && minutesUntilLeave > 0

  const leaveDisplay = tooLate ? 'För sent' : minutesUntilLeave <= 0 ? 'Nu!' : `${minutesUntilLeave} min`

  return (
    <div className={`departure-row ${tooLate ? 'too-late' : shouldLeaveNow ? 'leave-now' : shouldLeaveSoon ? 'leave-soon' : ''}`}>
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
      <div className="leave-time">
        <span className="leave-label">Gå</span>
        <span className={`leave-value ${tooLate ? 'too-late' : shouldLeaveNow ? 'blink urgent' : shouldLeaveSoon ? 'soon' : ''}`}>
          {leaveDisplay}
        </span>
      </div>
      {departure.stop_point?.designation && transportMode === 'TRAIN' && (
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

interface TransportSectionProps {
  title: string
  departures: Departure[]
  transportMode: TransportMode
  currentTime: Date
  walkingTime: number
}

function TransportSection({ title, departures, transportMode, currentTime, walkingTime }: TransportSectionProps) {
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
        <span className="walking-time">{walkingTime} min gångväg</span>
      </div>
      <div className="departures-list">
        {filteredDepartures.map((dep, idx) => (
          <DepartureRow key={`${dep.journey?.id || idx}-${dep.scheduled}`} departure={dep} currentTime={currentTime} walkingTime={walkingTime} />
        ))}
      </div>
    </div>
  )
}

function App() {
  const [departures, setDepartures] = useState<Departure[]>([])
  const [currentTime, setCurrentTime] = useState(new Date())
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Parse configuration from query params (memoized)
  const config = useMemo(() => parseConfigFromQuery(), [])
  const { stations: stationConfig, directionFilter } = config

  // Get unique site IDs and configured modes
  const { uniqueSiteIds, configuredModes } = useMemo(() => {
    const siteIds = [...new Set(stationConfig.map(s => s.siteId))]
    const modes = new Set(stationConfig.map(s => s.mode))
    return { uniqueSiteIds: siteIds, configuredModes: modes }
  }, [stationConfig])

  // Generate header title from unique station names
  const headerTitle = useMemo(() => {
    const uniqueNames = [...new Set(stationConfig.map(s => s.name))]
    return uniqueNames.join(' / ')
  }, [stationConfig])

  // Generate subtitle based on direction filter
  const subtitle = useMemo(() => {
    if (directionFilter === 'all') return 'Alla avgångar'
    if (directionFilter === 'stockholm') return 'Avgångar mot Stockholm C'
    return `Avgångar mot ${directionFilter.join(', ')}`
  }, [directionFilter])

  const fetchDepartures = useCallback(async () => {
    try {
      // Fetch departures from all configured sites
      const responses = await Promise.all(
        uniqueSiteIds.map(siteId =>
          fetch(`https://transport.integration.sl.se/v1/sites/${siteId}/departures`)
        )
      )

      // Check for errors
      const failedResponse = responses.find(r => !r.ok)
      if (failedResponse) {
        throw new Error(`API error: ${failedResponse.status}`)
      }

      // Parse all responses
      const dataPromises = responses.map(r => r.json() as Promise<DeparturesResponse>)
      const allData = await Promise.all(dataPromises)

      // Combine and filter departures
      const allDepartures = allData
        .flatMap(data => data.departures)
        .filter(d => configuredModes.has(d.line.transport_mode))
        .filter(d => matchesDirection(d, directionFilter))

      setDepartures(allDepartures)
      setLastUpdate(new Date())
      setError(null)
    } catch (err) {
      console.error('Failed to fetch departures:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [uniqueSiteIds, configuredModes, directionFilter])

  useEffect(() => {
    fetchDepartures()

    const departureInterval = setInterval(fetchDepartures, 30000)

    const clockInterval = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    return () => {
      clearInterval(departureInterval)
      clearInterval(clockInterval)
    }
  }, [fetchDepartures])

  const formatCurrentTime = (date: Date): string => {
    return date.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  // Build section titles dynamically based on config
  const getSectionTitle = (mode: TransportMode, stationName: string): string => {
    const modeNames: Record<TransportMode, string> = {
      METRO: 'Tunnelbana',
      TRAIN: 'Pendeltåg',
      TRAM: 'Tvärbanan',
      BUS: 'Buss',
    }
    return `${modeNames[mode]} från ${stationName}`
  }

  return (
    <div className="app">
      <header className="header">
        <div className="header-content">
          <div className="sl-logo">SL</div>
          <div className="station-info">
            <h1>{headerTitle}</h1>
            <p className="subtitle">{subtitle}</p>
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
            <p>Inga avgångar just nu</p>
          </div>
        )}

        {!loading && departures.length > 0 && (
          <>
            {stationConfig.map((station, index) => (
              <TransportSection
                key={`${station.siteId}-${station.mode}-${index}`}
                title={getSectionTitle(station.mode, station.name)}
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
    </div>
  )
}

export default App
