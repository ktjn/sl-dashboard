import { useState, useEffect, useCallback } from 'react'
import { DEPARTURE_FETCH_INTERVAL_MS } from '../constants'
import { matchesDirection } from '../utils'
import type { Departure, DeparturesResponse, AppConfig } from '../types'

export interface SiteDeparture {
  departure: Departure
  originSiteId: number
}

interface UseDeparturesResult {
  departures: SiteDeparture[]
  allDepartures: SiteDeparture[]
  loading: boolean
  error: string | null
  lastUpdate: Date | null
  refetch: () => void
}

export function useDepartures(config: AppConfig): UseDeparturesResult {
  const [departures, setDepartures] = useState<SiteDeparture[]>([])
  const [allDepartures, setAllDepartures] = useState<SiteDeparture[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  const { stations } = config
  const uniqueSiteIds = [...new Set(stations.map(s => s.siteId))]

  const fetchDepartures = useCallback(async () => {
    try {
      const responses = await Promise.all(
        uniqueSiteIds.map(siteId =>
          fetch(`https://transport.integration.sl.se/v1/sites/${siteId}/departures`)
        )
      )

      const failedResponse = responses.find(r => !r.ok)
      if (failedResponse) {
        throw new Error(`API error: ${failedResponse.status}`)
      }

      const allData: DeparturesResponse[] = await Promise.all(
        responses.map(r => r.json())
      )

      const withOrigin = allData.flatMap((data, index) => {
        const siteId = uniqueSiteIds[index]
        return data.departures.map(d => ({ departure: d, originSiteId: siteId }))
      })

      // Direction-filtered departures shown on the board
      const filtered = withOrigin
        .filter(({ departure: d, originSiteId }) => {
          const station = stations.find(s => s.siteId === originSiteId && s.mode === d.line.transport_mode)
          if (!station) return false
          return matchesDirection(d, station.direction)
        })

      setDepartures(filtered)
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

  return { departures, allDepartures, loading, error, lastUpdate, refetch: fetchDepartures }
}
