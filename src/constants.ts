import type { TransportMode, TransportTypeConfig, StationConfig } from './types'

export const DUVBO_SITE_ID = 9324 // Duvbo (metro)
export const SUNDBYBERG_SITE_ID = 9325 // Sundbyberg (train, tram)

export const TRANSPORT_TYPES: Record<TransportMode, TransportTypeConfig> = {
  METRO: { name: 'Tunnelbana', icon: 'T', color: '#ffffff', bgColor: '#000000' },
  TRAM: { name: 'Spårvagn', icon: 'L', color: '#ffffff', bgColor: '#7D4E24' },
  TRAIN: { name: 'Pendeltåg', icon: 'J', color: '#ffffff', bgColor: '#EC619F' },
  BUS: { name: 'Buss', icon: 'B', color: '#ffffff', bgColor: '#1E88E5' }
}

export const LINE_COLORS: Record<number, string> = {
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

export const WALKING_TIMES: Record<TransportMode, number> = {
  METRO: 10,
  TRAM: 13,
  TRAIN: 15,
  BUS: 10,
}

export const STOCKHOLM_DIRECTIONS = [
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

export const DEPARTURE_FETCH_INTERVAL_MS = 30_000
export const CLOCK_TICK_INTERVAL_MS = 1_000

export const DEFAULT_STATIONS: StationConfig[] = [
  { siteId: 9324, name: 'Duvbo', mode: 'METRO', walkTime: 10 },
  { siteId: 9325, name: 'Sundbyberg', mode: 'TRAIN', walkTime: 15 },
  { siteId: 9325, name: 'Sundbyberg', mode: 'TRAM', walkTime: 13 },
]
