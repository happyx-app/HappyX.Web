import { expect, it } from 'vitest'
import { policyFor } from './policy'
import { termsFor } from './terms'

it('says the same in every language', () => {
  const es = policyFor('es')
  const en = policyFor('en')
  expect(es.sections.length).toBe(en.sections.length)
  es.sections.forEach((s, i) => {
    const shape = (x: typeof s) => x.body.map((b) => ('p' in b ? 'p' : `ul${b.ul.length}`))
    expect(shape(s), s.title).toEqual(shape(en.sections[i]))
  })
})

it('the terms say the same in every language', () => {
  const es = termsFor('es')
  const en = termsFor('en')
  expect(es.sections.length).toBe(en.sections.length)
  es.sections.forEach((s, i) => {
    const shape = (x: typeof s) => x.body.map((b) => ('p' in b ? `p${b.p.length}` : `ul${b.ul.length}`))
    expect(shape(s), s.title).toEqual(shape(en.sections[i]))
  })
})
