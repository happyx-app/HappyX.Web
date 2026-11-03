import { expect, it } from 'vitest'
import { trendSummary } from './charts'

it('sums up the trend chart for screen readers', () => {
  const days = [
    { day: '2026-10-05', responses: 4, average: 3 },
    { day: '2026-10-06', responses: 0, average: 0 },
    { day: '2026-10-07', responses: 1, average: 5 },
  ]
  expect(trendSummary(days)).toBe('Average mood per day, from October 5 to October 7: between 3.0 and 5.0, average 3.4. Use «Show as table» for the data.')
  expect(trendSummary([{ day: '2026-10-05', responses: 0, average: 0 }])).toBe('Average mood per day')
})
