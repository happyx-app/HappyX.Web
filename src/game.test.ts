import { expect, it } from 'vitest'
import { celebration, dayBefore, medal, myScore, places, proposalCount } from './game'
import type { GameRound } from './api'

it('answers close the day before guessing starts', () => {
  expect(dayBefore('2026-10-22')).toBe('2026-10-21')
  expect(dayBefore('2026-11-01')).toBe('2026-10-31')
})

it('ties share a place', () => {
  const s = (correct: number, guesses: number) => ({ discord_user_id: '', username: '', correct, guesses })
  expect(places([s(3, 3), s(3, 3), s(1, 2), s(1, 3)])).toEqual([0, 0, 2, 3])
  expect([0, 1, 2, 3].map(medal)).toEqual(['1.', '2.', '3.', '4.'])
})

it('counts the questions in the draw', () => {
  expect(proposalCount(0)).toContain('HappyX')
  expect(proposalCount(1)).toBe('1 question in the draw so far')
  expect(proposalCount(4)).toBe('4 questions in the draw so far')
})

it('counts your right guesses in a finished round', () => {
  const round = {
    answers: [
      { id: 'a', answer: 'x', mine: false, discord_user_id: 'u1' },
      { id: 'b', answer: 'y', mine: false, discord_user_id: 'u2' },
      { id: 'c', answer: 'z', mine: true, discord_user_id: 'me' },
    ],
    my_guesses: { a: 'u1', b: 'u1' },
  } as unknown as GameRound
  expect(myScore(round)).toEqual({ right: 1, guesses: 2 })
  expect(myScore({ ...round, my_guesses: {} })).toEqual({ right: 0, guesses: 0 })
})

it('picks the logo gesture for your result', () => {
  expect(celebration(0, 3)).toBeNull()
  expect(celebration(1, 3)).toBe('peek')
  expect(celebration(1, 1)).toBe('peek')
  expect(celebration(3, 3)).toBe('peek-all')
})
