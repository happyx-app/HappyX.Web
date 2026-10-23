import { expect, it } from 'vitest'
import { messages, pickLanguage } from './i18n'

it('every language has the same keys as English', () => {
  const keys = Object.keys(messages.en).sort()
  for (const [code, m] of Object.entries(messages)) {
    expect(Object.keys(m).sort(), code).toEqual(keys)
  }
})

it('uses the saved language and English otherwise', () => {
  expect(pickLanguage('es')).toBe('es')
  expect(pickLanguage('ca')).toBe('en')
  expect(pickLanguage('ja')).toBe('en')
  expect(pickLanguage(null)).toBe('en')
})
