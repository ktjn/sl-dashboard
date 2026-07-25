import type { ComponentProps } from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import StationCard from './StationCard'
import type { StationConfig } from '../types'
import type { SiteDeparture } from '../hooks/useDepartures'

function makeStation(overrides: Partial<StationConfig> = {}): StationConfig {
  return { siteId: 9324, name: 'Duvbo', mode: 'METRO', walkTime: 10, direction: '', ...overrides }
}

function makeDeparture(destination: string, direction: string | undefined, originSiteId = 9324): SiteDeparture {
  return {
    originSiteId,
    departure: {
      destination,
      direction,
      display: '5 min',
      scheduled: '2026-04-04T12:10:00Z',
      line: { id: 10, designation: '10', transport_mode: 'METRO' }
    }
  }
}

const defaultDepartures: SiteDeparture[] = [
  makeDeparture('T-Centralen', 'Kungsträdgården'),
  makeDeparture('Hjulsta', 'Hjulsta'),
]

function renderCard(overrides: Partial<ComponentProps<typeof StationCard>> = {}) {
  const onAddDirectionTag = vi.fn()
  const props: ComponentProps<typeof StationCard> = {
    station: makeStation(),
    index: 0,
    isDragging: false,
    directionQuery: '',
    directionDropdownOpen: true,
    availableDepartures: defaultDepartures,
    onUpdate: vi.fn(),
    onRemove: vi.fn(),
    onDragStart: vi.fn(),
    onDrop: vi.fn(),
    onDragEnd: vi.fn(),
    onDirectionQueryChange: vi.fn(),
    onDirectionDropdownOpen: vi.fn(),
    onDirectionDropdownClose: vi.fn(),
    onAddDirectionTag,
    onRemoveDirectionTag: vi.fn(),
    ...overrides,
  }
  render(<StationCard {...props} />)
  return { onAddDirectionTag }
}

describe('StationCard direction picker', () => {
  beforeEach(() => {
    cleanup()
  })

  it('groups options into Riktning (direction) and Slutstation (destination), excluding duplicates', () => {
    renderCard()
    expect(screen.getByText('Riktning')).toBeDefined()
    expect(screen.getByText('Slutstation')).toBeDefined()
    expect(screen.getByRole('button', { name: 'Kungsträdgården' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Hjulsta' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'T-Centralen' })).toBeDefined()
  })

  it('adds an exact-match tag when a direction option is picked', () => {
    const { onAddDirectionTag } = renderCard()
    fireEvent.click(screen.getByRole('button', { name: 'Kungsträdgården' }))
    expect(onAddDirectionTag).toHaveBeenCalledWith('=Kungsträdgården')
  })

  it('adds a raw substring tag when a destination option is picked', () => {
    const { onAddDirectionTag } = renderCard()
    fireEvent.click(screen.getByRole('button', { name: 'T-Centralen' }))
    expect(onAddDirectionTag).toHaveBeenCalledWith('T-Centralen')
  })

  it('renders an exact-match tag chip without the leading =', () => {
    renderCard({ station: makeStation({ direction: '=Kungsträdgården' }) })
    expect(screen.getByText('Kungsträdgården')).toBeDefined()
    expect(screen.queryByText('=Kungsträdgården')).toBeNull()
  })

  it('hides both groups and shows "Inga träffar" when the query matches nothing', () => {
    renderCard({ directionQuery: 'zzz-no-match' })
    expect(screen.queryByText('Riktning')).toBeNull()
    expect(screen.queryByText('Slutstation')).toBeNull()
    expect(screen.getByText('Inga träffar')).toBeDefined()
  })

  it('a value present in both destination and direction is listed only under Riktning', () => {
    renderCard({
      availableDepartures: [makeDeparture('Hjulsta', 'Hjulsta')],
    })
    expect(screen.getAllByRole('button', { name: 'Hjulsta' })).toHaveLength(1)
  })
})
