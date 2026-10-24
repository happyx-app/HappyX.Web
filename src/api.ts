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
  survey_hour: number
  games_enabled: boolean
  // ISO days the survey goes out, 1 is Monday and 7 Sunday. Monday to Friday when missing.
  working_days?: number[]
  active: boolean
}

// A server where the user can play the game: they take part and games are on.
export interface GameGuild {
  discord_guild_id: string
  name: string
}

export interface Me {
  user: User
  guilds: Guild[]
  games: GameGuild[]
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

export type GamePhase = 'answering' | 'guessing' | 'finished'

export interface GameAnswer {
  id: string
  answer: string
  mine: boolean
  // Only once the round is finished (and on your own answer).
  discord_user_id?: string
  username?: string
  // How many guessed it right, in finished rounds.
  right?: number
}

export interface GamePlayer {
  discord_user_id: string
  username: string
}

export interface GameScore {
  discord_user_id: string
  username: string
  correct: number
  guesses: number
}

export interface GameRound {
  week: string
  question: string
  phase: GamePhase
  guessing_starts: string
  last_day: string
  answer_count: number
  min_answers: number
  my_answer: string
  answers: GameAnswer[]
  players: GamePlayer[]
  my_guesses: Record<string, string>
  ranking: GameScore[]
  // A member proposed the question; who did is only sent once the round is finished.
  proposed?: boolean
  proposed_by?: GamePlayer
  my_question?: boolean
}

// Next week's question: members propose one Thursday to Sunday and one is drawn on Monday.
export interface GameProposal {
  open: boolean
  week: string
  mine: string
  count: number
}

export interface GameBoard {
  discord_guild_id: string
  name: string
  current: GameRound | null
  previous: GameRound | null
  proposal?: GameProposal
}

// avatarURL is the user's Discord picture, or Discord's own default one for users without a
// picture (the same coloured logo Discord shows them), so nobody is left as a bare initial.
export function avatarURL(userID: string, avatar: string | undefined, size = 64): string {
  if (avatar) return `https://cdn.discordapp.com/avatars/${userID}/${avatar}.png?size=${size}`
  let index = 0
  try {
    index = Number((BigInt(userID) >> 22n) % 6n)
  } catch {
    // Not a Discord ID: any default will do.
  }
  return `https://cdn.discordapp.com/embed/avatars/${index}.png`
}

const base = '/api/web'

export const loginURL = `${base}/auth/login`

export class Unauthorized extends Error {}
export class NotFound extends Error {}
// ApiError carries the API's error message, e.g. a validation reason.
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
  }
}

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

export const game = (guildID: string) => getJSON<GameBoard>(`/guilds/${encodeURIComponent(guildID)}/game`)

export interface SettingsPatch {
  games_enabled?: boolean
  anonymous?: boolean
  timezone?: string
  language?: string
  survey_hour?: number
  report_frequency?: 'weekly' | 'monthly'
  working_days?: number[]
}

// Writes send JSON, which the API requires so other sites can't write on the user's behalf.
async function sendJSON<T>(method: string, path: string, payload: unknown): Promise<T> {
  const res = await fetch(base + path, {
    method,
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
  })
  if (res.status === 401) throw new Unauthorized()
  if (res.status === 404) throw new NotFound()
  const body = res.status === 204 ? {} : await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(res.status, typeof body.error === 'string' ? body.error : res.statusText)
  return body as T
}

export const updateSettings = (guildID: string, patch: SettingsPatch) =>
  sendJSON<Guild>('PATCH', `/guilds/${encodeURIComponent(guildID)}/settings`, patch)

// deleteGuild deletes the server and all its data from HappyX; the bot then leaves it. confirmName
// must be the server's name, as the user typed it.
export const deleteGuild = (guildID: string, confirmName: string) =>
  sendJSON<void>('DELETE', `/guilds/${encodeURIComponent(guildID)}`, { confirm_name: confirmName })

// download fetches an export and hands it to the browser as a file, named as the API says.
async function download(path: string, fallbackName: string): Promise<void> {
  const res = await fetch(base + path, { credentials: 'same-origin' })
  if (res.status === 401) throw new Unauthorized()
  if (res.status === 404) throw new NotFound()
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  const name = res.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1] ?? fallbackName
  const url = URL.createObjectURL(await res.blob())
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

// downloadMyData saves everything HappyX keeps about the user, in every server, as JSON.
export const downloadMyData = () => download('/me/data', 'happyx-my-data.json')

// eraseMyData deletes the user's answers, kudos and game activity everywhere and pauses the survey
// for them. confirmName must be their username, as they typed it.
export const eraseMyData = (confirmName: string) => sendJSON<void>('DELETE', '/me/data', { confirm_name: confirmName })

// downloadGuildData saves the server's data as JSON, with the dashboard's anonymity.
export const downloadGuildData = (guildID: string) =>
  download(`/guilds/${encodeURIComponent(guildID)}/export`, `happyx-${guildID}.json`)

export const answerGame = (guildID: string, answer: string) =>
  sendJSON<{ week: string; answer: string }>('PUT', `/guilds/${encodeURIComponent(guildID)}/game/answer`, { answer })

export const proposeQuestion = (guildID: string, question: string) =>
  sendJSON<{ week: string; question: string }>('PUT', `/guilds/${encodeURIComponent(guildID)}/game/proposal`, { question })

export const guessGame = (guildID: string, guesses: Record<string, string>) =>
  sendJSON<void>('PUT', `/guilds/${encodeURIComponent(guildID)}/game/guesses`, { guesses })

export async function logout(): Promise<void> {
  await fetch(`${base}/auth/logout`, { method: 'POST', credentials: 'same-origin' })
}
