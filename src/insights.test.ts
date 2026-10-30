import { describe, expect, it } from 'vitest'
import type { ReportMessage } from './api'
import { delta, filterMessages, lowestWeekday, moodGroup, previousRange, tone, weekdayAverages } from './insights'

describe('previousRange', () => {
  it('takes the same number of days just before', () => {
    expect(previousRange({ from: '2026-10-01', to: '2026-10-30' })).toEqual({ from: '2026-09-01', to: '2026-09-30' })
    expect(previousRange({ from: '2026-10-26', to: '2026-10-26' })).toEqual({ from: '2026-10-25', to: '2026-10-25' })
  })
})

describe('delta', () => {
  it('rounds to the digits shown', () => {
    expect(delta(3.94, 3.6, 1)).toEqual({ value: 0.3, trend: 'up' })
    expect(delta(3.62, 3.6, 1)).toEqual({ value: 0, trend: 'flat' })
    expect(delta(10, 14)).toEqual({ value: -4, trend: 'down' })
  })
})

describe('weekdayAverages', () => {
  // 2026-10-26 is a Monday.
  const days = [
    { day: '2026-10-26', responses: 2, average: 3 },
    { day: '2026-10-27', responses: 0, average: 0 },
    { day: '2026-11-02', responses: 1, average: 4.5 },
    { day: '2026-10-30', responses: 3, average: 4 },
  ]
  it('weights by answers, skips empty days and sorts from Monday', () => {
    const w = weekdayAverages(days)
    expect(w.map((x) => x.weekday)).toEqual([1, 5])
    expect(w[0].responses).toBe(3)
    expect(w[0].average).toBeCloseTo(3.5)
  })
  it('finds a clearly lowest day only', () => {
    expect(lowestWeekday(weekdayAverages(days))?.weekday).toBe(1)
    expect(lowestWeekday(weekdayAverages([{ day: '2026-10-26', responses: 1, average: 4 }, { day: '2026-10-27', responses: 1, average: 3.9 }]))).toBeNull()
    expect(lowestWeekday([])).toBeNull()
  })
})

describe('mood filter', () => {
  const msg = (mood: number): ReportMessage => ({ day: '2026-10-26', mood, message: String(mood) })
  const all = [1, 2, 3, 4, 5].map(msg)
  it('groups moods', () => {
    expect([1, 2, 3, 4, 5].map(moodGroup)).toEqual(['low', 'low', 'mid', 'high', 'high'])
    expect(filterMessages(all, 'all')).toHaveLength(5)
    expect(filterMessages(all, 'low').map((m) => m.mood)).toEqual([1, 2])
  })
})

describe('tone', () => {
  it.each([[4.5, 'great'], [3.9, 'good'], [3, 'mixed'], [2, 'tough']] as const)('%s', (avg, want) => {
    expect(tone(avg)).toBe(want)
  })
})
