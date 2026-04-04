import { useState, useEffect, useRef } from 'react'

export interface SiteSearchResult {
  id: number
  name: string
}

interface UseStationSearchResult {
  results: SiteSearchResult[]
  loading: boolean
  error: string | null
}

let allSitesCache: SiteSearchResult[] | null = null

export function useStationSearch(query: string): UseStationSearchResult {
  const [allSites, setAllSites] = useState<SiteSearchResult[]>(allSitesCache ?? [])
  const [loading, setLoading] = useState(allSitesCache === null)
  const [error, setError] = useState<string | null>(null)
  const fetchedRef = useRef(false)

  useEffect(() => {
    if (fetchedRef.current || allSitesCache !== null) return
    fetchedRef.current = true
    setLoading(true)
    fetch('https://transport.integration.sl.se/v1/sites')
      .then(r => {
        if (!r.ok) throw new Error(`API error: ${r.status}`)
        return r.json()
      })
      .then((data: { id: number; name: string }[]) => {
        const sites = (Array.isArray(data) ? data : []).map(s => ({ id: s.id, name: s.name }))
        allSitesCache = sites
        setAllSites(sites)
        setError(null)
      })
      .catch(err => {
        setError(err instanceof Error ? err.message : 'Sökning misslyckades')
      })
      .finally(() => setLoading(false))
  }, [])

  const q = query.trim().toLowerCase()
  const results = q.length < 2
    ? []
    : allSites.filter(s => s.name.toLowerCase().includes(q)).slice(0, 20)

  return { results, loading, error }
}
