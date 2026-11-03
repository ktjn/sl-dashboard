import { MAJOR_IMPORTANCE_LEVEL } from './constants'
import type { DeviationMessage, DeviationVariant, SiteDeviation, StationConfig } from './types'

export function isActive(message: DeviationMessage, now: Date): boolean {
  const from = message.publish?.from ? new Date(message.publish.from) : null
  const upto = message.publish?.upto ? new Date(message.publish.upto) : null
  if (from && !isNaN(from.getTime()) && from > now) return false
  if (upto && !isNaN(upto.getTime()) && upto < now) return false
  return true
}

export function isMajor(message: DeviationMessage): boolean {
  return (message.priority?.importance_level ?? 0) >= MAJOR_IMPORTANCE_LEVEL
}

export function affectsMode(message: DeviationMessage, mode: StationConfig['mode']): boolean {
  const lines = message.scope?.lines ?? []
  const areas = message.scope?.stop_areas ?? []
  const modes = [...lines.map(l => l.transport_mode), ...areas.map(a => a.transport_mode)].filter(Boolean)
  return modes.length === 0 || modes.includes(mode)
}

export function pickVariant(message: DeviationMessage): DeviationVariant | undefined {
  const variants = message.message_variants ?? []
  return variants.find(v => v.language === 'sv') ?? variants[0]
}

function dedupe(messages: DeviationMessage[]): DeviationMessage[] {
  const seen = new Set<number>()
  return messages.filter(m => {
    if (seen.has(m.deviation_case_id)) return false
    seen.add(m.deviation_case_id)
    return true
  })
}

export function deviationsForStation(
  deviations: SiteDeviation[],
  station: StationConfig,
  now: Date
): DeviationMessage[] {
  return dedupe(
    deviations
      .filter(d => d.originSiteId === station.siteId && affectsMode(d.message, station.mode) && isActive(d.message, now))
      .map(d => d.message)
  )
}

export function stationDeviations(deviations: SiteDeviation[], station: StationConfig, now: Date) {
  return deviationsForStation(deviations, station, now).filter(m => !isMajor(m))
}

export function majorIncidents(deviations: SiteDeviation[], stations: StationConfig[], now: Date) {
  return dedupe(stations.flatMap(s => deviationsForStation(deviations, s, now).filter(isMajor)))
}
