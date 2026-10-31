import { expect, it } from 'vitest'
import { avatarURL, isDemoPath } from './api'

it("uses the user's picture, or Discord's default one", () => {
  expect(avatarURL('80351110224678912', 'abc', 128)).toBe('https://cdn.discordapp.com/avatars/80351110224678912/abc.png?size=128')
  expect(avatarURL('80351110224678912', undefined)).toBe('https://cdn.discordapp.com/embed/avatars/5.png')
  expect(avatarURL('not-an-id', '')).toBe('https://cdn.discordapp.com/embed/avatars/0.png')
})

it('is the demo only at /demo', () => {
  expect(isDemoPath('/demo')).toBe(true)
  expect(isDemoPath('/demo/')).toBe(true)
  expect(isDemoPath('/')).toBe(false)
  expect(isDemoPath('/demos')).toBe(false)
})
