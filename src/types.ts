export type TransportMode = 'METRO' | 'TRAM' | 'TRAIN' | 'BUS'

export interface TransportTypeConfig {
  name: string
  icon: string
  color: string
  bgColor: string
}

export interface Line {
  id: number
  designation: string
  transport_mode: TransportMode
}

export interface StopArea {
  name: string
}

export interface StopPoint {
  designation: string
}

export interface Journey {
  id: string
}

export interface Departure {
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

export interface DeparturesResponse {
  departures: Departure[]
}

export interface StationConfig {
  siteId: number
  name: string
  mode: TransportMode
  walkTime: number
}

export interface AppConfig {
  stations: StationConfig[]
  directionFilter: 'stockholm' | 'all' | string[]
}
