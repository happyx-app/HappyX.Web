import { describe, expect, it } from 'vitest'
import type { MyGuildMoods } from './api'
import { evolutionRange, latestMessages, seriesColor, toPoints } from './evolution'

const guild = (id: string, entries: MyGuildMoods['entries']): MyGuildMoods => ({
  discord_guild_id: id, name: id, timezone: 'UTC', responses: entries.length, average: 0, streak: 0, entries,
})

describe('evolutionRange', () => {
  it.each([
    ['week', '2026-10-17'],
    ['month', '2026-09-24'],
    ['year', '2025-10-24'],
  ] as const)('%s', (period, from) => {
    expect(evolutionRange(period, '2026-10-23')).toEqual({ from, to: '2026-10-23' })
  })
})

describe('toPoints', () => {
  const a = guild('a', [
    { day: '2026-10-19', mood: 4 },
    { day: '2026-10-21', mood: 2, message: 'meh' },
    { day: '2026-10-23', mood: 5 },
  ])
  const b = guild('b', [{ day: '2026-10-21', mood: 3 }])

  it('has one point per day, with gaps', () => {
    const p = toPoints([a, b], { from: '2026-10-19', to: '2026-10-23' }, 'week')
    expect(p.xs).toEqual(['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23'])
    expect(p.values.get('a')).toEqual([4, null, 2, null, 5])
    expect(p.values.get('b')).toEqual([null, null, 3, null, null])
  })

  it('groups a year by week (Monday to Sunday)', () => {
    const p = toPoints([a], { from: '2026-10-08', to: '2026-10-23' }, 'year')
    expect(p.byWeek).toBe(true)
    expect(p.xs).toEqual(['2026-10-05', '2026-10-12', '2026-10-19'])
    expect(p.values.get('a')).toEqual([null, null, 11 / 3])
    expect(p.counts.get('a')).toEqual([0, 0, 3])
  })
})

it('latestMessages returns the newest comments first', () => {
  const g = guild('g', [
    { day: '2026-10-01', mood: 3, message: 'uno' },
    { day: '2026-10-02', mood: 3 },
    { day: '2026-10-03', mood: 3, message: 'dos' },
    { day: '2026-10-04', mood: 3, message: 'tres' },
    { day: '2026-10-05', mood: 3, message: 'cuatro' },
  ])
  expect(latestMessages(g).map((e) => e.message)).toEqual(['cuatro', 'tres', 'dos'])
})

it('gives each of the first 8 servers its own colour', () => {
  expect(seriesColor(0)).toBe('var(--cat-1)')
  expect(seriesColor(7)).toBe('var(--cat-8)')
  expect(seriesColor(8)).toBeNull()
})
