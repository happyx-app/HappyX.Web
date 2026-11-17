import { describe, expect, it } from 'vitest'
import type { MyGuildMoods } from './api'
import { hasYearData, monthStarts, toYear } from './yearGrid'

const guild = (o: Partial<MyGuildMoods> = {}): MyGuildMoods => ({ discord_guild_id: 'g1', name: 'A', timezone: 'Europe/Madrid', responses: 0, average: 0, streak: 0, entries: [], survey_days: [], vacations: [], ...o })

describe('toYear', () => {
  // 2026-11-02 is a Monday.
  const range = { from: '2026-11-04', to: '2026-11-12' }
  it('puts days in Monday-first weeks and leaves the edges empty', () => {
    const y = toYear([guild()], range)
    expect(y.weeks).toHaveLength(2)
    expect(y.weeks[0][0]).toBeNull()
    expect(y.weeks[0][2]!.day).toBe('2026-11-04')
    expect(y.weeks[1][3]!.day).toBe('2026-11-12')
    expect(y.weeks[1][4]).toBeNull()
  })
  it('tells answered, missed, vacation and no-survey days apart', () => {
    const g = guild({ entries: [{ day: '2026-11-04', mood: 4 }], survey_days: ['2026-11-04', '2026-11-05', '2026-11-09'], vacations: [{ from: '2026-11-07', to: '2026-11-10' }] })
    const y = toYear([g], range)
    expect(y.weeks[0][2]).toMatchObject({ kind: 'mood', mood: 4 })
    expect(y.weeks[0][3]!.kind).toBe('missed')
    expect(y.weeks[0][5]!.kind).toBe('none')
    expect(y.weeks[1][0]!.kind).toBe('vacation')
    expect(y.weeks[0][5]!.kind).toBe('none') // a Saturday in the vacation, without a survey
    expect(y.weeks[1][1]!.kind).toBe('none')
  })
  it('counts an answer in any server, and a missed survey over a vacation elsewhere', () => {
    const a = guild({ entries: [{ day: '2026-11-04', mood: 2 }], survey_days: ['2026-11-04', '2026-11-05'] })
    const b = guild({ discord_guild_id: 'g2', entries: [{ day: '2026-11-04', mood: 4 }], survey_days: ['2026-11-04', '2026-11-05'], vacations: [{ from: '2026-11-05', to: '2026-11-05' }] })
    const y = toYear([a, b], range)
    expect(y.weeks[0][2]).toMatchObject({ kind: 'mood', mood: 3 })
    expect(y.weeks[0][3]!.kind).toBe('missed')
  })
})

it('needs the survey days and vacations from the API', () => {
  expect(hasYearData([guild()])).toBe(true)
  expect(hasYearData([guild({ survey_days: undefined })])).toBe(false)
})

it('labels the weeks that start a month, without crowding the first one', () => {
  const y = toYear([guild()], { from: '2026-09-28', to: '2026-11-12' })
  expect(monthStarts(y).map((m) => m.month)).toEqual(['2026-10', '2026-11'])
  const tight = toYear([guild()], { from: '2026-10-20', to: '2026-11-12' })
  expect(monthStarts(tight).map((m) => m.month)).toEqual(['2026-11'])
})

it('marks a day answered in one server and missed in another, and drops empty weekends', () => {
  const a = guild({ entries: [{ day: '2026-11-04', mood: 4 }], survey_days: ['2026-11-04'] })
  const b = guild({ discord_guild_id: 'g2', survey_days: ['2026-11-04', '2026-11-07'] })
  const y = toYear([a, b], { from: '2026-11-02', to: '2026-11-08' })
  expect(y.weeks[0][2]).toMatchObject({ kind: 'mood', partial: true })
  expect(y.rows).toEqual([0, 1, 2, 3, 4, 5])
})

it("doesn't count today as missed, nor a vacation on a day without a survey", () => {
  const g = guild({ survey_days: ['2026-11-05', '2026-11-06'], vacations: [{ from: '2026-11-02', to: '2026-11-04' }] })
  const y = toYear([g], { from: '2026-11-02', to: '2026-11-06' })
  expect(y.weeks[0][2]!.kind).toBe('none')
  expect(y.weeks[0][3]!.kind).toBe('missed')
  expect(y.weeks[0][4]!.kind).toBe('pending')
})
