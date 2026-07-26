import type { TransportMode, TransportTypeConfig, StationConfig } from './types'

export const TRANSPORT_TYPES: Record<TransportMode, TransportTypeConfig> = {
  METRO: { name: 'Tunnelbana', icon: 'T', color: '#ffffff', bgColor: '#000000' },
  TRAM: { name: 'Tvärbanan', icon: 'L', color: '#ffffff', bgColor: '#a36b00' },
  TRAIN: { name: 'Pendeltåg', icon: 'J', color: '#ffffff', bgColor: '#cc417f' },
  BUS: { name: 'Buss', icon: 'B', color: '#ffffff', bgColor: '#2870f0' }
}

export const LINE_COLORS: Record<number, string> = {
  // Metro green line
  17: '#148541',
  18: '#148541',
  19: '#148541',
  // Metro red line
  13: '#d71d24',
  14: '#d71d24',
  // Metro blue line
  10: '#007db8',
  11: '#007db8',
  // Tvärbanan
  30: '#a36b00',
  31: '#a36b00',
  // Pendeltåg (pink)
  40: '#cc417f',
  41: '#cc417f',
  42: '#cc417f',
  43: '#cc417f',
  44: '#cc417f',
  45: '#cc417f',
  46: '#cc417f',
  48: '#cc417f',
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
