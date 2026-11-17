// Client for the API's dashboard routes. nginx forwards /api/web/* to the API, so requests
// are same-origin and carry the HttpOnly session cookie.

import { lang } from './i18n'

export interface User {
  discord_user_id: string
  username: string
  avatar?: string
}

export interface Guild {
  discord_guild_id: string
  name: string
  anonymous: boolean
  // Once anonymity was turned off, the first day answers carry names (the day after). Left out
  // while the server is anonymous.
  named_since?: string
  // Anonymous results are shown only when at least this many people answered. Older APIs leave
  // it out, which means 3.
  anonymity_threshold?: number
  // A lowered threshold counts from anonymity_threshold_since (the day after it was lowered);
  // until then anonymity_threshold_before stays. Both left out otherwise.
  anonymity_threshold_since?: string
  anonymity_threshold_before?: number
  // Whether members get the survey and the game. A server the bot just joined has it off until an
  // admin starts it. Older APIs leave it out, which means on.
  survey_enabled?: boolean
  timezone: string
  language: string
  report_frequency: 'weekly' | 'monthly'
  // Whether the main admin gets the report by DM. Older APIs leave it out, which means yes.
  report_dm?: boolean
  survey_hour: number
  games_enabled: boolean
  // Where kudos cards are posted; empty or missing means the channel where /happyx kudos is used.
  kudos_channel_id?: string
  // Where HappyX tells the team things: the notes admins write after a report and the Monday
  // summary. Empty or missing means the kudos channel. Older APIs leave both out.
  team_channel_id?: string
  // Whether the past week's summary goes to the team channel on Mondays. Missing means yes.
  team_summary?: boolean
  // ISO days the survey goes out, 1 is Monday and 7 Sunday. Monday to Friday when missing.
  working_days?: number[]
  // The admin's own survey text with {{variables}}; empty or missing means the default text.
  survey_message?: string
  // Who receives the daily survey, and who plays the game, by Discord role. Older APIs leave them
  // out, which means everyone.
  survey_roles?: RoleFilter
  game_roles?: RoleFilter
  // Whether the team canvas is on. Older APIs leave it out, which means off.
  canvas_enabled?: boolean
  active: boolean
  // When the bot joined the server. Older APIs leave it out.
  created_at?: string
  // What the user may do here; only in /me. Older APIs leave it out, which means "owner".
  access?: AccessLevel
  // The main admin's username, for viewers who aren't owners; only in /me, and older APIs leave it out.
  admin_username?: string
}

// view: reports. manage: reports and settings. owner: also who has access, and deleting.
export type AccessLevel = 'view' | 'manage' | 'owner'
export type GrantLevel = 'view' | 'manage'

export const canManage = (g: Guild) => g.access !== 'view'
export const isOwner = (g: Guild) => g.access === undefined || g.access === 'owner'

// all: everyone. except: everyone but members with one of the roles. only: just members with one.
export type RoleFilterMode = 'all' | 'except' | 'only'

export interface RoleFilter {
  mode: RoleFilterMode
  role_ids: string[]
}

export interface Grant {
  kind: 'user' | 'role'
  id: string
  level: GrantLevel
}

export interface Role {
  id: string
  name: string
  color: number // RGB, 0 means no colour
  position: number
}

export interface Member {
  discord_user_id: string
  username: string
}

export interface Access {
  admin_discord_user_id: string
  grants: Grant[]
  roles: Role[]
  members: Member[]
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
  // Servers with HappyX where the user is a member without access to the dashboard. Older APIs
  // leave it out.
  member_guilds?: GameGuild[]
  // Servers where the user paused the survey («Don't ask me again»); older APIs leave it out.
  paused_guilds?: GameGuild[]
}

export interface DayStat {
  day: string
  responses: number
  average: number
  // That day's anonymous answers came from fewer people than the threshold, so its average is
  // not given (0).
  withheld?: boolean
  // The minimum of people that applied to that day: the highest among its answers and the
  // server's current one.
  anonymity_threshold?: number
  // How many people got that day's survey; missing when the bot didn't report it.
  recipients?: number
}

