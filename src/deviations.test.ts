import { describe, it, expect } from 'vitest'
import { isActive, isMajor, affectsMode, majorIncidents, stationDeviations } from './deviations'
import type { DeviationMessage, SiteDeviation, StationConfig } from './types'

const now = new Date('2026-11-03T12:00:00Z')
const metro: StationConfig = { siteId: 1, name: 'A', mode: 'METRO', walkTime: 5, direction: 'all' }
const train: StationConfig = { siteId: 1, name: 'A', mode: 'TRAIN', walkTime: 5, direction: 'all' }

const msg = (over: Partial<DeviationMessage> = {}): DeviationMessage => ({
  deviation_case_id: 1,
  message_variants: [{ header: 'h', language: 'sv' }],
  scope: { lines: [{ id: 10, transport_mode: 'METRO' }] },
  priority: { importance_level: 2 },
  ...over,
})

describe('deviations', () => {
  it('filters by publish window', () => {
    expect(isActive(msg({ publish: { from: '2026-11-03T13:00:00Z' } }), now)).toBe(false)
    expect(isActive(msg({ publish: { upto: '2026-11-03T11:00:00Z' } }), now)).toBe(false)
    expect(isActive(msg({ publish: { from: '2026-11-03T11:00:00Z', upto: '2026-11-03T13:00:00Z' } }), now)).toBe(true)
    expect(isActive(msg(), now)).toBe(true)
  })

  it('classifies major by importance level', () => {
    expect(isMajor(msg({ priority: { importance_level: 5 } }))).toBe(true)
    expect(isMajor(msg({ priority: { importance_level: 4 } }))).toBe(false)
    expect(isMajor(msg({ priority: undefined }))).toBe(false)
  })

  it('matches mode, treating unscoped messages as applicable', () => {
    expect(affectsMode(msg(), 'METRO')).toBe(true)
    expect(affectsMode(msg(), 'TRAIN')).toBe(false)
    expect(affectsMode(msg({ scope: undefined }), 'BUS')).toBe(true)
  })

  it('scopes station deviations by site and mode, excluding major', () => {
    const devs: SiteDeviation[] = [
      { originSiteId: 1, message: msg({ deviation_case_id: 1 }) },
      { originSiteId: 2, message: msg({ deviation_case_id: 2 }) },
      { originSiteId: 1, message: msg({ deviation_case_id: 3, priority: { importance_level: 7 } }) },
    ]
    expect(stationDeviations(devs, metro, now).map(m => m.deviation_case_id)).toEqual([1])
    expect(stationDeviations(devs, train, now)).toEqual([])
  })

  it('dedupes major incidents across stations', () => {
    const devs: SiteDeviation[] = [
      { originSiteId: 1, message: msg({ deviation_case_id: 3, priority: { importance_level: 7 } }) },
      { originSiteId: 2, message: msg({ deviation_case_id: 3, priority: { importance_level: 7 } }) },
    ]
    const stations = [metro, { ...metro, siteId: 2 }]
    expect(majorIncidents(devs, stations, now)).toHaveLength(1)
  })
})
