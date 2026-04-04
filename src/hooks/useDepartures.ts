import { useState, useEffect, useCallback } from 'react'
import { DEPARTURE_FETCH_INTERVAL_MS } from '../constants'
import { matchesDirection } from '../utils'
import type { Departure, DeparturesResponse, AppConfig } from '../types'

export interface SiteDeparture {
  departure: Departure
  originSiteId: number
}

export interface GroupedDepartures {
  stationIndex: number
  departures: Departure[]
}

interface UseDeparturesResult {
  groupedDepartures: GroupedDepartures[]
  allDepartures: SiteDeparture[]
  loading: boolean
  error: string | null
  lastUpdate: Date | null
  refetch: () => void
}

export function useDepartures(config: AppConfig): UseDeparturesResult {
  const [groupedDepartures, setGroupedDepartures] = useState<GroupedDepartures[]>([])
  const [allDepartures, setAllDepartures] = useState<SiteDeparture[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  const { stations } = config

  const fetchDepartures = useCallback(async () => {
    const uniqueSiteIds = [...new Set(stations.map(s => s.siteId))]
    try {
      const results = await Promise.allSettled(
        uniqueSiteIds.map(siteId =>
          fetch(`https://transport.integration.sl.se/v1/sites/${siteId}/departures`)
            .then(r => {
              if (!r.ok) throw new Error(`API error: ${r.status}`)
              return r.json() as Promise<DeparturesResponse>
            })
        )
      )

      const withOrigin: SiteDeparture[] = []
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          const siteId = uniqueSiteIds[index]
          result.value.departures.forEach(d => {
            withOrigin.push({ departure: d, originSiteId: siteId })
          })
        } else {
          console.error(`Failed to fetch for site ${uniqueSiteIds[index]}:`, result.reason)
        }
      })

      if (withOrigin.length === 0 && results.some(r => r.status === 'rejected')) {
        throw new Error('Kunde inte hämta några avgångar')
      }

      // Group departures by station index
      const grouped = stations.map((station, index) => {
        const filtered = withOrigin
          .filter(d => d.originSiteId === station.siteId && d.departure.line.transport_mode === station.mode)
          .filter(d => matchesDirection(d.departure, station.direction))
          .map(d => d.departure)
        return { stationIndex: index, departures: filtered }
      })

      setGroupedDepartures(grouped)
      setAllDepartures(withOrigin)
      setLastUpdate(new Date())
      setError(null)
    } catch (err) {
      console.error('Failed to fetch departures:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [stations])

  useEffect(() => {
    fetchDepartures()
    const interval = setInterval(fetchDepartures, DEPARTURE_FETCH_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [fetchDepartures])

  return { groupedDepartures, allDepartures, loading, error, lastUpdate, refetch: fetchDepartures }
}
