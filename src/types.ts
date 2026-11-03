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
  direction: string  // 'stockholm' | 'all' | 'keyword1|keyword2'
}

export interface AppConfig {
  stations: StationConfig[]
}

export interface DeviationScopeLine {
  id: number
  designation?: string
  transport_mode: TransportMode
}

export interface DeviationScopeStopArea {
  id: number
  name?: string
  transport_mode?: TransportMode
}

export interface DeviationVariant {
  header: string
  details?: string
  weblink?: string
  language?: string
}

export interface DeviationMessage {
  deviation_case_id: number
  publish?: { from?: string; upto?: string }
  priority?: { importance_level?: number; influence_level?: number; urgency_level?: number }
  message_variants: DeviationVariant[]
  scope?: { lines?: DeviationScopeLine[]; stop_areas?: DeviationScopeStopArea[] }
}

export interface SiteDeviation {
  message: DeviationMessage
  originSiteId: number
}
