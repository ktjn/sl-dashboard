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

vi.mock('../hooks/useStationSearch', () => ({
  useStationSearch: () => ({ results: [], loading: false, error: null })
}))

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

describe('Configurator', () => {
  beforeEach(() => {
    cleanup()
    vi.clearAllMocks()
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
})
