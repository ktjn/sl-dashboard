import { useState, useEffect, useCallback } from 'react'
import { DEVIATION_FETCH_INTERVAL_MS } from '../constants'
import type { AppConfig, DeviationMessage, SiteDeviation } from '../types'

export function useDeviations(config: AppConfig): SiteDeviation[] {
  const [deviations, setDeviations] = useState<SiteDeviation[]>([])
  const { stations } = config

  const fetchDeviations = useCallback(async () => {
    const siteIds = [...new Set(stations.map(s => s.siteId))]
    const results = await Promise.allSettled(
      siteIds.map(siteId =>
        fetch(`https://deviations.integration.sl.se/v1/messages?site=${siteId}`).then(r => {
          if (!r.ok) throw new Error(`API error: ${r.status}`)
          return r.json() as Promise<DeviationMessage[]>
        })
      )
    )
    const next: SiteDeviation[] = []
    results.forEach((result, i) => {
      if (result.status === 'fulfilled' && Array.isArray(result.value)) {
        result.value.forEach(message => next.push({ message, originSiteId: siteIds[i] }))
      }
    })
    if (results.some(r => r.status === 'fulfilled')) setDeviations(next)
  }, [stations])

  useEffect(() => {
    fetchDeviations()
    const interval = setInterval(fetchDeviations, DEVIATION_FETCH_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [fetchDeviations])

  return deviations
}
