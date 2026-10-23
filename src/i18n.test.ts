import { expect, it } from 'vitest'
import { messages, pickLanguage } from './i18n'

it('every language has the same keys as English', () => {
  const keys = Object.keys(messages.en).sort()
  for (const [code, m] of Object.entries(messages)) {
    expect(Object.keys(m).sort(), code).toEqual(keys)
  }
})

it('picks the first language we have', () => {
  expect(pickLanguage(['fr-FR', 'es-ES', 'en'])).toBe('es')
  expect(pickLanguage(['ca'])).toBe('ca')
  expect(pickLanguage(['ja'])).toBe('en')
  expect(pickLanguage([])).toBe('en')
})
