import { describe, it, expect, beforeEach } from 'vitest'
import { parseConfigFromQuery, buildQueryString } from './utils'
import { DEFAULT_STATIONS } from './constants'

function setLocation(search: string) {
  Object.defineProperty(window, 'location', {
    value: { search, origin: 'http://localhost', pathname: '/' },
    writable: true,
    configurable: true,
  })
}

beforeEach(() => {
  setLocation('')
})

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

// ─── Suite 2: parseConfigFromQuery — silent drops and fallbacks ──────────────

describe('parseConfigFromQuery — silent drops and fallbacks', () => {
  it('returns DEFAULT_STATIONS when no ?stations= param', () => {
    setLocation('?')
    const { stations } = parseConfigFromQuery()
    expect(stations).toEqual(DEFAULT_STATIONS)
  })

  it('returns DEFAULT_STATIONS when all stations fail validation (silent fallback, not empty array)', () => {
    setLocation('?stations=abc:Duvbo:METRO:10:all')
    const { stations } = parseConfigFromQuery()
    expect(stations).toEqual(DEFAULT_STATIONS)
  })

  it('silently drops station with unknown mode, keeps valid ones', () => {
    setLocation('?stations=9324:Duvbo:METRO:10:all,9325:X:FERRY:10:all')
    const { stations } = parseConfigFromQuery()
    expect(stations).toHaveLength(1)
    expect(stations[0].siteId).toBe(9324)
  })

  it('silently drops station with NaN walkTime', () => {
    setLocation('?stations=9324:Duvbo:METRO:notanumber:all')
    const { stations } = parseConfigFromQuery()
    expect(stations).toEqual(DEFAULT_STATIONS)
  })

  it('silently drops station with NaN siteId', () => {
    setLocation('?stations=abc:Duvbo:METRO:10:all')
    const { stations } = parseConfigFromQuery()
    expect(stations).toEqual(DEFAULT_STATIONS)
  })
})

// ─── Suite 3: buildQueryString — encoding ────────────────────────────────────

describe('buildQueryString — encoding', () => {
  it('round-trips a station name containing a colon', () => {
    const original = [{ siteId: 9324, name: 'Foo:Bar', mode: 'METRO' as const, walkTime: 10, direction: 'all' }]
    const url = buildQueryString(original)
    setLocation('?' + url.split('?')[1])
    const { stations } = parseConfigFromQuery()
    expect(stations[0].name).toBe('Foo:Bar')
  })

  it('round-trips a station name containing a comma', () => {
    const original = [{ siteId: 9324, name: 'Foo,Bar', mode: 'METRO' as const, walkTime: 10, direction: 'all' }]
    const url = buildQueryString(original)
    setLocation('?' + url.split('?')[1])
    const { stations } = parseConfigFromQuery()
    expect(stations[0].name).toBe('Foo,Bar')
  })

  it('round-trips a direction containing a pipe (normal multi-keyword)', () => {
    const original = [{ siteId: 9324, name: 'Duvbo', mode: 'METRO' as const, walkTime: 10, direction: 'stockholm|centralen' }]
    const url = buildQueryString(original)
    setLocation('?' + url.split('?')[1])
    const { stations } = parseConfigFromQuery()
    expect(stations[0].direction).toBe('stockholm|centralen')
  })
})
