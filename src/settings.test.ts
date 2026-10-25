import { expect, it } from 'vitest'
import { changes, confirmed, type Settings, settingsOf, weekdayName } from './settings'

const base: Settings = { anonymous: true, timezone: 'Europe/Madrid', language: 'en', survey_hour: 13, report_frequency: 'weekly', report_dm: true, games_enabled: false, working_days: [1, 2, 3, 4, 5], game_roles: { mode: 'all', role_ids: [] } }

it('sends only what changed', () => {
  expect(changes(base, base)).toEqual({})
  expect(changes(base, { ...base, survey_hour: 9, anonymous: false })).toEqual({ survey_hour: 9, anonymous: false })
  expect(changes(base, { ...base, survey_hour: 0 })).toEqual({ survey_hour: 0 })
  expect(changes(base, { ...base, games_enabled: true })).toEqual({ games_enabled: true })
  expect(changes(base, { ...base, report_dm: false })).toEqual({ report_dm: false })
})

it('compares working days by value', () => {
  expect(changes(base, { ...base, working_days: [1, 2, 3, 4, 5] })).toEqual({})
  expect(changes(base, { ...base, working_days: [1, 2, 3, 4, 5, 6] })).toEqual({ working_days: [1, 2, 3, 4, 5, 6] })
})

it('names ISO days', () => {
  expect([1, 7].map((d) => weekdayName(d))).toEqual(['Mon', 'Sun'])
})

it('asks for the exact server name before deleting', () => {
  const g = { name: 'Equipo A' } as Parameters<typeof confirmed>[0]
  expect(confirmed(g, 'Equipo A')).toBe(true)
  expect(confirmed(g, '  Equipo A ')).toBe(true)
  expect(confirmed(g, 'equipo a')).toBe(false)
  expect(confirmed(g, 'Equipo')).toBe(false)
  expect(confirmed(g, '')).toBe(false)
  expect(confirmed({ name: '  ' } as typeof g, '  ')).toBe(false)
})

it('treats a missing report_dm as on', () => {
  const g = { discord_guild_id: '1', name: 'x', anonymous: true, timezone: 'UTC', language: 'en', report_frequency: 'weekly', survey_hour: 13, games_enabled: false, active: true } as const
  expect(settingsOf(g).report_dm).toBe(true)
  expect(settingsOf({ ...g, report_dm: false }).report_dm).toBe(false)
})

it('sends the game roles only when they change', () => {
  expect(changes(base, { ...base, game_roles: { mode: 'all', role_ids: [] } })).toEqual({})
  expect(changes(base, { ...base, game_roles: { mode: 'except', role_ids: ['4'] } })).toEqual({ game_roles: { mode: 'except', role_ids: ['4'] } })
})
