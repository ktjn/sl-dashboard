import { describe, it, expect } from 'vitest'
import { parseConfigFromQuery, buildQueryString } from './utils'
import { DEFAULT_STATIONS } from './constants'

function setLocation(search: string) {
  Object.defineProperty(window, 'location', {
    value: { search, origin: 'http://localhost', pathname: '/' },
    writable: true,
    configurable: true,
  })
}

// ─── Suite 1: parseConfigFromQuery — valid inputs ────────────────────────────

describe('parseConfigFromQuery — valid inputs', () => {
  it('parses a single station with all 5 fields', () => {
    setLocation('?stations=9324:Duvbo:METRO:10:stockholm')
    const { stations } = parseConfigFromQuery()
    expect(stations).toEqual([
      { siteId: 9324, name: 'Duvbo', mode: 'METRO', walkTime: 10, direction: 'stockholm' },
    ])
  })

  it('parses multiple stations', () => {
    setLocation('?stations=9324:Duvbo:METRO:10:stockholm,9325:Sundbyberg:TRAIN:15:all')
    const { stations } = parseConfigFromQuery()
    expect(stations).toEqual([
      { siteId: 9324, name: 'Duvbo', mode: 'METRO', walkTime: 10, direction: 'stockholm' },
      { siteId: 9325, name: 'Sundbyberg', mode: 'TRAIN', walkTime: 15, direction: 'all' },
    ])
  })

  it('uses legacy ?direction= param for a 4-field station', () => {
    setLocation('?stations=9324:Duvbo:METRO:10&direction=all')
    const { stations } = parseConfigFromQuery()
    expect(stations[0].direction).toBe('all')
  })

  it('defaults direction to "stockholm" when no 5th field and no legacy param', () => {
    setLocation('?stations=9324:Duvbo:METRO:10')
    const { stations } = parseConfigFromQuery()
    expect(stations[0].direction).toBe('stockholm')
  })

  it('decodes percent-encoded station names', () => {
    setLocation('?stations=9324:My%20Station:METRO:10:all')
    const { stations } = parseConfigFromQuery()
    expect(stations[0].name).toBe('My Station')
  })
})
