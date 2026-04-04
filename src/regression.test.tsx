import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import App from './App'
import { buildQueryString } from './utils'

// Mock sub-components to focus on App logic
vi.mock('./components/Configurator', () => ({
  default: () => <div data-testid="configurator">Mock Configurator</div>
}))

vi.mock('./components/Clock', () => ({
  default: () => <div data-testid="clock">12:00:00</div>
}))

// Mock fetch
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

describe('App Regression Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Default mock response
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ departures: [] })
    })

    // Reset URL
    window.history.replaceState({}, '', '/')
  })

  it('updates configuration when popstate event is fired', async () => {
    // 1. Initial render with default stations
    render(<App />)
    
    // 2. Simulate URL change (e.g., from Configurator's handleApply)
    const newStations = [
      { siteId: 1234, name: 'New Station', mode: 'BUS' as const, walkTime: 5, direction: 'all' }
    ]
    const newUrl = buildQueryString(newStations)
    
    // We need to actually change the URL for parseConfigFromQuery to see it
    window.history.pushState({}, '', newUrl)
    
    // 3. Dispatch popstate
    await act(async () => {
      window.dispatchEvent(new PopStateEvent('popstate'))
    })

    // 4. Verify App updated (it should now show "BUS från New Station" in its title calculation)
    // Wait for the new fetch call triggered by the new config
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('1234'))
    })

    // The header title should update
    expect(screen.getByText('New Station')).toBeDefined()
  })
})
