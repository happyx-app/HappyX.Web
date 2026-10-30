import { expect, it } from 'vitest'
import { channelGroups, changes, confirmed, type Settings, settingsOf, weekdayName } from './settings'

const base: Settings = { anonymous: true, timezone: 'Europe/Madrid', language: 'en', survey_hour: 13, report_frequency: 'weekly', report_dm: true, games_enabled: false, kudos_channel_id: '', working_days: [1, 2, 3, 4, 5], game_roles: { mode: 'all', role_ids: [] } }

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

it('treats a missing kudos channel as the command’s channel', () => {
  const g = { discord_guild_id: '1', name: 'x', anonymous: true, timezone: 'UTC', language: 'en', report_frequency: 'weekly', survey_hour: 13, games_enabled: false, active: true } as const
  expect(settingsOf(g).kudos_channel_id).toBe('')
  expect(changes(base, { ...base, kudos_channel_id: '5' })).toEqual({ kudos_channel_id: '5' })
  expect(changes({ ...base, kudos_channel_id: '5' }, base)).toEqual({ kudos_channel_id: '' })
})

it('groups channels by category in Discord’s order', () => {
  const c = (id: string, category: string, position: number) => ({ id, name: id, category, position, can_post: true })
  const groups = channelGroups([c('kudos', 'Team', 3), c('general', '', 0), c('rules', 'Info', 1), c('news', 'Info', 2)])
  expect(groups.map((g) => [g.category, g.channels.map((ch) => ch.id)])).toEqual([
    ['', ['general']],
    ['Info', ['rules', 'news']],
    ['Team', ['kudos']],
  ])
})
