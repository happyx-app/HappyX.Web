import { expect, it } from 'vitest'
import { policyFor } from './policy'

it('says the same in every language', () => {
  const es = policyFor('es')
  const en = policyFor('en')
  expect(es.sections.length).toBe(en.sections.length)
  es.sections.forEach((s, i) => {
    const shape = (x: typeof s) => x.body.map((b) => ('p' in b ? 'p' : `ul${b.ul.length}`))
    expect(shape(s), s.title).toEqual(shape(en.sections[i]))
  })
})
