import { pickVariant } from '../deviations'
import type { DeviationMessage } from '../types'

interface DeviationNoticeProps {
  messages: DeviationMessage[]
  severity: 'major' | 'minor'
}

export default function DeviationNotice({ messages, severity }: DeviationNoticeProps) {
  const items = messages
    .map(m => ({ id: m.deviation_case_id, variant: pickVariant(m) }))
    .filter(i => i.variant?.header)
  if (items.length === 0) return null

  return (
    <div className={`deviation deviation-${severity}`} role={severity === 'major' ? 'alert' : 'status'}>
      {items.map(({ id, variant }) => (
        <details key={id} className="deviation-item" open={severity === 'major'}>
          <summary>
            <span className="deviation-icon" aria-hidden="true">⚠</span>
            {variant!.header}
          </summary>
          {variant!.details && <p className="deviation-details">{variant!.details}</p>}
          {variant!.weblink && /^https:\/\//.test(variant!.weblink) && (
            <a href={variant!.weblink} target="_blank" rel="noopener noreferrer">Mer information</a>
          )}
        </details>
      ))}
    </div>
  )
}
