import { useClock } from '../hooks/useClock'

function formatCurrentTime(date: Date): string {
  return date.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export default function Clock() {
  const currentTime = useClock()

  return (
    <div className="clock">
      <div className="time">{formatCurrentTime(currentTime)}</div>
      <div className="date">
        {currentTime.toLocaleDateString('sv-SE', {
          weekday: 'long',
          day: 'numeric',
          month: 'long'
        })}
      </div>
    </div>
  )
}
