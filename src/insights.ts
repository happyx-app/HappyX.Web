// Small calculations for the server dashboard: the period before the chosen one, how much
// a number moved, the average per weekday and which comments a mood filter keeps. All of
// them work on the report the API already sends, so the dashboard needs no extra endpoint.

import type { DayStat, Report, ReportMessage } from './api'
import { addDays, type Range } from './periods'

// The range of the same length that ends the day before this one starts.
export function previousRange(r: Range): Range {
  const days = Math.round((Date.parse(`${r.to}T00:00:00Z`) - Date.parse(`${r.from}T00:00:00Z`)) / 86_400_000) + 1
  return { from: addDays(r.from, -days), to: addDays(r.from, -1) }
}

export type Trend = 'up' | 'down' | 'flat'

// Rounded to what the dashboard shows, so «+0,0» never reads as a change.
export function delta(now: number, before: number, digits = 0): { value: number; trend: Trend } {
  const f = 10 ** digits
  const value = Math.round((now - before) * f) / f
  return { value, trend: value > 0 ? 'up' : value < 0 ? 'down' : 'flat' }
}

export interface WeekdayStat {
  weekday: number // 1 = Monday … 7 = Sunday
  day: string // one date that fell on it, to format its name
  responses: number
  average: number
}

// Average mood per day of the week, weighted by answers, Monday first. Weekdays without
// answers are left out, so weekends only appear when someone answered then.
export function weekdayAverages(days: DayStat[]): WeekdayStat[] {
  const acc = new Map<number, WeekdayStat & { sum: number }>()
  for (const d of days) {
    if (d.responses === 0) continue
    const weekday = ((new Date(`${d.day}T00:00:00Z`).getUTCDay() + 6) % 7) + 1
    const w = acc.get(weekday) ?? { weekday, day: d.day, responses: 0, average: 0, sum: 0 }
    w.responses += d.responses
    w.sum += d.average * d.responses
    acc.set(weekday, w)
  }
  return [...acc.values()]
    .sort((a, b) => a.weekday - b.weekday)
    .map(({ sum, ...w }) => ({ ...w, average: sum / w.responses }))
}

// The weekday that stands out as the lowest: only with two or more weekdays to compare and
// at least 0.3 below the best one, so a flat week has no «worst day».
export function lowestWeekday(stats: WeekdayStat[]): WeekdayStat | null {
  if (stats.length < 2) return null
  const low = stats.reduce((a, b) => (b.average < a.average ? b : a))
  const high = stats.reduce((a, b) => (b.average > a.average ? b : a))
  return high.average - low.average >= 0.3 ? low : null
}

export type MoodFilter = 'all' | 'low' | 'mid' | 'high'
export const moodFilters: MoodFilter[] = ['all', 'low', 'mid', 'high']

export function moodGroup(mood: number): Exclude<MoodFilter, 'all'> {
  return mood <= 2 ? 'low' : mood === 3 ? 'mid' : 'high'
}

export function filterMessages(messages: ReportMessage[], f: MoodFilter): ReportMessage[] {
  return f === 'all' ? messages : messages.filter((m) => moodGroup(m.mood) === f)
}

export type Tone = 'great' | 'good' | 'mixed' | 'tough'

export function tone(average: number): Tone {
  return average >= 4.2 ? 'great' : average >= 3.5 ? 'good' : average >= 2.8 ? 'mixed' : 'tough'
}

// Whether the period before has enough to compare against.
export function comparable(prev: Report | null): prev is Report {
  return prev !== null && prev.responses > 0
}
