// Data shaping for "My evolution": the logged-in person's own answers, one line per server.

import type { MyGameWeek, MyGuildMoods } from './api'
import { addDays, type Range } from './periods'

export const evolutionPeriods = ['week', 'month', 'year'] as const
export type EvolutionPeriod = (typeof evolutionPeriods)[number]

export function isEvolutionPeriod(v: string | null): v is EvolutionPeriod {
  return v !== null && (evolutionPeriods as readonly string[]).includes(v)
}

export function evolutionRange(period: EvolutionPeriod, today: string): Range {
  const days = { week: 7, month: 30, year: 365 }[period]
  return { from: addDays(today, 1 - days), to: today }
}

// Categorical colours, in a fixed order that keeps neighbours apart for colour-blind readers.
// A server keeps its colour whatever the filter: it comes from its place in the full list.
export const maxSeries = 8
export const seriesColor = (index: number) => (index < maxSeries ? `var(--cat-${index + 1})` : null)

export interface Points {
  xs: string[] // the day each point stands for (a Monday when grouped by week)
  byWeek: boolean
  values: Map<string, (number | null)[]> // guild ID -> mood per point
  counts: Map<string, number[]> // guild ID -> answers per point
}

function monday(day: string): string {
  const offset = (new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7
  return addDays(day, -offset)
}

// One point per day, or per week for a year so the lines stay readable.
export function toPoints(guilds: MyGuildMoods[], range: Range, period: EvolutionPeriod): Points {
  const byWeek = period === 'year'
  const bucket = byWeek ? monday : (d: string) => d
  const xs: string[] = []
  for (let d = bucket(range.from); d <= range.to; d = addDays(d, byWeek ? 7 : 1)) xs.push(d)
  const index = new Map(xs.map((d, i) => [d, i]))

  const values = new Map<string, (number | null)[]>()
  const counts = new Map<string, number[]>()
  for (const g of guilds) {
    const sum = xs.map(() => 0)
    const n = xs.map(() => 0)
    for (const e of g.entries) {
      const i = index.get(bucket(e.day))
      if (i === undefined) continue
      sum[i] += e.mood
      n[i]++
    }
    values.set(g.discord_guild_id, sum.map((v, i) => (n[i] > 0 ? v / n[i] : null)))
    counts.set(g.discord_guild_id, n)
  }
  return { xs, byWeek, values, counts }
}

// The most recent comments first.
export function latestMessages(g: MyGuildMoods, limit = 3) {
  return g.entries.filter((e) => e.message).slice(-limit).reverse()
}

// share is the percentage of right guesses, rounded; 0 when there were none.
export const share = (correct: number, guesses: number) => (guesses > 0 ? Math.round((correct / guesses) * 100) : 0)

// Bars per round only start at this many rounds: with fewer, the total says it all. A long
// period shows the latest maxGameBars rounds, so the bars stay readable on a phone.
export const minGameBars = 3
export const maxGameBars = 6

// gameTotals adds up your «Who's who?» rounds, leaving out any where you didn't guess.
export function gameTotals(weeks: MyGameWeek[]) {
  const played = weeks.filter((w) => w.guesses > 0)
  return {
    weeks: played,
    correct: played.reduce((n, w) => n + w.correct, 0),
    guesses: played.reduce((n, w) => n + w.guesses, 0),
    bars: played.length >= minGameBars ? played.slice(-maxGameBars) : [],
  }
}
