import { useState, useEffect, useCallback } from 'react'
import { DEPARTURE_FETCH_INTERVAL_MS } from '../constants'
import { matchesDirection } from '../utils'
import type { Departure, DeparturesResponse, AppConfig } from '../types'

interface UseDeparturesResult {
  departures: Departure[]
  loading: boolean
  error: string | null
  lastUpdate: Date | null
  refetch: () => void
}

export function useDepartures(config: AppConfig): UseDeparturesResult {
  const [departures, setDepartures] = useState<Departure[]>([])
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

      const filtered = allData
        .flatMap(data => data.departures)
        .filter(d => {
          const station = stations.find(s => s.mode === d.line.transport_mode)
          if (!station) return false
          return matchesDirection(d, station.direction)
        })

      setDepartures(filtered)
      setLastUpdate(new Date())
      setError(null)
    } catch (err) {
      console.error('Failed to fetch departures:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(uniqueSiteIds), JSON.stringify(stations.map(s => s.direction))])

  useEffect(() => {
    fetchDepartures()
    const interval = setInterval(fetchDepartures, DEPARTURE_FETCH_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [fetchDepartures])

  return { departures, loading, error, lastUpdate, refetch: fetchDepartures }
}
