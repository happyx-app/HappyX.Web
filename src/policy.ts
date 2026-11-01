// The public privacy policy at #/privacy-policy: what the GDPR asks to tell people (art. 13), and
// the URL Discord asks for in the Developer Portal. It needs no login and calls no API.
//
// The text is legal prose, read as a whole, so it lives here per language instead of as dozens
// of i18n keys. Keep both languages saying the same thing.

import { h } from './dom'
import { lang } from './i18n'

// The day the text last changed, shown at the top. When the change is one people should read
// again, also move PrivacyPolicyDate in HappyX.Api: the survey links this page until they answer.
export const updated = '2026-11-01'

// The shape of a legal page, shared with the terms of service (terms.ts).
export type Inline = string | { text: string; href: string }
export type Block = { p: Inline[] } | { ul: Inline[][] }
export type Section = { title: string; body: Block[] }
export type Policy = { title: string; updated: string; intro: string; sections: Section[] }

const yourData = (text: string) => ({ text, href: '#/privacy' })
const discord = (text: string) => ({ text, href: 'https://discord.com/privacy' })
const cloudflare = (text: string) => ({ text, href: 'https://www.cloudflare.com/privacypolicy/' })
const aepd = (text: string) => ({ text, href: 'https://www.aepd.es' })

const es = (): Policy => ({
  title: 'Política de privacidad',
  updated: 'Última actualización:',
  intro:
    'HappyX es un bot de Discord que pregunta cada día cómo estás y enseña los resultados a quien gestiona el servidor. Esta página explica qué datos guarda, para qué y cómo controlarlos.',
  sections: [
    {
      title: 'Qué datos guarda',
      body: [
        {
          ul: [
            ['De cada miembro de un servidor con HappyX: su ID y nombre de usuario de Discord, sus roles en ese servidor y si participa en la encuesta.'],
            ['Las respuestas a la encuesta: el ánimo (de 1 a 5), el comentario si lo escribes, el día y si el servidor era anónimo en ese momento.'],
            ['Los kudos que das y recibes, con su texto.'],
            ['En «¿Quién es quién?»: tus respuestas, lo que adivinas y las preguntas que propones.'],
            ['De cada servidor: su ID, su nombre, quién es el admin principal, a quién da acceso y sus ajustes (canales, roles, horario, idioma).'],
            ['Al entrar en la web: una cookie de sesión con tu ID, nombre, avatar y los servidores que gestionas. Caduca a las 12 horas y HappyX no guarda una copia. El idioma y el tema se guardan solo en tu navegador.'],
          ],
        },
        { p: ['HappyX no guarda tu email ni tu contraseña o token de Discord, no lee los mensajes de los canales y no usa cookies de analítica ni de publicidad.'] },
      ],
    },
    {
      title: 'Para qué se usan',
      body: [
        {
          ul: [
            ['Mandarte la encuesta diaria por mensaje privado.'],
            ['Publicar los kudos en el canal del servidor y avisar por mensaje privado a quien los recibe.'],
            ['Enseñar los resultados, los comentarios y los reports a los admins del servidor y a quien ellos den acceso. Por defecto es anónimo: no ven quién escribió cada respuesta. Si un admin lo cambia, ven tu nombre en las respuestas que des a partir de entonces; las anteriores siguen anónimas.'],
            ['Enseñarte «Mi evolución», que solo ves tú.'],
            ['Jugar a «¿Quién es quién?». Aquí nada es anónimo: al acabar la semana todos ven quién escribió cada respuesta, quién propuso la pregunta y cuántas acertó cada uno.'],
          ],
        },
        { p: ['Los datos no se venden ni se usan para publicidad.'] },
      ],
    },
    {
      title: 'Base legal',
      body: [
        {
          p: [
            'Responder a la encuesta, dar kudos y jugar es voluntario: la base legal es tu consentimiento (artículo 6.1.a del RGPD y, como el ánimo puede considerarse un dato de salud, artículo 9.2.a). Lo retiras cuando quieras: con «No volver a preguntar» dejas de recibir la encuesta, y en ',
            yourData('Tus datos'),
            ' borras lo que ya respondiste.',
          ],
        },
        {
          p: [
            'Tu ID, nombre y roles, los datos de cada servidor y los kudos que recibes se guardan por interés legítimo (artículo 6.1.f): saber a quién mandar la encuesta, quién ve los resultados y qué kudos se han dado en los servidores que han añadido HappyX.',
          ],
        },
      ],
    },
    {
      title: 'Quién más los trata',
      body: [
        {
          ul: [
            ['Discord: la encuesta, los kudos y los reports viajan por Discord, que aplica su ', discord('política de privacidad'), '.'],
            ['Cloudflare: la web pasa por Cloudflare, que ve tu dirección IP para protegerla y servirla con HTTPS (', cloudflare('su política'), ').'],
          ],
        },
        { p: ['Los datos se guardan en España, en una máquina propia. Discord y Cloudflare son empresas de EE. UU. adheridas al Marco de Privacidad de Datos UE-EE. UU.'] },
      ],
    },
    {
      title: 'Cuánto tiempo',
      body: [
        {
          ul: [
            ['Mientras HappyX esté en el servidor.'],
            ['Si borras tus datos desde ', yourData('Tus datos'), ', se borran al momento. Solo se quedan tu ID de Discord y tus roles, para no volver a mandarte la encuesta, y los ajustes del servidor que te nombran (admin principal, permisos).'],
            ['Si un admin elimina el servidor desde su Zona de peligro, sus datos se borran al momento.'],
            ['Si se quita HappyX del servidor, los datos de ese servidor se borran a los 30 días.'],
            ['Las copias de seguridad nocturnas guardan los datos borrados hasta 6 meses. Solo se usan para recuperar el servicio tras una avería.'],
          ],
        },
      ],
    },
    {
      title: 'Tus derechos',
      body: [
        {
          p: [
            'Puedes descargar y borrar tus datos tú mismo en ',
            yourData('Tus datos'),
            ', entrando con Discord.',
          ],
        },
        { p: ['Si crees que no se respetan tus derechos, puedes reclamar ante la ', aepd('Agencia Española de Protección de Datos'), '.'] },
      ],
    },
    {
      title: 'Cambios',
      body: [{ p: ['Si esta política cambia, se actualiza la fecha de arriba.'] }],
    },
  ],
})

