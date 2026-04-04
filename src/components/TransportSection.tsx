import { TRANSPORT_TYPES } from '../constants'
import type { Departure } from '../types'
import DepartureRow from './DepartureRow'

interface TransportSectionProps {
  title: string
  departures: Departure[]
  currentTime: Date
  walkingTime: number
}

export default function TransportSection({ title, departures, currentTime, walkingTime }: TransportSectionProps) {
  const shownDepartures = departures.slice(0, 6)
  if (shownDepartures.length === 0) return null

  const typeConfig = TRANSPORT_TYPES[shownDepartures[0].line.transport_mode]

  return (
    <div className="transport-section">
      <div className="section-header">
        <div className="transport-icon" style={{ backgroundColor: typeConfig.bgColor, color: typeConfig.color }}>
          {typeConfig.icon}
        </div>
        <span className="section-title">{title}</span>
        <span className="walking-time">{walkingTime} min gångväg</span>
      </div>
      <div className="departures-list">
        {shownDepartures.map((dep, idx) => (
          <DepartureRow
            key={`${dep.journey?.id || idx}-${dep.scheduled}`}
            departure={dep}
            currentTime={currentTime}
            walkingTime={walkingTime}
          />
        ))}
      </div>
    </div>
  )
}
