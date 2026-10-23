import { expect, it } from 'vitest'
import { changes, type Settings, weekdayName } from './settings'

const base: Settings = { anonymous: true, timezone: 'Europe/Madrid', language: 'en', survey_hour: 13, report_frequency: 'weekly', working_days: [1, 2, 3, 4, 5], games_enabled: false }

it('sends only what changed', () => {
  expect(changes(base, base)).toEqual({})
  expect(changes(base, { ...base, survey_hour: 9, anonymous: false })).toEqual({ survey_hour: 9, anonymous: false })
  expect(changes(base, { ...base, survey_hour: 0 })).toEqual({ survey_hour: 0 })
  expect(changes(base, { ...base, games_enabled: true })).toEqual({ games_enabled: true })
})

it('compares working days by value', () => {
  expect(changes(base, { ...base, working_days: [1, 2, 3, 4, 5] })).toEqual({})
  expect(changes(base, { ...base, working_days: [1, 2, 3, 4, 5, 6] })).toEqual({ working_days: [1, 2, 3, 4, 5, 6] })
})

it('names ISO days', () => {
  expect([1, 7].map((d) => weekdayName(d))).toEqual(['Mon', 'Sun'])
})