const en = (): Policy => ({
  title: 'Privacy policy',
  updated: 'Last updated:',
  intro:
    'HappyX is a Discord bot that asks every day how you are and shows the results to whoever runs the server. This page explains what data it keeps, what for, and how to control it.',
  sections: [
    {
      title: 'What data it keeps',
      body: [
        {
          ul: [
            ['For each member of a server with HappyX: their Discord ID and username, their roles in that server and whether they take part in the survey.'],
            ['Survey answers: the mood (1 to 5), the comment if you write one, the day and whether the server was anonymous at the time.'],
            ['Kudos you give and get, with their text.'],
            ["In «Who's who?»: your answers, your guesses and the questions you propose."],
            ['For each server: its ID, its name, who the main admin is, who it gives access to and its settings (channels, roles, schedule, language).'],
            ['When you log in to the website: a session cookie with your ID, name, avatar and the servers you manage. It expires after 12 hours and HappyX keeps no copy of it. Language and theme are saved only in your browser.'],
          ],
        },
        { p: ["HappyX doesn't store your email or your Discord password or token, doesn't read channel messages and uses no analytics or advertising cookies."] },
      ],
    },
    {
      title: 'What it is used for',
      body: [
        {
          ul: [
            ['Sending you the daily survey by direct message.'],
            ['Posting kudos in the server’s channel and telling whoever gets them by direct message.'],
            ["Showing results, comments and reports to the server's admins and to whoever they give access. It is anonymous by default: they don't see who wrote each answer. If an admin changes that, they see your name on answers you give from then on; earlier ones stay anonymous."],
            ['Showing you «My evolution», which only you see.'],
            ["Playing «Who's who?». Nothing here is anonymous: when the week ends everyone sees who wrote each answer, who proposed the question and how many each person got right."],
          ],
        },
        { p: ['The data is not sold or used for advertising.'] },
      ],
    },
    {
      title: 'Legal basis',
      body: [
        {
          p: [
            'Answering the survey, giving kudos and playing are voluntary: the legal basis is your consent (GDPR article 6.1.a and, since mood may count as health data, article 9.2.a). You can withdraw it whenever you want: «Don’t ask me again» stops the survey, and in ',
            yourData('Your data'),
            ' you erase what you already answered.',
          ],
        },
        {
          p: [
            'Your ID, name and roles, each server’s data and the kudos you get are kept on the basis of legitimate interest (article 6.1.f): knowing whom to send the survey to, who sees the results and which kudos were given in the servers that added HappyX.',
          ],
        },
      ],
    },
    {
      title: 'Who else processes it',
      body: [
        {
          ul: [
            ['Discord: the survey, kudos and reports travel through Discord, which applies its own ', discord('privacy policy'), '.'],
            ['Cloudflare: the website goes through Cloudflare, which sees your IP address to protect it and serve it over HTTPS (', cloudflare('its policy'), ').'],
          ],
        },
        { p: ['The data is stored in Spain, on a machine HappyX runs itself. Discord and Cloudflare are US companies that take part in the EU-US Data Privacy Framework.'] },
      ],
    },
    {
      title: 'How long',
      body: [
        {
          ul: [
            ['As long as HappyX is in the server.'],
            ['If you erase your data from ', yourData('Your data'), ', it is deleted right away. Only your Discord ID and roles are kept, so you don’t get the survey again, and server settings that name you (main admin, permissions).'],
            ['If an admin deletes the server from its Danger zone, its data is deleted right away.'],
            ['If HappyX is removed from the server, that server’s data is deleted after 30 days.'],
            ['Nightly backups keep erased data for up to 6 months. They are only used to restore the service after a failure.'],
          ],
        },
      ],
    },
    {
      title: 'Your rights',
      body: [
        {
          p: [
            'You can download and erase your data yourself in ',
            yourData('Your data'),
            ', logged in with Discord.',
          ],
        },
        { p: ['If you think your rights are not respected, you can complain to the ', aepd('Spanish Data Protection Agency (AEPD)'), '.'] },
      ],
    },
    {
      title: 'Changes',
      body: [{ p: ['If this policy changes, the date above is updated.'] }],
    },
  ],
})

export const policyFor = (code: string): Policy => (code === 'es' ? es() : en())

const inline = (parts: Inline[]) =>
  parts.map((x) => (typeof x === 'string' ? x : h('a', x.href.startsWith('http') ? { href: x.href, rel: 'noopener', target: '_blank' } : { href: x.href }, x.text)))

// policyPage is the page's content, for the current language.
export const policyPage = () => legalPage(policyFor(lang), updated)

// legalPage renders a legal text: title, date, intro and one card per section.
export function legalPage(p: Policy, day: string): HTMLElement[] {
  const date = new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${day}T00:00:00Z`))
  return [
    h('div', {}, h('h1', {}, p.title), h('p', { class: 'muted small' }, `${p.updated} ${date}`)),
    h('p', { class: 'lead secondary' }, p.intro),
    ...p.sections.map((s) =>
      h(
        'section',
        { class: 'card policy-section' },
        h('h2', {}, s.title),
        ...s.body.map((b) => ('p' in b ? h('p', {}, ...inline(b.p)) : h('ul', {}, ...b.ul.map((li) => h('li', {}, ...inline(li)))))),
      ),
    ),
  ]
}
