import { describe, it, expect, beforeEach } from 'vitest'
import { parseConfigFromQuery, buildQueryString, matchesDirection } from './utils'
import { DEFAULT_STATIONS } from './constants'
import type { Departure } from './types'

function makeDeparture(destination: string): Departure {
  return {
    destination,
    display: '5 min',
    scheduled: new Date().toISOString(),
    line: { id: 1, designation: '1', transport_mode: 'BUS' },
  }
}

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
  it('encodes colon in station name as %3A', () => {
    const stations = [{ siteId: 9324, name: 'Foo:Bar', mode: 'METRO' as const, walkTime: 10, direction: 'all' }]
    const url = buildQueryString(stations)
    expect(url).toContain('Foo%3ABar')
  })

  it('encodes comma in station name as %2C', () => {
    const stations = [{ siteId: 9324, name: 'Foo,Bar', mode: 'METRO' as const, walkTime: 10, direction: 'all' }]
    const url = buildQueryString(stations)
    expect(url).toContain('Foo%2CBar')
  })

  it('round-trips a direction containing a pipe (normal multi-keyword)', () => {
    const original = [{ siteId: 9324, name: 'Duvbo', mode: 'METRO' as const, walkTime: 10, direction: 'stockholm|centralen' }]
    const url = buildQueryString(original)
    setLocation('?' + url.split('?')[1])
    const { stations } = parseConfigFromQuery()
    expect(stations[0].direction).toBe('stockholm|centralen')
  })
})

// ─── Suite 4: Round-trip verification ───────────────────

describe('round-trip verification', () => {
  it('direction containing ":" is preserved after round-trip', () => {
    const original = [{ siteId: 9324, name: 'Duvbo', mode: 'METRO' as const, walkTime: 10, direction: 'foo:bar' }]
    const url = buildQueryString(original)
    setLocation('?' + url.split('?')[1])
    const { stations } = parseConfigFromQuery()
    expect(stations[0].direction).toBe('foo:bar')
  })

  it('direction containing "," is preserved after round-trip', () => {
    const original = [{ siteId: 9324, name: 'Duvbo', mode: 'METRO' as const, walkTime: 10, direction: 'foo,bar' }]
    const url = buildQueryString(original)
    setLocation('?' + url.split('?')[1])
    const { stations } = parseConfigFromQuery()
    expect(stations[0].direction).toBe('foo,bar')
  })
})

// ─── Suite 5: matchesDirection — case-insensitive keyword matching ────────────

describe('matchesDirection — case-insensitive keyword matching', () => {
  it('matches when keyword has uppercase but departure destination is lowercase', () => {
    // Configurator stores destination names as returned by the API (proper case).
    // The departure destination from the API may have different casing.
    expect(matchesDirection(makeDeparture('farsta centrum'), 'Farsta centrum')).toBe(true)
  })

  it('matches when keyword is all caps', () => {
    expect(matchesDirection(makeDeparture('alvik'), 'ALVIK')).toBe(true)
  })

  it('matches pipe-separated keywords case-insensitively', () => {
    expect(matchesDirection(makeDeparture('alvik'), 'Alvik|Farsta centrum')).toBe(true)
  })

  it('still rejects departures that do not match any keyword', () => {
    expect(matchesDirection(makeDeparture('solna'), 'Alvik')).toBe(false)
  })

  it('matches exactly when using "=" prefix', () => {
    // Departure: 'Farsta'
    // Pattern: '=Farsta' -> Match
    // Pattern: '=Farsta centrum' -> No match
    expect(matchesDirection(makeDeparture('Farsta'), '=Farsta')).toBe(true)
    expect(matchesDirection(makeDeparture('Farsta centrum'), '=Farsta')).toBe(false)
  })

  it('is case-insensitive even with "=" prefix', () => {
    expect(matchesDirection(makeDeparture('farsta'), '=Farsta')).toBe(true)
  })
})
