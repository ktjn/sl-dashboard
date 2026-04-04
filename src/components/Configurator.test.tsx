import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, waitFor, screen, fireEvent, cleanup } from '@testing-library/react'
import Configurator from './Configurator'
import type { AppConfig } from '../types'

// Mock sub-components
vi.mock('./StationCard', () => ({
  default: ({ station, onRemove }: any) => (
    <div data-testid="station-card">
      {station.name} ({station.mode})
      <button onClick={onRemove}>Remove</button>
    </div>
  )
}))

// Define search mock outside to be controllable
const mockSearchState = {
  results: [] as any[],
  loading: false,
  error: null as string | null
}

vi.mock('../hooks/useStationSearch', () => ({
  useStationSearch: () => mockSearchState
}))

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

describe('Configurator', () => {
  beforeEach(() => {
    cleanup()
    vi.clearAllMocks()
    mockSearchState.results = []
    mockSearchState.loading = false
    mockSearchState.error = null
    
    // Default fetch mock
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ departures: [] })
    })

    // Reset clipboard
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined)
      }
    })
  })

  const config: AppConfig = {
    stations: [
      { siteId: 9999, name: 'Initial', mode: 'METRO', walkTime: 10, direction: 'all' }
    ]
  }

  it('auto-corrects station mode if it is not available at the site', async () => {
    // Initial fetch for the site returns only BUS departures
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        departures: [
          { line: { transport_mode: 'BUS' } }
        ]
      })
    })

    render(<Configurator config={config} allDepartures={[]} onClose={vi.fn()} />)

    // Initially it shows METRO from the config
    expect(screen.getByTestId('station-card')).toHaveTextContent(/Initial \(METRO\)/)

    // After availableDepartures logic runs in useEffect, it should switch to BUS
    await waitFor(() => {
      expect(screen.getByTestId('station-card')).toHaveTextContent(/Initial \(BUS\)/)
    })
  })

  it('removes a station when remove button is clicked', async () => {
    render(<Configurator config={config} allDepartures={[]} onClose={vi.fn()} />)
    
    expect(screen.getByTestId('station-card')).toBeDefined()
    
    fireEvent.click(screen.getByText('Remove'))
    
    expect(screen.queryByTestId('station-card')).toBeNull()
  })

  it('fetches departures when a new station is added', async () => {
    // Set up search result
    mockSearchState.results = [{ id: 1234, name: 'Search Result' }]

    render(<Configurator config={config} allDepartures={[]} onClose={vi.fn()} />)

    // Initially 1 fetch for the initial station
    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('9999'))

    // Type in search (trigger showResults)
    const searchInput = screen.getByPlaceholderText(/Sök stationsnamn/)
    fireEvent.change(searchInput, { target: { value: 'search' } })

    // Click the result
    const resultItem = await screen.findByText('Search Result')
    fireEvent.click(resultItem)

    // Should trigger fetch for 1234
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('1234'))
    })
    
    // Should now have 2 station cards
    expect(screen.getAllByTestId('station-card')).toHaveLength(2)
  })
})
