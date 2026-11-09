import { expect, it } from 'vitest'
import { trendSummary, weekStarts, weeklyStats } from './charts'

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
    { day: '2026-10-05', responses: 4, average: 3, recipients: 10 },
    { day: '2026-10-12', responses: 4, average: 2, recipients: undefined },
  ])
  expect(trendSummary(weeks, true)).toBe('Average mood per week, from October 5 to October 12: between 2.0 and 3.0, average 2.5. Use «Show as table» for the data.')
})
