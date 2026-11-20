import { describe, expect, it } from 'vitest'
import { trendSummary, weekStarts, weeklyStats, placeEvents } from './charts'

it('sums up the trend chart for screen readers', () => {
  const days = [
    { day: '2026-10-05', responses: 4, average: 3 },
    { day: '2026-10-06', responses: 0, average: 0 },
    { day: '2026-10-07', responses: 1, average: 5 },
  ]
  expect(trendSummary(days)).toBe('Average mood per day, from October 5 to October 7: between 3.0 and 5.0, average 3.4. Use «Show as table» for the data.')
  expect(trendSummary([{ day: '2026-10-05', responses: 0, average: 0 }])).toBe('Average mood per day')
})

it('finds where each week starts, with or without weekends', () => {
  // Thu 8 Oct 2026 to Tue 13 Oct, every day: the week starts on Monday 12.
  expect(weekStarts(['2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11', '2026-10-12', '2026-10-13'])).toEqual([4])
  // Working days only: Friday 9 is followed by Monday 12.
  expect(weekStarts(['2026-10-08', '2026-10-09', '2026-10-12', '2026-10-13'])).toEqual([2])
  // A whole week missing still counts as a new week, even on the same weekday.
  expect(weekStarts(['2026-10-07', '2026-10-14'])).toEqual([1])
})

it('adds days up by week, weighting each day by its answers', () => {
  const weeks = weeklyStats([
    { day: '2026-10-08', responses: 4, average: 3, recipients: 5 }, // Thursday
    { day: '2026-10-09', responses: 0, average: 0, recipients: 5 },
    { day: '2026-10-12', responses: 1, average: 5, recipients: 5 }, // Monday
    { day: '2026-10-13', responses: 3, average: 1 },
  ])
  expect(weeks).toEqual([
    { day: '2026-10-05', responses: 4, average: 3, recipients: 10, counted: 4, withheld: false },
    { day: '2026-10-12', responses: 4, average: 2, recipients: undefined, counted: 4, withheld: false },
  ])
  expect(trendSummary(weeks, true)).toBe('Average mood per week, from October 5 to October 12: between 2.0 and 3.0, average 2.5. Use «Show as table» for the data.')
})

it('leaves withheld days out of averages, but not out of the answers', () => {
  const weeks = weeklyStats([
    { day: '2026-10-12', responses: 3, average: 4 },
    { day: '2026-10-13', responses: 2, average: 0, withheld: true },
    { day: '2026-10-19', responses: 1, average: 0, withheld: true },
  ])
  expect(weeks.map((w) => [w.responses, w.counted, w.average, w.withheld])).toEqual([
    [5, 3, 4, false],
    [1, 0, 0, true],
  ])
  const days = [
    { day: '2026-10-12', responses: 3, average: 4 },
    { day: '2026-10-13', responses: 2, average: 0, withheld: true },
  ]
  expect(trendSummary(days)).toContain('between 4.0 and 4.0, average 4.0')
})

it('marks the last week as partial when the period ends before its Sunday', () => {
  const days = [{ day: '2026-10-12', responses: 2, average: 4 }]
  expect(weeklyStats(days, '2026-10-14')[0].partial).toBe(true)
  expect(weeklyStats(days, '2026-10-18')[0].partial).toBeUndefined()
})

describe('placeEvents', () => {
  const xs = ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-09', '2026-11-10']
  const day = (i: number) => ({ from: xs[i], to: xs[i] })
  const ev = (id: string, from: string, to: string) => ({ id, from, to, title: id })

  it('covers the points an event spans and puts overlapping ones on separate rows', () => {
    const placed = placeEvents(xs, [ev('b', '2026-11-04', '2026-11-05'), ev('a', '2026-11-03', '2026-11-04'), ev('c', '2026-11-09', '2026-11-09')], day)
    expect(placed.map((p) => [p.e.id, p.lo, p.hi, p.row])).toEqual([
      ['a', 1, 2, 0],
      ['b', 2, 3, 1],
      ['c', 5, 5, 0],
    ])
  })

  it('places an event on a day without points between its neighbours', () => {
    const [p] = placeEvents(xs, [ev('sat', '2026-11-07', '2026-11-07')], day)
    expect([p.lo, p.hi]).toEqual([5, 4])
  })

  it('leaves out events outside the points', () => {
    expect(placeEvents(xs, [ev('old', '2026-10-01', '2026-10-02'), ev('later', '2026-11-20', '2026-11-21')], day)).toEqual([])
  })
})
