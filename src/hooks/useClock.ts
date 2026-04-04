import { useState, useEffect } from 'react'
import { CLOCK_TICK_INTERVAL_MS } from '../constants'

export function useClock(): Date {
  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), CLOCK_TICK_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [])

  return currentTime
}
