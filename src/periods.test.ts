import { describe, expect, it } from 'vitest'
import { addDays, isPreset, rangeFor, todayIn } from './periods'

describe('rangeFor', () => {
  const thursday = '2026-10-22'
  it.each([
    ['last-30', '2026-09-23', '2026-10-22'],
    ['last-90', '2026-07-25', '2026-10-22'],
    ['this-week', '2026-10-19', '2026-10-22'],
    ['last-week', '2026-10-12', '2026-10-18'],
    ['this-month', '2026-10-01', '2026-10-22'],
    ['last-month', '2026-09-01', '2026-09-30'],
  ] as const)('%s', (preset, from, to) => {
    expect(rangeFor(preset, thursday)).toEqual({ from, to })
  })

  it('treats Monday as the first day of the week', () => {
    expect(rangeFor('this-week', '2026-10-19')).toEqual({ from: '2026-10-19', to: '2026-10-19' })
    expect(rangeFor('this-week', '2026-10-25')).toEqual({ from: '2026-10-19', to: '2026-10-25' })
  })

  it('crosses years', () => {
    expect(rangeFor('last-month', '2026-01-15')).toEqual({ from: '2025-12-01', to: '2025-12-31' })
    expect(rangeFor('last-week', '2026-01-01')).toEqual({ from: '2025-12-22', to: '2025-12-28' })
  })
})

describe('todayIn', () => {
  const now = new Date('2026-10-22T23:30:00Z')
  it('uses the server timezone', () => {
    expect(todayIn('UTC', now)).toBe('2026-10-22')
    expect(todayIn('Europe/Madrid', now)).toBe('2026-10-23')
    expect(todayIn('America/New_York', now)).toBe('2026-10-22')
  })
  it('falls back to UTC for unknown zones', () => {
    expect(todayIn('Mars/Olympus', now)).toBe('2026-10-22')
  })
})

it('addDays handles month ends and leap years', () => {
  expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
  expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
})

it('isPreset', () => {
  expect(isPreset('last-week')).toBe(true)
  expect(isPreset('yesterday')).toBe(false)
  expect(isPreset(null)).toBe(false)
})
