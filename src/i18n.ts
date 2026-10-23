// UI strings. English is the default; the language picker in the page chooses another and remembers it.
// Adding a language = one more entry in `messages` with the same keys as `en`.

const en = {
  'login.title': "Your Discord server's mood, day by day",
  'login.body': 'HappyX asks your server how everyone feels each day. Log in with Discord to see the results.',
  'login.button': 'Log in with Discord',
  'login.failed': "We couldn't log you in. Try again.",
  'login.privacy': 'We only read your Discord name and which servers you manage.',
  'nav.logout': 'Log out',
  'nav.servers': 'Servers',
  'guilds.title': 'Your servers',
  'guilds.empty.title': 'No servers yet',
  'guilds.empty.body':
    "You'll see a server here when HappyX is in it and you are its owner, an Administrator, or the admin who gets the reports.",
  'guilds.inactive': 'Bot removed',
  'guilds.anonymous': 'Anonymous',
  'guilds.named': 'Names visible',
  'guilds.weekly': 'Weekly reports',
  'guilds.monthly': 'Monthly reports',
  'guild.notFound': "This server doesn't exist or you can't see it.",
  'period.label': 'Period',
  'period.last-30': 'Last 30 days',
  'period.last-90': 'Last 90 days',
  'period.this-week': 'This week',
  'period.last-week': 'Last week',
  'period.this-month': 'This month',
  'period.last-month': 'Last month',
  'stat.average': 'Average mood',
  'stat.responses': 'Answers',
  'stat.respondents': 'People who answered',
  'chart.trend': 'Daily average mood',
  'chart.trend.desc': 'Average of the answers each day, from 1 (awful) to 5 (great). Gaps are days without answers; days off only appear if someone answered.',
  'chart.distribution': 'Answers by mood',
  'chart.table.show': 'Show as table',
  'chart.table.hide': 'Hide table',
  'chart.day': 'Day',
  'chart.noAnswers': 'No answers',
  'chart.answers': '{n} answers',
  'chart.answer': '1 answer',
  'messages.title': 'Messages',
  'messages.anonymous': 'Anonymous: messages are shown without their author.',
  'messages.earlier_anonymous': 'Messages written while the server was anonymous are shown without their author.',
  'messages.empty': 'Nobody left a message in this period.',
  'empty.title': 'No answers in this period',
  'empty.body': 'Pick a longer period, or wait for the next daily survey.',
  'error.generic': 'Something went wrong loading the data.',
  'error.retry': 'Retry',
  'mood.1': 'Awful',
  'mood.2': 'Bad',
  'mood.3': 'Okay',
  'mood.4': 'Good',
  'mood.5': 'Great',
  'nav.me': 'My evolution',
  'me.subtitle': 'Only you can see your answers.',
  'me.period.label': 'Period',
  'me.period.week': 'Week',
  'me.period.month': 'Month',
  'me.period.year': 'Year',
  'me.filter.label': 'Servers',
  'me.all': 'All',
  'me.chart': 'Your mood',
  'me.chart.desc.day': 'Your answer each day, from 1 (awful) to 5 (great). Gaps are days you didn’t answer.',
  'me.chart.desc.week': 'Your average each week, from 1 (awful) to 5 (great).',
  'me.weekOf': 'Week of {day}',
  'me.empty.title': "You haven't answered in this period",
  'me.empty.body': 'Answer the daily survey HappyX sends you on Discord and your evolution will show up here.',
  'me.streak': '{n} days in a row',
  'me.streak.one': '1 day in a row',
  'me.streak.none': 'No streak right now',
  'me.latest': 'Latest comments',
  'me.noComments': 'No comments in this period.',
  'settings.link': 'Settings',
  'settings.title': 'Server settings',
  'settings.back': 'Back to the charts',
  'settings.language': 'Bot language',
  'settings.language.help': 'Language of the daily survey and the reports in this server.',
  'settings.hour': 'Survey time',
  'settings.hour.help': 'When members get the daily survey.',
  'settings.days': 'Survey days',
  'settings.days.help': 'The daily survey only goes out on these days. Reports leave out the other days unless someone answered, and streaks don’t break on them.',
  'settings.days.none': 'Pick at least one day.',
  'settings.timezone': 'Timezone',
  'settings.timezone.help': 'Used for the survey time and to decide when a day, week or month ends.',
  'settings.timezone.invalid': 'Pick a timezone from the list, e.g. Europe/Madrid.',
  'settings.frequency': 'Reports',
  'settings.frequency.help': 'How often the admin gets the report image by DM.',
  'settings.anonymous': 'Anonymous answers',
  'settings.anonymous.help': 'Reports and this dashboard show messages without saying who wrote them.',
  'settings.anonymous.off': 'If you turn this off, reports and this dashboard will show who writes each message from now on. Messages written while the server was anonymous stay anonymous.',
  'settings.admin.help': 'Who receives the reports is changed in Discord with /happyx config admin.',
  'settings.inactive': 'HappyX is no longer in this server, so its settings can’t be changed.',
  'settings.save': 'Save changes',
  'settings.saving': 'Saving…',
  'settings.saved': 'Saved. The bot uses the new settings within a minute.',
  'settings.error': "Couldn't save",
  'login.me.title': 'Your evolution',
  'login.me.body': 'Your own answers in every server, by week, month or year. Only you can see them.',
  'login.servers.title': 'Server reports',
  'login.servers.body': 'If you manage a server: average mood, trends, how answers spread and the latest messages.',
  'login.settings.title': 'Settings',
  'login.settings.body': 'Change the language, survey days and time, timezone, reports and anonymity without typing commands.',
  'nav.language': 'Language',
  'nav.theme.dark': 'Switch to dark mode',
  'nav.theme.light': 'Switch to light mode',
}

