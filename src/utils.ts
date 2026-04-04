import { LINE_COLORS, STOCKHOLM_DIRECTIONS, DEFAULT_STATIONS } from './constants'
import type { Departure, TransportMode, AppConfig, StationConfig } from './types'

export function isTowardsStockholm(departure: Departure): boolean {
  const dest = departure.destination.toLowerCase()
  const dir = departure.direction?.toLowerCase() || ''
  return STOCKHOLM_DIRECTIONS.some(d => dest.includes(d) || dir.includes(d))
}

// direction: 'stockholm' | 'all' | 'keyword1|keyword2'
export function matchesDirection(departure: Departure, direction: string): boolean {
  if (direction === 'all') return true
  if (direction === 'stockholm') return isTowardsStockholm(departure)
  const keywords = direction.split('|').filter(Boolean)
  const dest = departure.destination.toLowerCase()
  const dir = departure.direction?.toLowerCase() || ''
  return keywords.some(keyword => {
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
// New format: ?stations=siteId:name:mode:walkTime:direction,...
// Legacy fallback: ?direction=stockholm applies as default direction for stations without a 5th field
export function parseConfigFromQuery(): AppConfig {
  const params = new URLSearchParams(window.location.search)
  const stationsParam = params.get('stations')
  const legacyDirection = params.get('direction')?.toLowerCase() ?? 'stockholm'

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
        const direction = parts[4] ?? legacyDirection
        if (!isNaN(siteId) && name && ['METRO', 'TRAM', 'TRAIN', 'BUS'].includes(mode) && !isNaN(walkTime)) {
          parsed.push({ siteId, name, mode, walkTime, direction })
        }
      }
    }
    if (parsed.length > 0) stations = parsed
  }

  return { stations }
}

// Build a full URL from a station list.
// Format: origin + pathname + ?stations=siteId:name:mode:walkTime:direction,...
export function buildQueryString(stations: StationConfig[]): string {
  const parts = stations.map(s =>
    [s.siteId, encodeURIComponent(s.name), s.mode, s.walkTime, s.direction].join(':')
  )
  return `${window.location.origin}${window.location.pathname}?stations=${parts.join(',')}`
}
