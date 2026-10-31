import { describe, expect, it } from 'vitest'
import type { ReportMessage } from './api'
import { delta, extremeDays, filterMessages, lowestWeekday, moodGroup, nextReportDay, nextSurveyDay, participationRate, previousRange, tone, weekdayAverages } from './insights'

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

describe('participationRate', () => {
  it('is a whole percentage, or null without surveys', () => {
    expect(participationRate({ recipients: 18, answered: 14 })).toBe(78)
    expect(participationRate({ recipients: 0, answered: 0 })).toBeNull()
    expect(participationRate(undefined)).toBeNull()
  })
})

describe('schedule', () => {
  // Friday 2026-10-30, 12:00 UTC is 13:00 in Madrid.
  const fri = new Date('2026-10-30T12:00:00Z')
  it('finds the next survey day', () => {
    expect(nextSurveyDay('Europe/Madrid', 14, [1, 2, 3, 4, 5], fri)).toBe('2026-10-30')
    expect(nextSurveyDay('Europe/Madrid', 13, [1, 2, 3, 4, 5], fri)).toBe('2026-11-02')
    expect(nextSurveyDay('Europe/Madrid', 9, [6], fri)).toBe('2026-10-31')
    expect(nextSurveyDay('Europe/Madrid', 9, [], fri)).toBeNull()
  })
  it('finds the next report day', () => {
    expect(nextReportDay('weekly', 'Europe/Madrid', fri)).toBe('2026-11-02')
    expect(nextReportDay('weekly', 'Europe/Madrid', new Date('2026-11-02T12:00:00Z'))).toBe('2026-11-09')
    expect(nextReportDay('monthly', 'Europe/Madrid', fri)).toBe('2026-11-01')
    expect(nextReportDay('monthly', 'Europe/Madrid', new Date('2026-12-15T12:00:00Z'))).toBe('2027-01-01')
  })
})

describe('extremeDays', () => {
  const day = (n: number, average: number, responses = 8) => ({ day: `2026-10-${String(n).padStart(2, '0')}`, responses, average })
  const week = [day(1, 3.5), day(2, 3.6), day(3, 3.4), day(4, 3.5), day(5, 3.5), day(6, 3.5), day(7, 3.5)]

  it('needs 7 days with answers', () => {
    expect(extremeDays([day(1, 4.5), day(2, 2.5), day(3, 3.5)], 3.5)).toEqual({ high: null, low: null })
  })
  it('marks days at least 0.5 from the average', () => {
    expect(extremeDays([...week, day(8, 4.1), day(9, 2.9)], 3.5)).toEqual({ high: 7, low: 8 })
    expect(extremeDays([...week, day(8, 3.9)], 3.5)).toEqual({ high: null, low: null })
  })
  it('ignores days with few answers', () => {
    expect(extremeDays([...week, day(8, 5, 2), day(9, 1, 3)], 3.5)).toEqual({ high: null, low: null })
  })
  it('prefers the most recent day on a tie', () => {
    expect(extremeDays([...week, day(8, 4.4), day(9, 4.4)], 3.5).high).toBe(8)
  })
})
