// The public terms of service at #/terms: the other URL Discord asks for in the Developer Portal.
// Same layout as the privacy policy (policy.ts); keep both languages saying the same thing.

import { lang } from './i18n'
import { legalPage, type Policy } from './policy'

// The day the text last changed, shown at the top.
export const updated = '2026-11-01'

const link = (href: string) => (text: string) => ({ text, href })
const policy = link('#/privacy-policy')
const yourData = link('#/privacy')
const discordTerms = link('https://discord.com/terms')
const discordGuidelines = link('https://discord.com/guidelines')
const code = link('https://github.com/happyx-app')

const es = (): Policy => ({
  title: 'Términos de servicio',
  updated: 'Última actualización:',
  intro: 'Estos términos regulan el uso de HappyX, el bot de Discord y su web. Al añadir HappyX a un servidor o usarlo, los aceptas.',
  sections: [
    {
      title: 'Qué es HappyX',
      body: [
        {
          p: [
            'HappyX manda una encuesta de ánimo por mensaje privado los días que elige cada servidor, guarda las respuestas y enseña los resultados en la web y en un report. También tiene kudos y el juego «¿Quién es quién?». Ahora mismo es gratuito. Si algún día deja de serlo, se avisará antes.',
          ],
        },
      ],
    },
    {
      title: 'Quién puede usarlo',
      body: [
        {
          p: [
            'Necesitas una cuenta de Discord, tener al menos 14 años (o la edad que pida Discord en tu país, si es mayor) y cumplir sus ',
            discordTerms('términos'),
            ' y sus ',
            discordGuidelines('normas de la comunidad'),
            '.',
          ],
        },
      ],
    },
    {
      title: 'Si gestionas un servidor con HappyX',
      body: [
        {
          ul: [
            ['Avisa a quien vaya a recibir la encuesta de que HappyX está en el servidor y para qué lo usas.'],
            ['Responder es voluntario. No obligues a nadie a responder ni tomes decisiones sobre una persona por lo que responde.'],
            ['Tú decides si las respuestas son anónimas y a quién das acceso al panel, y respondes de esas decisiones.'],
          ],
        },
      ],
    },
    {
      title: 'Uso aceptable',
      body: [
        { p: ['No uses HappyX para:'] },
        {
          ul: [
            ['acosar, insultar o discriminar en comentarios, kudos o el juego;'],
            ['mandar spam;'],
            ['intentar ver datos de otros servidores o personas, o saltarte la seguridad del servicio;'],
            ['sobrecargar el servicio a propósito.'],
          ],
        },
        { p: ['Si alguien lo hace, HappyX puede dejar de dar servicio a esa persona o a ese servidor.'] },
      ],
    },
    {
      title: 'Lo que escribes',
      body: [
        {
          p: [
            'Tus comentarios, kudos y respuestas y preguntas del juego siguen siendo tuyos. Permites a HappyX guardarlos y enseñarlos como explica la ',
            policy('política de privacidad'),
            ', solo para que el servicio funcione.',
          ],
        },
      ],
    },
    {
      title: 'El servicio',
      body: [
        {
          ul: [
            ['Se ofrece tal cual. No se garantiza que esté siempre disponible ni libre de errores, y puede cambiar o cerrar. Si cierra, se avisará antes en la web para que puedas descargar tus datos.'],
            ['HappyX no es una herramienta médica ni de salud mental. Si alguien de tu equipo está mal, la encuesta no sustituye hablar con esa persona ni la ayuda de un profesional.'],
            ['En la medida en que lo permita la ley, HappyX no responde de daños indirectos ni de las decisiones que los admins tomen con sus datos.'],
          ],
        },
      ],
    },
    {
      title: 'Código abierto',
      body: [
        {
          p: [
            'El ',
            code('código de HappyX'),
            ' es público con licencia AGPL-3.0. Estos términos regulan el servicio en esta web y el bot oficial. El uso del código se rige por su licencia.',
          ],
        },
      ],
    },
    {
      title: 'Dejar de usarlo',
      body: [
        {
          p: [
            'Con «No volver a preguntar» dejas de recibir la encuesta de ese servidor, y en ',
            yourData('Tus datos'),
            ' borras lo que has respondido. Un admin puede quitar HappyX del servidor, o eliminar el servidor y todos sus datos desde la Zona de peligro. Qué pasa con los datos en cada caso lo explica la ',
            policy('política de privacidad'),
            '.',
          ],
        },
      ],
    },
    {
      title: 'Cambios',
      body: [{ p: ['Si estos términos cambian, se actualiza la fecha de arriba. Si el cambio es importante, se avisa en la web antes de aplicarlo.'] }],
    },
    {
      title: 'Ley aplicable',
      body: [{ p: ['Estos términos se rigen por la ley española, sin perjuicio de los derechos que te reconozca la ley de tu país.'] }],
    },
  ],
})

