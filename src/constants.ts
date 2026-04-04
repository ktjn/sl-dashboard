import type { TransportMode, TransportTypeConfig, StationConfig } from './types'

export const TRANSPORT_TYPES: Record<TransportMode, TransportTypeConfig> = {
  METRO: { name: 'Tunnelbana', icon: 'T', color: '#ffffff', bgColor: '#000000' },
  TRAM: { name: 'Tvärbanan', icon: 'L', color: '#ffffff', bgColor: '#7D4E24' },
  TRAIN: { name: 'Pendeltåg', icon: 'J', color: '#ffffff', bgColor: '#EC619F' },
  BUS: { name: 'Buss', icon: 'B', color: '#ffffff', bgColor: '#1E88E5' }
}

export const LINE_COLORS: Record<number, string> = {
  // Metro green line
  17: '#009B3A',
  18: '#009B3A',
  19: '#009B3A',
  // Metro red line
  13: '#E8331B',
  14: '#E8331B',
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

export const MODES: TransportMode[] = ['METRO', 'TRAIN', 'TRAM', 'BUS']

export const DEPARTURE_FETCH_INTERVAL_MS = 30_000
export const CLOCK_TICK_INTERVAL_MS = 1_000

export const DEFAULT_STATIONS: StationConfig[] = [
  { siteId: 9324, name: 'Duvbo', mode: 'METRO', walkTime: 10, direction: 'stockholm' },
  { siteId: 9325, name: 'Sundbyberg', mode: 'TRAIN', walkTime: 15, direction: 'stockholm' },
  { siteId: 9325, name: 'Sundbyberg', mode: 'TRAM', walkTime: 13, direction: 'stockholm' },
]
