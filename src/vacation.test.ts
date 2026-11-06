import { expect, it } from 'vitest'
import { vacationProblem } from './vacation'

it('takes dates the API takes', () => {
  const today = '2026-11-06'
  expect(vacationProblem('2026-11-06', '2026-11-06', today)).toBeNull()
  expect(vacationProblem('2026-11-01', '2026-11-10', today)).toBeNull() // already started
  expect(vacationProblem('2026-12-22', '2027-01-06', today)).toBeNull()
  expect(vacationProblem('2026-11-06', '2027-02-03', today)).toBeNull() // 90 days
})

it('says what is wrong with the dates', () => {
  const today = '2026-11-06'
  expect(vacationProblem('', '2026-11-10', today)).toBe('vacation.error.missing')
  expect(vacationProblem('2026-11-10', '2026-11-09', today)).toBe('vacation.error.order')
  expect(vacationProblem('2026-11-01', '2026-11-05', today)).toBe('vacation.error.past')
  expect(vacationProblem('2026-11-06', '2027-02-04', today)).toBe('vacation.error.long') // 91 days
  expect(vacationProblem('2027-11-08', '2027-11-09', today)).toBe('vacation.error.far')
})
