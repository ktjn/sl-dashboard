import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { DeviationMessage } from '../types'
import DeviationNotice from './DeviationNotice'

const base: DeviationMessage = {
  deviation_case_id: 1,
  message_variants: [
    { header: 'Header EN', language: 'en' },
    { header: 'Rubrik SV', details: 'Detaljer', language: 'sv', weblink: 'https://sl.se/x' },
  ],
}

describe('DeviationNotice', () => {
  afterEach(cleanup)

  it('renders nothing for empty input', () => {
    const { container } = render(<DeviationNotice messages={[]} severity="minor" />)
    expect(container).toBeEmptyDOMElement()
  })

  it('prefers Swedish variant and uses alert role for major', () => {
    render(<DeviationNotice messages={[base]} severity="major" />)
    expect(screen.getByRole('alert')).toHaveTextContent('Rubrik SV')
    expect(screen.getByText('Detaljer')).toBeInTheDocument()
  })

  it('drops non-https weblinks', () => {
    const m = { ...base, message_variants: [{ header: 'x', language: 'sv', weblink: 'javascript:alert(1)' }] }
    render(<DeviationNotice messages={[m]} severity="minor" />)
    expect(screen.queryByRole('link')).toBeNull()
  })
})
