// Client for the API's dashboard routes. nginx forwards /api/web/* to the API, so requests
// are same-origin and carry the HttpOnly session cookie.

export interface User {
  discord_user_id: string
  username: string
  avatar?: string
}

export interface Guild {
  discord_guild_id: string
  name: string
  anonymous: boolean
  timezone: string
  language: string
  report_frequency: 'weekly' | 'monthly'
  active: boolean
}

export interface Me {
  user: User
  guilds: Guild[]
}

export interface DayStat {
  day: string
  responses: number
  average: number
}

export interface ReportMessage {
  day: string
  mood: number
  message: string
  username?: string
}

export interface Report {
  from: string
  to: string
  anonymous: boolean
  responses: number
  respondents: number
  average: number
  distribution: Record<string, number>
  days: DayStat[]
  messages: ReportMessage[]
}

export interface MyMood {
  day: string
  mood: number
  message?: string
}

export interface MyGuildMoods {
  discord_guild_id: string
  name: string
  timezone: string
  responses: number
  average: number
  streak: number
  entries: MyMood[]
}

export interface MyMoods {
  from: string
  to: string
  guilds: MyGuildMoods[]
}

const base = '/api/web'

export const loginURL = `${base}/auth/login`

export class Unauthorized extends Error {}
export class NotFound extends Error {}

async function getJSON<T>(path: string): Promise<T> {
  const res = await fetch(base + path, { credentials: 'same-origin', headers: { Accept: 'application/json' } })
  if (res.status === 401) throw new Unauthorized()
  if (res.status === 404) throw new NotFound()
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return (await res.json()) as T
}

export const me = () => getJSON<Me>('/me')

export const report = (guildID: string, from: string, to: string) =>
  getJSON<Report>(`/guilds/${encodeURIComponent(guildID)}/report?from=${from}&to=${to}`)

export const myMoods = (from: string, to: string) => getJSON<MyMoods>(`/me/moods?from=${from}&to=${to}`)

export async function logout(): Promise<void> {
  await fetch(`${base}/auth/logout`, { method: 'POST', credentials: 'same-origin' })
}
