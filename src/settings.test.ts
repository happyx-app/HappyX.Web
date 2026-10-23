import { expect, it } from 'vitest'
import { changes, type Settings } from './settings'

const base: Settings = { anonymous: true, timezone: 'Europe/Madrid', language: 'en', survey_hour: 13, report_frequency: 'weekly' }

it('sends only what changed', () => {
  expect(changes(base, base)).toEqual({})
  expect(changes(base, { ...base, survey_hour: 9, anonymous: false })).toEqual({ survey_hour: 9, anonymous: false })
  expect(changes(base, { ...base, survey_hour: 0 })).toEqual({ survey_hour: 0 })
})
