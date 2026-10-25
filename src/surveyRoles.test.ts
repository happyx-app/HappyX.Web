import { expect, it } from 'vitest'
import type { Guild } from './api'
import { needsRoles, sameSurveyRoles, surveyRolesOf, toSave } from './surveyRoles'

const g = { discord_guild_id: '1', name: 'x', anonymous: true, timezone: 'UTC', language: 'en', report_frequency: 'weekly', survey_hour: 13, games_enabled: false, active: true } as Guild

it('treats a missing setting as everyone', () => {
  expect(surveyRolesOf(g)).toEqual({ mode: 'all', role_ids: [] })
})

it('leaves out roles deleted in Discord', () => {
  const roles = [{ id: 'a', name: 'Staff', color: 0, position: 1 }]
  expect(surveyRolesOf({ ...g, survey_roles: { mode: 'except', role_ids: ['a', 'gone'] } }, roles)).toEqual({ mode: 'except', role_ids: ['a'] })
})

it('saves no roles with everyone', () => {
  expect(toSave({ mode: 'all', role_ids: ['a'] })).toEqual({ mode: 'all', role_ids: [] })
  expect(sameSurveyRoles({ mode: 'all', role_ids: [] }, { mode: 'all', role_ids: ['a'] })).toBe(true)
  expect(sameSurveyRoles({ mode: 'except', role_ids: ['a'] }, { mode: 'only', role_ids: ['a'] })).toBe(false)
})

it('needs a role to leave out or to include', () => {
  expect(needsRoles({ mode: 'all', role_ids: [] })).toBe(false)
  expect(needsRoles({ mode: 'except', role_ids: [] })).toBe(true)
  expect(needsRoles({ mode: 'only', role_ids: ['a'] })).toBe(false)
})