export type Key = keyof typeof en

const es: Record<Key, string> = {
  'login.title': 'El ánimo de tu servidor de Discord, día a día',
  'login.body': 'HappyX pregunta cada día a tu servidor cómo está todo el mundo. Entra con Discord para ver los resultados.',
  'login.button': 'Entrar con Discord',
  'login.failed': 'No hemos podido iniciar sesión. Vuelve a intentarlo.',
  'login.privacy': 'Solo leemos tu nombre de Discord y qué servidores administras.',
  'nav.logout': 'Salir',
  'nav.servers': 'Servidores',
  'guilds.title': 'Tus servidores',
  'guilds.empty.title': 'Todavía no hay servidores',
  'guilds.empty.body':
    'Verás un servidor aquí cuando HappyX esté en él y seas su dueño, Administrador o el admin que recibe los reports.',
  'guilds.inactive': 'Bot eliminado',
  'guilds.anonymous': 'Anónimo',
  'guilds.named': 'Nombres visibles',
  'guilds.weekly': 'Reports semanales',
  'guilds.monthly': 'Reports mensuales',
  'guild.notFound': 'Este servidor no existe o no puedes verlo.',
  'period.label': 'Periodo',
  'period.last-30': 'Últimos 30 días',
  'period.last-90': 'Últimos 90 días',
  'period.this-week': 'Esta semana',
  'period.last-week': 'Semana pasada',
  'period.this-month': 'Este mes',
  'period.last-month': 'Mes pasado',
  'stat.average': 'Ánimo medio',
  'stat.responses': 'Respuestas',
  'stat.respondents': 'Personas que han respondido',
  'chart.trend': 'Ánimo medio por día',
  'chart.trend.desc': 'Media de las respuestas de cada día, de 1 (muy mal) a 5 (genial). Los huecos son días sin respuestas; los días libres solo aparecen si alguien respondió.',
  'chart.distribution': 'Respuestas por estado de ánimo',
  'chart.table.show': 'Ver como tabla',
  'chart.table.hide': 'Ocultar tabla',
  'chart.day': 'Día',
  'chart.noAnswers': 'Sin respuestas',
  'chart.answers': '{n} respuestas',
  'chart.answer': '1 respuesta',
  'messages.title': 'Mensajes',
  'messages.anonymous': 'Anónimo: los mensajes se muestran sin su autor.',
  'messages.earlier_anonymous': 'Los mensajes escritos mientras el servidor era anónimo se muestran sin su autor.',
  'messages.empty': 'Nadie ha dejado un mensaje en este periodo.',
  'empty.title': 'No hay respuestas en este periodo',
  'empty.body': 'Elige un periodo más largo o espera a la próxima encuesta diaria.',
  'error.generic': 'Algo ha fallado al cargar los datos.',
  'error.retry': 'Reintentar',
  'mood.1': 'Muy mal',
  'mood.2': 'Mal',
  'mood.3': 'Normal',
  'mood.4': 'Bien',
  'mood.5': 'Genial',
  'nav.me': 'Mi evolución',
  'me.subtitle': 'Solo tú ves tus respuestas.',
  'me.period.label': 'Periodo',
  'me.period.week': 'Semana',
  'me.period.month': 'Mes',
  'me.period.year': 'Año',
  'me.filter.label': 'Servidores',
  'me.all': 'Todos',
  'me.chart': 'Tu ánimo',
  'me.chart.desc.day': 'Tu respuesta de cada día, de 1 (muy mal) a 5 (genial). Los huecos son días sin responder.',
  'me.chart.desc.week': 'Tu media de cada semana, de 1 (muy mal) a 5 (genial).',
  'me.weekOf': 'Semana del {day}',
  'me.empty.title': 'No has respondido en este periodo',
  'me.empty.body': 'Responde la encuesta diaria que te manda HappyX por Discord y aquí verás tu evolución.',
  'me.streak': '{n} días seguidos',
  'me.streak.one': '1 día seguido',
  'me.streak.none': 'Sin racha ahora mismo',
  'me.latest': 'Últimos comentarios',
  'me.noComments': 'Sin comentarios en este periodo.',
  'settings.link': 'Ajustes',
  'settings.title': 'Ajustes del servidor',
  'settings.back': 'Volver a las gráficas',
  'settings.language': 'Idioma del bot',
  'settings.language.help': 'Idioma de la encuesta diaria y de los reports en este servidor.',
  'settings.hour': 'Hora de la encuesta',
  'settings.hour.help': 'Cuándo reciben los miembros la encuesta diaria.',
  'settings.days': 'Días de encuesta',
  'settings.days.help': 'La encuesta diaria solo se envía estos días. Los reports no muestran los demás días salvo que alguien responda, y las rachas no se rompen por ellos.',
  'settings.days.none': 'Elige al menos un día.',
  'settings.timezone': 'Zona horaria',
  'settings.timezone.help': 'Se usa para la hora de la encuesta y para saber cuándo acaba un día, una semana o un mes.',
  'settings.timezone.invalid': 'Elige una zona horaria de la lista, por ejemplo Europe/Madrid.',
  'settings.frequency': 'Reports',
  'settings.frequency.help': 'Cada cuánto recibe el admin la imagen del report por mensaje privado.',
  'settings.anonymous': 'Respuestas anónimas',
  'settings.anonymous.help': 'Los reports y este panel muestran los mensajes sin decir quién los escribió.',
  'settings.anonymous.off': 'Si lo desactivas, los reports y este panel mostrarán quién escribe cada mensaje a partir de ahora. Los mensajes escritos mientras el servidor era anónimo seguirán siendo anónimos.',
  'settings.admin.help': 'Quién recibe los reports se cambia en Discord con /happyx config admin.',
  'settings.inactive': 'HappyX ya no está en este servidor, así que no se pueden cambiar sus ajustes.',
  'settings.save': 'Guardar cambios',
  'settings.saving': 'Guardando…',
  'settings.saved': 'Guardado. El bot usa los ajustes nuevos en menos de un minuto.',
  'settings.error': 'No se ha podido guardar',
  'login.me.title': 'Tu evolución',
  'login.me.body': 'Tus propias respuestas en cada servidor, por semana, mes o año. Solo las ves tú.',
  'login.servers.title': 'Reports del servidor',
  'login.servers.body': 'Si administras un servidor: ánimo medio, tendencia, cómo se reparten las respuestas y los últimos mensajes.',
  'login.settings.title': 'Ajustes',
  'login.settings.body': 'Cambia el idioma, los días y la hora de la encuesta, la zona horaria, los reports y el anonimato sin escribir comandos.',
  'nav.language': 'Idioma',
  'nav.theme.dark': 'Cambiar a modo oscuro',
  'nav.theme.light': 'Cambiar a modo claro',
}

