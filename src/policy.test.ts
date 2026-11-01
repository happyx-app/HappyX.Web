import { expect, it } from 'vitest'
import { controller, policyFor } from './policy'

it('says the same in every language', () => {
  const es = policyFor('es')
  const en = policyFor('en')
  expect(es.sections.length).toBe(en.sections.length)
  es.sections.forEach((s, i) => {
    const shape = (x: typeof s) => x.body.map((b) => ('p' in b ? 'p' : `ul${b.ul.length}`))
    expect(shape(s), s.title).toEqual(shape(en.sections[i]))
  })
})

it('names the controller and their email', () => {
  for (const code of ['es', 'en']) {
    const text = JSON.stringify(policyFor(code).sections[0])
    expect(text).toContain(controller.name)
    expect(text).toContain(`mailto:${controller.email}`)
  }
})
