// «Your year» in «My evolution»: one square per day of the last 12 months, in columns of weeks
// (Monday on top), coloured by that day's mood.

import type { MyGuildMoods } from './api'
import { addDays, type Range } from './periods'

// mood: answered. missed: the survey went out and got no answer. pending: today's survey, not
// answered yet. vacation: the person was on vacation. none: no survey that day (a non-working day,
// the survey off, or before HappyX).
export type DayKind = 'mood' | 'missed' | 'pending' | 'vacation' | 'none'

export interface GuildDay {
  id: string
  kind: DayKind
  mood?: number
  message?: string
}

export interface YearDay {
  day: string
  kind: DayKind
  mood?: number // the average of the servers shown, when answered
  // Answered in one server and missed in another: painted with the mood and marked as a gap.
  partial: boolean
  guilds: GuildDay[]
}

export interface Year {
  // weeks[w][d]: week w (oldest first), weekday d (0 Monday … 6 Sunday); null before the range
  // starts or after today.
  weeks: (YearDay | null)[][]
  // The weekdays (0 Monday … 6 Sunday) with anything to show; a weekend without surveys, answers
  // or vacations is left out.
  rows: number[]
}

// Whether the API sends what the grid needs. Older APIs don't, and then the grid isn't shown:
// guessing the survey days would mark days as missed that never had a survey.
export const hasYearData = (guilds: MyGuildMoods[]) => guilds.every((g) => g.survey_days !== undefined && g.vacations !== undefined)

const weekday = (day: string) => (new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7

function guildDay(g: MyGuildMoods, day: string, today: string, moods: Map<string, { mood: number; message?: string }>, surveyed: Set<string>): GuildDay {
  const id = g.discord_guild_id
  const e = moods.get(day)
  if (e !== undefined) return { id, kind: 'mood', mood: e.mood, ...(e.message ? { message: e.message } : {}) }
  // survey_days are the server's: on a vacation the survey went out, but not to this person. Only
  // those days show as vacation, so weekends and days before HappyX stay without a survey.
  if (!surveyed.has(day)) return { id, kind: 'none' }
  if (g.vacations!.some((v) => v.from <= day && day <= v.to)) return { id, kind: 'vacation' }
  return { id, kind: day === today ? 'pending' : 'missed' }
}

// An answer in any server counts for the day; a survey without one, in any server, makes it missed;
// a vacation only when no survey was missed elsewhere. Today isn't missed while it can be answered.
function combine(gs: GuildDay[]): Pick<YearDay, 'kind' | 'mood' | 'partial'> {
  const answered = gs.filter((g) => g.kind === 'mood')
  const missed = gs.some((g) => g.kind === 'missed')
  if (answered.length > 0) return { kind: 'mood', mood: answered.reduce((s, g) => s + g.mood!, 0) / answered.length, partial: missed }
  if (missed) return { kind: 'missed', partial: false }
  if (gs.some((g) => g.kind === 'pending')) return { kind: 'pending', partial: false }
  if (gs.some((g) => g.kind === 'vacation')) return { kind: 'vacation', partial: false }
  return { kind: 'none', partial: false }
}

export function toYear(guilds: MyGuildMoods[], range: Range): Year {
  const moods = new Map(guilds.map((g) => [g.discord_guild_id, new Map(g.entries.map((e) => [e.day, { mood: e.mood, message: e.message }]))]))
  const surveyed = new Map(guilds.map((g) => [g.discord_guild_id, new Set(g.survey_days)]))
  const weeks: (YearDay | null)[][] = []
  for (let start = addDays(range.from, -weekday(range.from)); start <= range.to; start = addDays(start, 7)) {
    weeks.push(
      [0, 1, 2, 3, 4, 5, 6].map((d) => {
        const day = addDays(start, d)
        if (day < range.from || day > range.to) return null
        const gs = guilds.map((g) => guildDay(g, day, range.to, moods.get(g.discord_guild_id)!, surveyed.get(g.discord_guild_id)!))
        const c = combine(gs)
        return { day, ...c, guilds: gs }
      }),
    )
  }
  const rows = [0, 1, 2, 3, 4, 5, 6].filter((d) => d < 5 || weeks.some((w) => w[d] && w[d].kind !== 'none'))
  return { weeks, rows }
}

// The mood step a day is painted with: 1 to 5, as the emojis.
export const moodStep = (mood: number) => Math.min(5, Math.max(1, Math.round(mood)))

// The week columns that start a month, with that month («2026-03»). The first column only gets a
// label when the next month starts at least 3 weeks later, so two labels never overlap.
export function monthStarts(year: Year): { week: number; month: string }[] {
  const out: { week: number; month: string }[] = []
  year.weeks.forEach((w, i) => {
    const days = w.filter((d): d is YearDay => d !== null)
    // A column is labelled with the month that starts in it; the first column, with its own.
    const day = days.find((d) => d.day.endsWith('-01'))?.day ?? (i === 0 ? days[0]?.day : undefined)
    if (day) out.push({ week: i, month: day.slice(0, 7) })
  })
  return out.filter((m, i) => !(i === 0 && out[1] && out[1].week - m.week < 3))
}
