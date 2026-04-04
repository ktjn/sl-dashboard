import { useState, useEffect } from 'react'

export interface SiteSearchResult {
  id: number
  name: string
}

interface UseStationSearchResult {
  results: SiteSearchResult[]
  loading: boolean
  error: string | null
}

export function useStationSearch(query: string): UseStationSearchResult {
  const [results, setResults] = useState<SiteSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      setError(null)
      return
    }

    setLoading(true)
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(
          `https://transport.integration.sl.se/v1/sites?q=${encodeURIComponent(query.trim())}`
        )
        if (!response.ok) throw new Error(`API error: ${response.status}`)
        const data = await response.json()
        const sites: SiteSearchResult[] = (Array.isArray(data) ? data : []).map((s: { id: number; name: string }) => ({
          id: s.id,
          name: s.name,
        }))
        setResults(sites)
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Sökning misslyckades')
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [query])

  return { results, loading, error }
}
