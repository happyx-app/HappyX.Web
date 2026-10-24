import { expect, it } from 'vitest'
import { confirmedUser } from './privacy'

it('asks for the exact username before erasing', () => {
  const u = { discord_user_id: '1', username: 'Mia' }
  expect(confirmedUser(u, 'Mia')).toBe(true)
  expect(confirmedUser(u, ' Mia ')).toBe(true)
  expect(confirmedUser(u, 'mia')).toBe(false)
  expect(confirmedUser(u, '')).toBe(false)
  expect(confirmedUser({ ...u, username: ' ' }, ' ')).toBe(false)
})
