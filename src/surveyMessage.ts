// The admin's own text for the daily survey: the variables it may use, the same checks as the
// API, and a preview built like the bot builds the DM (HappyX.Bot internal/bot/messages.go).

import { h } from './dom'
import type { Key } from './i18n'

// Same limit and variables as the API (HappyX.Api internal/domain/message.go).
export const maxSurveyMessage = 500

export const surveyVars: { name: string; help: Key }[] = [
  { name: 'user.name', help: 'survey.var.user.name' },
  { name: 'user.mention', help: 'survey.var.user.mention' },
  { name: 'user.streak', help: 'survey.var.user.streak' },
  { name: 'guild.name', help: 'survey.var.guild.name' },
  { name: 'date', help: 'survey.var.date' },
  { name: 'weekday', help: 'survey.var.weekday' },
]

const placeholder = /\{\{\s*([^{}]*?)\s*\}\}/g

export interface Problems {
  tooLong: boolean
  unknown: string[] // variables that don't exist, as written
  unclosed: boolean // a {{ or }} without its pair
}

export function check(text: string): Problems {
  const unknown = [...text.matchAll(placeholder)].map((m) => m[1]).filter((v) => !surveyVars.some((s) => s.name === v))
  const rest = text.replace(placeholder, '')
  return { tooLong: [...text].length > maxSurveyMessage, unknown: [...new Set(unknown)], unclosed: rest.includes('{{') || rest.includes('}}') }
}

export const isValid = (p: Problems) => !p.tooLong && !p.unknown.length && !p.unclosed

// What the bot says around the admin's text, in each language it speaks (its locales/*.json).
interface BotStrings {
  question: string
  anonymous: string
  named: string
  stop: string
  date: string
  moods: string[]
  weekdays: string[] // Sunday first
  months: string[]
}

export const botStrings: Record<string, BotStrings> = {
  ca: {
    question: "👋 Com et trobes avui? (**{guild}**)",
    anonymous: "La teva resposta és **anònima**: l'administrador només veu els resultats agregats.",
    named: "En aquest servidor l'administrador **pot veure qui respon**.",
    stop: "No m'ho tornis a preguntar",
    date: "{weekday}, {day} {month}",
    moods: ["Molt malament", "Malament", "Normal", "Bé", "Genial"],
    weekdays: ["diumenge", "dilluns", "dimarts", "dimecres", "dijous", "divendres", "dissabte"],
    months: ["de gener", "de febrer", "de març", "d'abril", "de maig", "de juny", "de juliol", "d'agost", "de setembre", "d'octubre", "de novembre", "de desembre"],
  },
  de: {
    question: "👋 Wie geht es dir heute? (**{guild}**)",
    anonymous: "Deine Antwort ist **anonym**: Der Admin sieht nur die Gesamtergebnisse.",
    named: "Auf diesem Server **kann der Admin sehen, wer antwortet**.",
    stop: "Nicht mehr fragen",
    date: "{weekday}, {day}. {month}",
    moods: ["Sehr schlecht", "Schlecht", "Okay", "Gut", "Super"],
    weekdays: ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"],
    months: ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"],
  },
  en: {
    question: "👋 How are you feeling today? (**{guild}**)",
    anonymous: "Your answer is **anonymous**: the admin only sees the overall results.",
    named: "In this server the admin **can see who answers**.",
    stop: "Don't ask me again",
    date: "{weekday}, {month} {day}",
    moods: ["Awful", "Bad", "Okay", "Good", "Great"],
    weekdays: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    months: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  },
  es: {
    question: "👋 ¿Cómo te encuentras hoy? (**{guild}**)",
    anonymous: "Tu respuesta es **anónima**: el administrador solo ve los resultados agregados.",
    named: "En este servidor el administrador **puede ver quién responde**.",
    stop: "No volver a preguntar",
    date: "{weekday}, {day} de {month}",
    moods: ["Muy mal", "Mal", "Normal", "Bien", "Genial"],
    weekdays: ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"],
    months: ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"],
  },
  fr: {
    question: "👋 Comment te sens-tu aujourd'hui ? (**{guild}**)",
    anonymous: "Ta réponse est **anonyme** : l'admin ne voit que les résultats globaux.",
    named: "Sur ce serveur, l'admin **peut voir qui répond**.",
    stop: "Ne plus me demander",
    date: "{weekday} {day} {month}",
    moods: ["Très mal", "Mal", "Bof", "Bien", "Super"],
    weekdays: ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"],
    months: ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"],
  },
  it: {
    question: "👋 Come ti senti oggi? (**{guild}**)",
    anonymous: "La tua risposta è **anonima**: l'admin vede solo i risultati complessivi.",
    named: "In questo server l'admin **può vedere chi risponde**.",
    stop: "Non chiedermelo più",
    date: "{weekday} {day} {month}",
    moods: ["Malissimo", "Male", "Così così", "Bene", "Benissimo"],
    weekdays: ["domenica", "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato"],
    months: ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"],
  },
  'pt-BR': {
    question: "👋 Como você está hoje? (**{guild}**)",
    anonymous: "Sua resposta é **anônima**: o admin só vê os resultados gerais.",
    named: "Neste servidor o admin **pode ver quem responde**.",
    stop: "Não perguntar mais",
    date: "{weekday}, {day} de {month}",
    moods: ["Muito mal", "Mal", "Normal", "Bem", "Ótimo"],
    weekdays: ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"],
    months: ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"],
  },}

