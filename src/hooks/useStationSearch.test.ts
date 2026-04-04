import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useStationSearch, __clearCacheForTests } from './useStationSearch'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

describe('useStationSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    __clearCacheForTests()
  })

  it('initially loads sites and returns matches for query', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([
        { id: 9324, name: 'Duvbo' },
        { id: 9325, name: 'Sundbyberg' }
      ])
    })

    const { result, rerender } = renderHook(({ query }) => useStationSearch(query), {
      initialProps: { query: '' }
    })

    // Should be loading initially
    expect(result.current.loading).toBe(true)

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.results).toHaveLength(0) // Query too short

    // Rerender with query
    rerender({ query: 'duv' })
    expect(result.current.results).toHaveLength(1)
    expect(result.current.results[0].name).toBe('Duvbo')
  })

  it('uses cache and does not fetch again', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([{ id: 1, name: 'Test' }])
    })

    const { result, unmount } = renderHook(() => useStationSearch('te'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(mockFetch).toHaveBeenCalledTimes(1)

    unmount()

    // Render again
    const { result: result2 } = renderHook(() => useStationSearch('te'))
    expect(result2.current.loading).toBe(false) // Instant from cache
    expect(mockFetch).toHaveBeenCalledTimes(1) // Still 1
  })

  it('returns empty array if query is too short (< 2 chars)', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([{ id: 1, name: 'Test' }])
    })

    const { result } = renderHook(() => useStationSearch('t'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.results).toHaveLength(0)
  })
})
