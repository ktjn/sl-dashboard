import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import DepartureRow from './DepartureRow'
import type { Departure } from '../types'

function makeDeparture(overrides: Partial<Departure> = {}): Departure {
  return {
    destination: 'Stockholm C',
    display: '5 min',
    scheduled: '2026-04-04T12:10:00Z',
    expected: '2026-04-04T12:10:00Z',
    line: { id: 10, designation: '10', transport_mode: 'METRO' },
    ...overrides
  }
}

describe('DepartureRow', () => {
  const walkingTime = 10
  // Reference time: 12:00:00
  const currentTime = new Date('2026-04-04T12:00:00Z')

  it('renders "Nu!" and urgent classes when minutesUntilLeave is 0', () => {
    // Departure at 12:10:00, 10 min walk -> Leave at 12:00:00
    const dep = makeDeparture({ expected: '2026-04-04T12:10:00Z' })
    const { container } = render(
      <DepartureRow departure={dep} currentTime={currentTime} walkingTime={walkingTime} />
    )
    
    expect(screen.getByText('Nu!')).toBeDefined()
    expect(container.firstChild).toHaveClass('leave-now')
    // Should have urgent and blink classes
    const leaveValue = screen.getByText('Nu!')
    expect(leaveValue).toHaveClass('urgent')
    expect(leaveValue).toHaveClass('blink')
  })

  it('renders "För sent" and too-late class when minutesUntilLeave < -1', () => {
    // Departure at 12:05:00, 10 min walk -> Leave at 11:55:00 (too late)
    const dep = makeDeparture({ expected: '2026-04-04T12:05:00Z' })
    const { container } = render(
      <DepartureRow departure={dep} currentTime={currentTime} walkingTime={walkingTime} />
    )
    
    expect(screen.getByText('För sent')).toBeDefined()
    expect(container.firstChild).toHaveClass('too-late')
  })

  it('renders "1 min" and leave-soon class when minutesUntilLeave is 1', () => {
    // Departure at 12:11:00, 10 min walk -> Leave at 12:01:00 (1 min from now)
    const dep = makeDeparture({ expected: '2026-04-04T12:11:00Z' })
    const { container } = render(
      <DepartureRow departure={dep} currentTime={currentTime} walkingTime={walkingTime} />
    )
    
    expect(screen.getByText('1 min')).toBeDefined()
    expect(container.firstChild).toHaveClass('leave-soon')
  })

  it('renders normally when there is plenty of time', () => {
    // Departure at 12:20:00, 10 min walk -> Leave at 12:10:00 (10 min from now)
    const dep = makeDeparture({ expected: '2026-04-04T12:20:00Z' })
    const { container } = render(
      <DepartureRow departure={dep} currentTime={currentTime} walkingTime={walkingTime} />
    )
    
    expect(screen.getByText('10 min')).toBeDefined()
    expect(container.firstChild).not.toHaveClass('leave-now')
    expect(container.firstChild).not.toHaveClass('leave-soon')
    expect(container.firstChild).not.toHaveClass('too-late')
  })
})
