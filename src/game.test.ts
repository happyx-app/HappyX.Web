import { expect, it } from 'vitest'
import { dayBefore, medal, places } from './game'

it('answers close the day before guessing starts', () => {
  expect(dayBefore('2026-10-22')).toBe('2026-10-21')
  expect(dayBefore('2026-11-01')).toBe('2026-10-31')
})

it('ties share a place', () => {
  const s = (correct: number, guesses: number) => ({ discord_user_id: '', username: '', correct, guesses })
  expect(places([s(3, 3), s(3, 3), s(1, 2), s(1, 3)])).toEqual([0, 0, 2, 3])
  expect([0, 1, 2, 3].map(medal)).toEqual(['🥇', '🥈', '🥉', '4.'])
})
