import { expect, it } from 'vitest'
import { messages, moodEmoji, pickLanguage } from './i18n'

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

it('picks the face from the average as shown, with one decimal', () => {
  expect(moodEmoji(3.46)).toBe('🙂')
  expect(moodEmoji(3.54)).toBe('🙂')
  expect(moodEmoji(3.44)).toBe('😐')
  expect(moodEmoji(0)).toBe('😞')
  expect(moodEmoji(9)).toBe('🤩')
})