const en = (): Policy => ({
  title: 'Terms of service',
  updated: 'Last updated:',
  intro: 'These terms cover the use of HappyX, the Discord bot and its website. By adding HappyX to a server or using it, you accept them.',
  sections: [
    {
      title: 'What HappyX is',
      body: [
        {
          p: [
            'HappyX sends a mood survey by direct message on the days each server picks, keeps the answers and shows the results on the website and in a report. It also has kudos and the «Who’s who?» game. It is free for now. If that ever changes, you’ll be told in advance.',
          ],
        },
      ],
    },
    {
      title: 'Who can use it',
      body: [
        {
          p: [
            'You need a Discord account, to be at least 14 (or the age Discord asks for in your country, if higher), and to follow its ',
            discordTerms('terms'),
            ' and ',
            discordGuidelines('community guidelines'),
            '.',
          ],
        },
      ],
    },
    {
      title: 'If you run a server with HappyX',
      body: [
        {
          ul: [
            ['Tell the people who will get the survey that HappyX is in the server and what you use it for.'],
            ['Answering is voluntary. Don’t force anyone to answer or make decisions about a person based on what they answer.'],
            ['You decide whether answers are anonymous and who gets access to the dashboard, and you are responsible for those decisions.'],
          ],
        },
      ],
    },
    {
      title: 'Acceptable use',
      body: [
        { p: ['Don’t use HappyX to:'] },
        {
          ul: [
            ['harass, insult or discriminate in comments, kudos or the game;'],
            ['send spam;'],
            ['try to see other servers’ or people’s data, or get around the service’s security;'],
            ['overload the service on purpose.'],
          ],
        },
        { p: ['If someone does, HappyX may stop serving that person or that server.'] },
      ],
    },
    {
      title: 'What you write',
      body: [
        {
          p: [
            'Your comments, kudos and game answers and questions stay yours. You let HappyX keep and show them as the ',
            policy('privacy policy'),
            ' explains, only so the service works.',
          ],
        },
      ],
    },
    {
      title: 'The service',
      body: [
        {
          ul: [
            ['It is provided as is. It is not guaranteed to be always available or free of errors, and it may change or close. If it closes, there will be notice on the website so you can download your data.'],
            ['HappyX is not a medical or mental health tool. If someone on your team is struggling, the survey doesn’t replace talking to them or professional help.'],
            ['As far as the law allows, HappyX is not liable for indirect damages or for decisions admins make with its data.'],
          ],
        },
      ],
    },
    {
      title: 'Open source',
      body: [
        {
          p: [
            'The ',
            code('HappyX code'),
            ' is public under the AGPL-3.0 license. These terms cover the service on this website and the official bot. Use of the code is governed by its license.',
          ],
        },
      ],
    },
    {
      title: 'Stopping',
      body: [
        {
          p: [
            '«Don’t ask me again» stops that server’s survey, and in ',
            yourData('Your data'),
            ' you erase what you answered. An admin can remove HappyX from the server, or delete the server and all its data from the Danger zone. The ',
            policy('privacy policy'),
            ' explains what happens to the data in each case.',
          ],
        },
      ],
    },
    {
      title: 'Changes',
      body: [{ p: ['If these terms change, the date above is updated. If the change is important, there will be notice on the website before it applies.'] }],
    },
    {
      title: 'Governing law',
      body: [{ p: ['These terms are governed by Spanish law, without affecting the rights the law of your country gives you.'] }],
    },
  ],
})

export const termsFor = (code: string): Policy => (code === 'es' ? es() : en())

// termsPage is the page's content, for the current language.
export const termsPage = () => legalPage(termsFor(lang), updated)
