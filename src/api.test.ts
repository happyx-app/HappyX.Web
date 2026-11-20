import { expect, it } from 'vitest'
import { adminName, avatarURL, isDemoPath, kudosGiver, kudosReceiver, shownName, type Guild, type Kudos } from './api'

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

it('names people as their server shows them, or by username with an older API', () => {
  expect(shownName({ username: 'david.delcastillo_travelgate', display_name: 'David' })).toBe('David')
  expect(shownName({ username: 'david.delcastillo_travelgate' })).toBe('david.delcastillo_travelgate')
  // Two Davids in a server: the API adds the username, and it shows as is.
  expect(shownName({ username: 'david.moreno', display_name: 'David (david.moreno)' })).toBe('David (david.moreno)')
  expect(shownName({ username: '', display_name: '' })).toBe('')
  expect(shownName(undefined)).toBe('')
  const k: Kudos = { day: '2026-11-20', from_username: 'ana_corp', from_display_name: 'Ana', to_username: 'bea_corp', message: 'gracias' }
  expect([shownName(kudosGiver(k)), shownName(kudosReceiver(k))]).toEqual(['Ana', 'bea_corp'])
  const g = { admin_username: 'joan_corp', admin_display_name: 'Joan' } as Guild
  expect(adminName(g)).toBe('Joan')
  expect(adminName({} as Guild)).toBe('')
})