// counted is how many of a day's (or week's) answers its average covers: none on a withheld day,
// whose answers count only in the totals. hasAverage tells whether it has an average to show.
export const counted = (d: DayStat & { counted?: number }) => (d.withheld ? 0 : (d.counted ?? d.responses))
export const hasAverage = (d: DayStat & { counted?: number }) => counted(d) > 0

// countedAnswers is how many answers the report's average and distribution cover: all of them
// but those of withheld days.
export const countedAnswers = (r: Report) => Object.values(r.distribution).reduce((n, c) => n + c, 0)

// An anonymous comment comes with its text only: day and mood are left out so it can't be traced.
export interface ReportMessage {
  day?: string
  mood?: number
  message: string
  username?: string
}

export interface Report {
  from: string
  to: string
  anonymous: boolean
  // The anonymous answers came from fewer people than anonymity_threshold: only the counts are
  // given, with no average, distribution or comments.
  withheld?: boolean
  anonymity_threshold?: number
  responses: number
  respondents: number
  average: number
  distribution: Record<string, number>
  days: DayStat[]
  messages: ReportMessage[]
  // Kudos are public, so they keep their names even on anonymous servers.
  kudos?: KudosSummary
  // Surveys sent and answered on the days with known recipients; missing when there are none.
  participation?: { recipients: number; answered: number }
}

export interface Kudos {
  day: string
  from_username: string
  to_username: string
  message: string
}

export interface KudosSummary {
  count: number
  givers: number
  receivers: number
  highlights: Kudos[] // the latest, newest first
  top_receivers?: { username: string; count: number }[] // most first; older APIs leave it out
}

// Who the survey reaches now and how the last one went.
export interface Health {
  audience: number
  opted_out: number
  on_vacation?: number // older APIs don't send it
  // closed_dms: of the failed DMs, how many because the person has DMs closed (older APIs don't send it).
  last_survey: { day: string; recipients: number; failed: number; closed_dms?: number } | null
  // team_channel: where HappyX posts to the team (the team channel, or else the kudos one), null
  // with neither; can_post is left out when unknown. Older APIs don't send it.
  team_channel?: { id: string; can_post?: boolean } | null
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
  // Whether today's answer is anonymous; older APIs leave it out.
  anonymous?: boolean
  // Once anonymity was turned off, the first day answers carry names.
  named_since?: string
  // The fewest people whose anonymous answers a day needs before admins see more than counts.
  anonymity_threshold?: number
  responses: number
  average: number
  streak: number
  entries: MyMood[]
  // The days of the range when the survey went out in this server, to anyone (so days of the
  // person's vacation too). Older APIs leave it out.
  survey_days?: string[]
  // The person's vacations that touch the range, their own and any set in this server. Older APIs
  // leave it out.
  vacations?: { from: string; to: string }[]
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
  // The finished rounds before last week's, newest first. Older APIs leave it out.
  history?: GameHistoryRound[]
  proposal?: GameProposal
}

