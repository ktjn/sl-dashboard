import { LINE_COLORS, STOCKHOLM_DIRECTIONS, DEFAULT_STATIONS } from './constants'
import type { Departure, TransportMode, AppConfig, StationConfig } from './types'

export function isTowardsStockholm(departure: Departure): boolean {
  const dest = departure.destination.toLowerCase()
  const dir = departure.direction?.toLowerCase() || ''
  return STOCKHOLM_DIRECTIONS.some(d => dest.includes(d) || dir.includes(d))
}

export function matchesDirection(departure: Departure, filter: AppConfig['directionFilter']): boolean {
  if (filter === 'all') return true
  if (filter === 'stockholm') return isTowardsStockholm(departure)
  const dest = departure.destination.toLowerCase()
  const dir = departure.direction?.toLowerCase() || ''
  return filter.some(keyword => {
    if (keyword.startsWith('=')) {
      const exact = keyword.slice(1)
      return dest === exact || dir === exact
    }
    return dest.includes(keyword) || dir.includes(keyword)
  })
}

export function formatTime(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })
}

export function getLineColor(lineId: number, transportMode: TransportMode): string {
  if (LINE_COLORS[lineId]) return LINE_COLORS[lineId]

  switch (transportMode) {
    case 'METRO': return '#0066B3'
    case 'TRAM': return '#7D4E24'
    case 'TRAIN': return '#EC619F'
    case 'BUS': return '#1E88E5'
    default: return '#666666'
  }
}

// Parse query parameters to get station configuration.
// Format: ?stations=siteId:name:mode:walkTime,...
// Direction filter: ?direction=stockholm (default), ?direction=all, or ?direction=farsta,sickla
// Use = prefix for exact match: ?direction==farsta matches only "Farsta", not "Farsta strand"
export function parseConfigFromQuery(): AppConfig {
  const params = new URLSearchParams(window.location.search)
  const stationsParam = params.get('stations')
  const directionParam = params.get('direction')

  let stations: StationConfig[] = DEFAULT_STATIONS
  if (stationsParam) {
    const parsed: StationConfig[] = []
    for (const entry of stationsParam.split(',')) {
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
    if (parsed.length > 0) stations = parsed
  }

  let directionFilter: AppConfig['directionFilter'] = 'stockholm'
  if (directionParam) {
    if (directionParam.toLowerCase() === 'all') {
      directionFilter = 'all'
    } else if (directionParam.toLowerCase() !== 'stockholm') {
      directionFilter = directionParam.toLowerCase().split(',').map(s => s.trim())
    }
  }

  return { stations, directionFilter }
}
