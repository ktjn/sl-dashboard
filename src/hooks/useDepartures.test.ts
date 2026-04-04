import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useDepartures } from './useDepartures'
import type { AppConfig } from '../types'

// Mock fetch globally
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

describe('useDepartures', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const config: AppConfig = {
    stations: [
      { siteId: 9324, name: 'Duvbo', mode: 'METRO', walkTime: 10, direction: 'stockholm' },
      { siteId: 9325, name: 'Sundbyberg', mode: 'TRAIN', walkTime: 15, direction: 'all' }
    ]
  }

  const mockMetroDeparture = {
    destination: 'Kungsträdgården',
    display: '2 min',
    scheduled: '2026-04-04T12:00:00Z',
    line: { id: 10, designation: '10', transport_mode: 'METRO' }
  }

  const mockTrainDeparture = {
    destination: 'Uppsala C',
    display: '5 min',
    scheduled: '2026-04-04T12:05:00Z',
    line: { id: 40, designation: '40', transport_mode: 'TRAIN' }
  }

  it('successfully fetches and groups departures', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('9324')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ departures: [mockMetroDeparture] })
        })
      }
      if (url.includes('9325')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ departures: [mockTrainDeparture] })
        })
      }
      return Promise.reject(new Error('Unknown site'))
    })

    const { result } = renderHook(() => useDepartures(config))

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.groupedDepartures).toHaveLength(2)
    expect(result.current.groupedDepartures[0].departures).toContainEqual(mockMetroDeparture)
    expect(result.current.groupedDepartures[1].departures).toContainEqual(mockTrainDeparture)
    expect(result.current.error).toBeNull()
  })

  it('handles partial failures gracefully using Promise.allSettled', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('9324')) {
        return Promise.resolve({
          ok: false,
          status: 500
        })
      }
      if (url.includes('9325')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ departures: [mockTrainDeparture] })
        })
      }
      return Promise.reject(new Error('Unknown site'))
    })

    const { result } = renderHook(() => useDepartures(config))

    await waitFor(() => expect(result.current.loading).toBe(false))

    // Station 0 should have no departures due to error
    expect(result.current.groupedDepartures[0].departures).toHaveLength(0)
    // Station 1 should still have its departures
    expect(result.current.groupedDepartures[1].departures).toContainEqual(mockTrainDeparture)
    // Should NOT have a top-level error because some data was retrieved
    expect(result.current.error).toBeNull()
  })

  it('sets top-level error if all requests fail', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 503
    })

    const { result } = renderHook(() => useDepartures(config))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBeDefined()
    expect(result.current.groupedDepartures.every(g => g.departures.length === 0)).toBe(true)
  })
})