export const moodEmojis = ['😞', '😕', '😐', '🙂', '🤩']

const stringsFor = (language: string) => botStrings[language] ?? botStrings.en

const fillIn = (s: string, vars: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m))

// longDate is how the bot writes {{date}}, e.g. «viernes, 24 de octubre».
export function longDate(language: string, day: Date): string {
  const b = stringsFor(language)
  return fillIn(b.date, { weekday: b.weekdays[day.getDay()], day: day.getDate(), month: b.months[day.getMonth()] })
}

export interface Recipient {
  id: string
  name: string
  streak: number
}

// fill puts the person's values in the variables, like the bot does. Unknown ones stay as written.
export function fill(text: string, guildName: string, language: string, to: Recipient, day: Date): string {
  const vars: Record<string, string> = {
    'user.name': to.name,
    'user.mention': `<@${to.id}>`,
    'user.streak': String(to.streak),
    'guild.name': guildName,
    date: longDate(language, day),
    weekday: stringsFor(language).weekdays[day.getDay()],
  }
  return text.replace(placeholder, (m, name: string) => vars[name] ?? m)
}

// surveyContent is the whole DM text: the admin's message (or the default) and the notice the
// service always adds.
export function surveyContent(text: string, guildName: string, language: string, anonymous: boolean, to: Recipient, day: Date): string {
  const b = stringsFor(language)
  const question = text.trim() === '' ? fillIn(b.question, { guild: guildName }) : fill(text.trim(), guildName, language, to, day)
  return `${question}\n${anonymous ? b.anonymous : b.named}`
}

// Discord markdown the preview understands. Nesting isn't needed for a preview.
const inline = /(\*\*[^*]+\*\*|__[^_]+__|~~[^~]+~~|`[^`]+`|\*[^*\s][^*]*\*|_[^_\s][^_]*_|<@\d+>)/

// markdown turns Discord text into nodes, never HTML, so nothing the admin types becomes markup.
export function markdown(text: string, mentionName: (id: string) => string): Node[] {
  const out: Node[] = []
  text.split('\n').forEach((line, i) => {
    if (i > 0) out.push(h('br'))
    for (const part of line.split(inline)) {
      if (!part) continue
      const wrap = (tag: 'strong' | 'em' | 'u' | 's' | 'code', n: number) => out.push(h(tag, {}, part.slice(n, -n)))
      if (part.startsWith('**') && part.endsWith('**') && part.length > 4) wrap('strong', 2)
      else if (part.startsWith('__') && part.endsWith('__') && part.length > 4) wrap('u', 2)
      else if (part.startsWith('~~') && part.endsWith('~~') && part.length > 4) wrap('s', 2)
      else if (/^`.+`$/.test(part)) wrap('code', 1)
      else if (/^\*.+\*$/.test(part) || /^_.+_$/.test(part)) wrap('em', 1)
      else if (/^<@\d+>$/.test(part)) out.push(h('span', { class: 'dc-mention' }, `@${mentionName(part.slice(2, -1))}`))
      else out.push(document.createTextNode(part))
    }
  })
  return out
}
