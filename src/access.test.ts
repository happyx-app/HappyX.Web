import { expect, it } from 'vitest'
import type { Access } from './api'
import { filterOptions, knownGrants, matches, roleColor, sameAccess, type Option } from './access'

const options: Option[] = [
  { kind: 'role', id: '1', label: 'Moderadores', color: 0x3498db },
  { kind: 'user', id: '2', label: 'José' },
  { kind: 'user', id: '3', label: 'marta' },
]

it('finds names ignoring case and accents', () => {
  expect(matches('jose', 'José')).toBe(true)
  expect(matches('  MAR ', 'marta')).toBe(true)
  expect(matches('x', 'marta')).toBe(false)
  expect(filterOptions(options, '').map((o) => o.id)).toEqual(['1', '2', '3'])
  expect(filterOptions(options, 'o').map((o) => o.id)).toEqual(['1', '2'])
})

it('leaves out what is already picked', () => {
  expect(filterOptions(options, '', new Set(['user:2', 'role:1'])).map((o) => o.id)).toEqual(['3'])
})

it('turns role colours into CSS', () => {
  expect(roleColor(0x3498db)).toBe('#3498db')
  expect(roleColor(0xff)).toBe('#0000ff')
  expect(roleColor(0)).toBe('')
})

it('drops grants to people who left the server', () => {
  const a: Access = {
    admin_discord_user_id: '2',
    roles: [{ id: '1', name: 'Mods', color: 0, position: 1 }],
    members: [{ discord_user_id: '2', username: 'José' }],
    grants: [
      { kind: 'role', id: '1', level: 'view' },
      { kind: 'user', id: '9', level: 'manage' },
    ],
  }
  expect(knownGrants(a)).toEqual({ grants: [{ kind: 'role', id: '1', level: 'view' }], dropped: 1 })
})

it('notices any change', () => {
  const s = { admin: '2', grants: [{ kind: 'role' as const, id: '1', level: 'view' as const }] }
  expect(sameAccess(s, { ...s, grants: [...s.grants] })).toBe(true)
  expect(sameAccess(s, { ...s, admin: '3' })).toBe(false)
  expect(sameAccess(s, { ...s, grants: [{ ...s.grants[0], level: 'manage' }] })).toBe(false)
})