// A finished round in the history: the team's total, your own score and who wrote what. It
// carries nobody else's score, so the history adds up to no ranking.
export interface GameHistoryRound {
  week: string
  last_day: string
  question: string
  proposed_by?: GamePlayer
  played: boolean // false when too few answered to play
  answer_count: number
  min_answers: number
  players: number
  guesses: number // every guess the team made
  correct: number // the right ones among them
  mine?: { correct: number; guesses: number } // only when you guessed
  my_guesses: Record<string, string> // answer ID -> who you said
  answers: GameAnswer[] // empty when the round wasn't played
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

// The public demo at /demo shows a made-up server to anyone, without logging in. It reads the
// API's /web/demo/<lang> routes, which answer like the real ones, and saves nothing.
export const isDemo = isDemoPath(typeof location === 'undefined' ? '' : location.pathname)
export function isDemoPath(path: string): boolean {
  return path.replace(/\/+$/, '') === '/demo'
}

const base = isDemo ? `/api/web/demo/${lang}` : '/api/web'

export const loginURL = '/api/web/auth/login'
// Logging in again rereads from Discord the servers the user owns or administers. Discord skips
// its consent screen for an app already allowed, so this is one quick round trip.
export const refreshURL = (next?: string) => (next ? `${loginURL}?next=${encodeURIComponent(next)}` : loginURL)
export const inviteURL = '/api/web/auth/invite'

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
// DemoReadOnly is what every save gets in the demo, without asking the API.
export class DemoReadOnly extends ApiError {
  constructor() {
    super(403, 'the demo saves nothing')
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

// Your own «Who's who?» score per server: one entry per finished round you guessed in, oldest
// first, for rounds whose week starts between from and to.
export interface MyGameWeek {
  week: string
  correct: number
  guesses: number
}
export interface MyGames {
  from: string
  to: string
  guilds: { discord_guild_id: string; name: string; weeks: MyGameWeek[] }[]
}
export const myGames = (from: string, to: string) => getJSON<MyGames>(`/me/games?from=${from}&to=${to}`)

export const game = (guildID: string) => getJSON<GameBoard>(`/guilds/${encodeURIComponent(guildID)}/game`)

export interface SettingsPatch {
  games_enabled?: boolean
  anonymous?: boolean
  anonymity_threshold?: number
  timezone?: string
  language?: string
  survey_hour?: number
  report_frequency?: 'weekly' | 'monthly'
  report_dm?: boolean
  working_days?: number[]
  kudos_channel_id?: string // "" posts where the command is used
  team_channel_id?: string // "" uses the kudos channel
  team_summary?: boolean
  survey_message?: string // "" goes back to the default text
  survey_roles?: RoleFilter
  game_roles?: RoleFilter
  canvas_enabled?: boolean
  survey_enabled?: boolean
}

// Writes send JSON, which the API requires so other sites can't write on the user's behalf.
async function sendJSON<T>(method: string, path: string, payload: unknown): Promise<T> {
  if (isDemo) throw new DemoReadOnly()
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

export const health = (guildID: string) => getJSON<Health>(`/guilds/${encodeURIComponent(guildID)}/health`)

export const updateSettings = (guildID: string, patch: SettingsPatch) =>
  sendJSON<Guild>('PATCH', `/guilds/${encodeURIComponent(guildID)}/settings`, patch)

// deleteGuild deletes the server and all its data from HappyX; the bot then leaves it. confirmName
// must be the server's name, as the user typed it.
export const deleteGuild = (guildID: string, confirmName: string) =>
  sendJSON<void>('DELETE', `/guilds/${encodeURIComponent(guildID)}`, { confirm_name: confirmName })

// roles lists the server's Discord roles, highest first, for the settings' pickers.
export const roles = (guildID: string) => getJSON<Role[]>(`/guilds/${encodeURIComponent(guildID)}/roles`)

// A text or announcement channel of the server, in the order of Discord's channel list.
export interface Channel {
  id: string
  name: string
  category: string // empty when it isn't in a category
  position: number
  can_post: boolean // whether the bot may post the kudos card there
}

// channels lists the server's channels, in Discord's order, for the kudos channel picker.
export const channels = (guildID: string) => getJSON<Channel[]>(`/guilds/${encodeURIComponent(guildID)}/channels`)

export const access = (guildID: string) => getJSON<Access>(`/guilds/${encodeURIComponent(guildID)}/access`)

export const setAccess = (guildID: string, adminID: string, grants: Grant[]) =>
  sendJSON<Access>('PUT', `/guilds/${encodeURIComponent(guildID)}/access`, { admin_discord_user_id: adminID, grants })

// download fetches an export and hands it to the browser as a file, named as the API says.
async function download(path: string, fallbackName: string): Promise<void> {
  if (isDemo) throw new DemoReadOnly()
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

// setMySurvey resumes (or pauses) the survey for the logged-in user in one server, like
// /happyx resume in Discord.
export const setMySurvey = (guildID: string, active: boolean) =>
  sendJSON<{ active: boolean }>('PUT', `/guilds/${encodeURIComponent(guildID)}/me/survey`, { active })

export const answerGame = (guildID: string, answer: string) =>
  sendJSON<{ week: string; answer: string }>('PUT', `/guilds/${encodeURIComponent(guildID)}/game/answer`, { answer })

export const proposeQuestion = (guildID: string, question: string) =>
  sendJSON<{ week: string; question: string }>('PUT', `/guilds/${encodeURIComponent(guildID)}/game/proposal`, { question })

export const guessGame = (guildID: string, guesses: Record<string, string>) =>
  sendJSON<void>('PUT', `/guilds/${encodeURIComponent(guildID)}/game/guesses`, { guesses })

export async function logout(): Promise<void> {
  if (isDemo) return
  await fetch(`${base}/auth/logout`, { method: 'POST', credentials: 'same-origin' })
}

// --- Team canvas ---

// A stroke of the team canvas. Its points are px from the anchor, flat (x0, y0, x1, y1…); the
// anchor is a fraction of the screen's width and height.
export interface CanvasStroke {
  id: string
  drawing_id: string
  color: number // 0 to 4, see canvas.ts
  anchor: [number, number]
  points: number[]
  mine: boolean
  // Who drew it; only for those who may change the server's settings.
  author?: Member
  created_at: string
}

export interface Canvas {
  enabled: boolean
  version: number
  can_moderate: boolean
  max_strokes: number
  strokes: CanvasStroke[]
}

export type NewCanvasStroke = Pick<CanvasStroke, 'drawing_id' | 'color' | 'anchor' | 'points'>

const canvasPath = (guildID: string) => `/guilds/${encodeURIComponent(guildID)}/canvas`

// canvas reads the server's canvas. With the ETag of the last read it returns null when nothing
// changed, which is what the page's regular check gets most of the time.
export async function canvas(guildID: string, etag = ''): Promise<{ canvas: Canvas; etag: string } | null> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (etag) headers['If-None-Match'] = etag
  const res = await fetch(base + canvasPath(guildID), { credentials: 'same-origin', headers })
  if (res.status === 304) return null
  if (res.status === 401) throw new Unauthorized()
  if (res.status === 404) throw new NotFound()
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return { canvas: (await res.json()) as Canvas, etag: res.headers.get('ETag') ?? '' }
}

export const addCanvasStroke = (guildID: string, stroke: NewCanvasStroke) =>
  sendJSON<{ stroke: CanvasStroke; version: number }>('POST', `${canvasPath(guildID)}/strokes`, stroke)

export const deleteCanvasDrawing = (guildID: string, drawingID: string) =>
  sendJSON<{ version: number }>('DELETE', `${canvasPath(guildID)}/drawings/${encodeURIComponent(drawingID)}`, {})

export const clearCanvas = (guildID: string) => sendJSON<{ version: number }>('DELETE', canvasPath(guildID), {})

// --- Vacations ---

// A vacation: no survey or game from `from` to `to`, both included (YYYY-MM-DD). The person's own
// applies in every server and has no discord_guild_id; one an admin set has the server's.
export interface Vacation {
  from: string
  to: string
  discord_guild_id?: string
  guild_name?: string
  set_by_admin: boolean
}

export interface MyVacations {
  own: Vacation | null
  set_by_admins: Vacation[]
}

// A member's vacation as the server's admins see it. set_here is false for the member's own,
// which admins can see but not change.
export interface GuildVacation {
  discord_user_id: string
  username: string
  from: string
  to: string
  set_here: boolean
}

export interface GuildVacations {
  vacations: GuildVacation[]
  members: Member[]
}

export const myVacations = () => getJSON<MyVacations>('/me/vacations')

export const setMyVacation = (from: string, to: string) => sendJSON<Vacation>('PUT', '/me/vacation', { from, to })

export const deleteMyVacation = () => sendJSON<void>('DELETE', '/me/vacation', {})

// deleteVacationSetByAdmin removes the vacation an admin set for the user in that server.
export const deleteVacationSetByAdmin = (guildID: string) =>
  sendJSON<void>('DELETE', `/guilds/${encodeURIComponent(guildID)}/me/vacation`, {})

export const guildVacations = (guildID: string) => getJSON<GuildVacations>(`/guilds/${encodeURIComponent(guildID)}/vacations`)

export const setGuildVacation = (guildID: string, userID: string, from: string, to: string) =>
  sendJSON<GuildVacation>('PUT', `/guilds/${encodeURIComponent(guildID)}/vacations/${encodeURIComponent(userID)}`, { from, to })

export const deleteGuildVacation = (guildID: string, userID: string) =>
  sendJSON<void>('DELETE', `/guilds/${encodeURIComponent(guildID)}/vacations/${encodeURIComponent(userID)}`, {})
