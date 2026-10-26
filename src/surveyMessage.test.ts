import { expect, it } from 'vitest'
import { check, fill, isValid, longDate, maxSurveyMessage, surveyCard } from './surveyMessage'

const ana = { id: '2', name: 'Ana', streak: 5 }
const friday = new Date(2026, 9, 23)

it('accepts the same messages as the API', () => {
  for (const ok of ['', '👋 Hola {{user.name}}! ({{ guild.name }})', '{{user.mention}} {{user.streak}} {{date}} {{weekday}}', 'é'.repeat(maxSurveyMessage)]) {
    expect(isValid(check(ok)), ok).toBe(true)
  }
  expect(check('Hola {{user.nmae}} y {{user.guild}} y {{user.nmae}}').unknown).toEqual(['user.nmae', 'user.guild'])
  expect(check('Hola {{user.name').unclosed).toBe(true)
  expect(check('Hola user.name}}').unclosed).toBe(true)
  expect(check('a'.repeat(maxSurveyMessage + 1)).tooLong).toBe(true)
})

it('fills the variables like the bot', () => {
  expect(fill('{{user.name}} {{ user.mention }} {{user.streak}} {{guild.name}} {{weekday}} | {{date}} {{nope}}', 'Equipo', 'es', ana, friday)).toBe(
    'Ana <@2> 5 Equipo viernes | viernes, 23 de octubre {{nope}}',
  )
  expect(longDate('en', friday)).toBe('Friday, October 23')
  expect(longDate('ca', friday)).toBe("divendres, 23 d'octubre")
  expect(longDate('xx', friday)).toBe('Friday, October 23')
})

it('builds the card like the bot, always with the day and the anonymity notice', () => {
  expect(surveyCard('  ', 'Equipo', 'es', true, ana, friday)).toEqual({
    author: 'Equipo · Encuesta diaria',
    greeting: '👋 ¡Hola, Ana!',
    text: '¿Cómo te encuentras hoy?',
    fields: [
      { name: '📅 Hoy', value: 'viernes, 23 de octubre' },
      { name: '🔥 Racha', value: '5 días' },
    ],
    footer: '🔒 Tu respuesta es anónima: el administrador solo ve los resultados agregados.',
  })
  const own = surveyCard('Hola {{user.name}}', 'Equipo', 'es', false, { ...ana, streak: 1 }, friday)
  expect(own.greeting).toBeUndefined()
  expect(own.text).toBe('Hola Ana')
  expect(own.fields[1].value).toBe('1 día')
  expect(own.footer).toBe('👁 En este servidor el administrador puede ver quién responde.')
  expect(surveyCard('', 'Equipo', 'es', true, { ...ana, streak: 0 }, friday).fields).toHaveLength(1)
})
