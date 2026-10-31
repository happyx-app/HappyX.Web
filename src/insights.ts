// Small calculations for the server dashboard: the period before the chosen one, how much
// a number moved, the average per weekday, which comments a mood filter keeps, the response
// rate and when the next survey and report go out.

import type { DayStat, Report, ReportMessage } from './api'
import { addDays, type Range } from './periods'

// The rate as a whole percentage, or null without surveys sent.
export function participationRate(p: { recipients: number; answered: number } | undefined): number | null {
  return p && p.recipients > 0 ? Math.round((p.answered / p.recipients) * 100) : null
}

// The date and hour it is now in timeZone.
function nowIn(timeZone: string, now: Date): { day: string; hour: number } {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' }).formatToParts(now)
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
    return { day: `${get('year')}-${get('month')}-${get('day')}`, hour: Number(get('hour')) }
  } catch {
    return { day: now.toISOString().slice(0, 10), hour: now.getUTCHours() }
  }
}

const isoWeekday = (day: string) => ((new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7) + 1

// The day of the next daily survey: today if its hour hasn't come yet, else the next working day.
export function nextSurveyDay(timeZone: string, hour: number, workingDays: number[], now = new Date()): string | null {
  if (workingDays.length === 0) return null
  const here = nowIn(timeZone, now)
  for (let i = 0; i <= 7; i++) {
    const day = addDays(here.day, i)
    if (!workingDays.includes(isoWeekday(day))) continue
    if (i === 0 && here.hour >= hour) continue
    return day
  }
  return null
}

// The day the next report goes out: next Monday for weekly ones, the 1st of next month for monthly.
export function nextReportDay(frequency: 'weekly' | 'monthly', timeZone: string, now = new Date()): string {
  const today = nowIn(timeZone, now).day
  if (frequency === 'monthly') {
    const d = new Date(`${today.slice(0, 8)}01T00:00:00Z`)
    d.setUTCMonth(d.getUTCMonth() + 1)
    return d.toISOString().slice(0, 10)
  }
  return addDays(today, 8 - isoWeekday(today))
}

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

// The days worth pointing out on the trend chart: the highest and the lowest, each only when
// there are at least 7 days with answers, it had at least 3 answers and half the usual daily
// count (so one person can't decide it), and it sits at least 0.5 from the period's average.
// On a tie the most recent day wins. Returns indexes into days.
export function extremeDays(days: DayStat[], average: number): { high: number | null; low: number | null } {
  const answered = days.map((d, i) => ({ d, i })).filter(({ d }) => d.responses > 0)
  if (answered.length < 7) return { high: null, low: null }
  const counts = answered.map(({ d }) => d.responses).sort((a, b) => a - b)
  const mid = Math.floor(counts.length / 2)
  const median = counts.length % 2 ? counts[mid] : (counts[mid - 1] + counts[mid]) / 2
  const solid = answered.filter(({ d }) => d.responses >= 3 && d.responses >= median / 2)
  const round = (v: number) => Math.round(v * 10) / 10
  let high: number | null = null
  let low: number | null = null
  for (const { d, i } of solid) {
    if (round(d.average) >= round(average + 0.5) && (high === null || round(d.average) >= round(days[high].average))) high = i
    if (round(d.average) <= round(average - 0.5) && (low === null || round(d.average) <= round(days[low].average))) low = i
  }
  return { high, low }
}

// The best weekday, to set the lowest one against.
export function highestWeekday(stats: WeekdayStat[]): WeekdayStat | null {
  return stats.length < 2 ? null : stats.reduce((a, b) => (b.average > a.average ? b : a))
}
