// Date ranges for the period picker. Days are 'YYYY-MM-DD' strings, like the API's, and
// "today" is taken in the server's timezone so the dashboard matches the bot's reports.

export const presets = ['last-30', 'this-week', 'last-week', 'this-month', 'last-month', 'last-90'] as const
export type Preset = (typeof presets)[number]

export interface Range {
  from: string
  to: string
}

export function isPreset(v: string | null): v is Preset {
  return v !== null && (presets as readonly string[]).includes(v)
}

export function todayIn(timeZone: string, now = new Date()): string {
  try {
    // en-CA formats dates as YYYY-MM-DD.
    return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
  } catch {
    return now.toISOString().slice(0, 10)
  }
}

const parse = (day: string) => new Date(`${day}T00:00:00Z`)
const format = (d: Date) => d.toISOString().slice(0, 10)

export function addDays(day: string, n: number): string {
  const d = parse(day)
  d.setUTCDate(d.getUTCDate() + n)
  return format(d)
}

function monday(day: string): string {
  const offset = (parse(day).getUTCDay() + 6) % 7 // days since Monday
  return addDays(day, -offset)
}

function firstOfMonth(day: string): string {
  return day.slice(0, 8) + '01'
}

export function rangeFor(preset: Preset, today: string): Range {
  switch (preset) {
    case 'last-30':
      return { from: addDays(today, -29), to: today }
    case 'last-90':
      return { from: addDays(today, -89), to: today }
    case 'this-week':
      return { from: monday(today), to: today }
    case 'last-week': {
      const m = monday(today)
      return { from: addDays(m, -7), to: addDays(m, -1) }
    }
    case 'this-month':
      return { from: firstOfMonth(today), to: today }
    case 'last-month': {
      const first = firstOfMonth(today)
      return { from: firstOfMonth(addDays(first, -1)), to: addDays(first, -1) }
    }
  }
}
