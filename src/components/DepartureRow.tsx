import { memo } from 'react'
import { formatTime, getLineColor } from '../utils'
import type { Departure } from '../types'

interface DepartureRowProps {
  departure: Departure
  currentTime: Date
  walkingTime: number
}

function DepartureRow({ departure, currentTime, walkingTime }: DepartureRowProps) {
  const transportMode = departure.line.transport_mode
  const lineColor = getLineColor(departure.line.id, transportMode)

  const departureTime = new Date(departure.expected || departure.scheduled)
  const leaveTime = new Date(departureTime.getTime() - walkingTime * 60000)
  const minutesUntilLeave = Math.round((leaveTime.getTime() - currentTime.getTime()) / 60000)

  const tooLate = minutesUntilLeave < -1
  const shouldLeaveNow = minutesUntilLeave >= -1 && minutesUntilLeave <= 0
  const shouldLeaveSoon = minutesUntilLeave <= 2 && minutesUntilLeave > 0

  const leaveDisplay = tooLate ? 'För sent' : minutesUntilLeave <= 0 ? 'Nu!' : `${minutesUntilLeave} min`
  const isUrgent = shouldLeaveNow || shouldLeaveSoon

  return (
    <div className={`departure-row ${tooLate ? 'too-late' : shouldLeaveNow ? 'leave-now' : shouldLeaveSoon ? 'leave-soon' : ''}`}>
      <div className="line-info">
        <div className="line-badge" style={{ backgroundColor: lineColor }}>
          <span className="line-number">{departure.line.designation}</span>
        </div>
      </div>
      <div className="destination-info">
        <span className="destination">{departure.destination}</span>
        {departure.stop_area && (
          <span className="via">{departure.stop_area.name}</span>
        )}
      </div>
      <div className="leave-time">
        <span className="leave-label">Gå</span>
        <span className={`leave-value ${tooLate ? 'too-late' : shouldLeaveNow ? 'blink urgent' : shouldLeaveSoon ? 'soon' : ''}`}>
          {leaveDisplay}
        </span>
      </div>
      {departure.stop_point?.designation && transportMode === 'TRAIN' && (
        <div className="track">
          <span className="track-label">Spår</span>
          <span className="track-number">{departure.stop_point.designation}</span>
        </div>
      )}
      <div className="time-info">
        <span className={`minutes ${isUrgent ? 'blink' : ''}`}>
          {departure.display}
        </span>
        <span className="actual-time">{formatTime(departure.expected || departure.scheduled)}</span>
      </div>
    </div>
  )
}

export default memo(DepartureRow)
