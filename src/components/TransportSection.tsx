import { TRANSPORT_TYPES } from '../constants'
import type { Departure, TransportMode } from '../types'
import DepartureRow from './DepartureRow'

interface TransportSectionProps {
  title: string
  departures: Departure[]
  transportMode: TransportMode
  currentTime: Date
  walkingTime: number
}

export default function TransportSection({ title, departures, transportMode, currentTime, walkingTime }: TransportSectionProps) {
  const typeConfig = TRANSPORT_TYPES[transportMode]
  if (!typeConfig) return null

  const filteredDepartures = departures
    .filter(d => d.line.transport_mode === transportMode)
    .slice(0, 6)

  if (filteredDepartures.length === 0) return null

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
        {filteredDepartures.map((dep, idx) => (
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