export const messages: Record<string, Record<Key, string>> = { en, es }

export const languages = [
  ['en', 'English'],
  ['es', 'Español'],
] as const

const storageKey = 'happyx.lang'

// The saved choice if we still have that language, English otherwise.
export function pickLanguage(saved: string | null): string {
  return saved && messages[saved] ? saved : 'en'
}

function savedLanguage(): string | null {
  try {
    return localStorage.getItem(storageKey)
  } catch {
    return null
  }
}

export const lang = pickLanguage(typeof localStorage === 'undefined' ? null : savedLanguage())

// Every string is read at render time, so a reload is the simplest way to switch.
export function setLanguage(code: string) {
  try {
    localStorage.setItem(storageKey, code)
  } catch {
    // Private mode: the choice lasts until the reload below, which is as good as it gets.
  }
  location.reload()
}

export function t(key: Key, vars: Record<string, string | number> = {}): string {
  const s = messages[lang][key] ?? en[key]
  return s.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''))
}

export const moodEmojis = ['😞', '😕', '😐', '🙂', '🤩'] as const

export const moodEmoji = (mood: number) => moodEmojis[Math.min(5, Math.max(1, Math.round(mood))) - 1]

export const moodLabel = (mood: number) => t(`mood.${Math.min(5, Math.max(1, Math.round(mood)))}` as Key)

export function formatDay(day: string, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }): string {
  return new Intl.DateTimeFormat(lang, { ...opts, timeZone: 'UTC' }).format(new Date(`${day}T00:00:00Z`))
}

export const formatNumber = (n: number, digits = 0) =>
  new Intl.NumberFormat(lang, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n)
