import './style.css'
import * as api from './api'
import { distributionChart, trendChart, trendTable } from './charts'
import { h } from './dom'
import { formatDay, formatNumber, lang, moodEmoji, moodLabel, t } from './i18n'
import { isPreset, presets, rangeFor, todayIn, type Preset } from './periods'

// Routes live in the hash so nginx only has to serve index.html:
//   #/                       servers
//   #/g/<guildID>?p=<preset> one server's dashboard

const app = document.getElementById('app')!
document.documentElement.lang = lang
let me: api.Me | null = null

async function route() {
  try {
    me ??= await api.me()
  } catch (err) {
    if (err instanceof api.Unauthorized) return renderLogin()
    return renderError(err)
  }
  const [path, query = ''] = location.hash.replace(/^#/, '').split('?')
  const guildID = path.match(/^\/g\/(\d+)$/)?.[1]
  if (guildID) {
    const p = new URLSearchParams(query).get('p')
    return renderGuild(me, guildID, isPreset(p) ? p : 'last-30')
  }
  if (me.guilds.length === 1 && path === '') {
    location.replace(`#/g/${me.guilds[0].discord_guild_id}`)
    return
  }
  renderGuilds(me)
}

function page(...children: (Node | null)[]) {
  app.replaceChildren(...children.filter((c): c is Node => c !== null))
  window.scrollTo(0, 0)
}

const brand = () => h('a', { class: 'brand', href: '#/' }, h('span', { class: 'brand-mark', 'aria-hidden': 'true' }, '🙂'), 'HappyX')

function header(m: api.Me) {
  const u = m.user
  const avatar = u.avatar
    ? h('img', { class: 'avatar', alt: '', src: `https://cdn.discordapp.com/avatars/${u.discord_user_id}/${u.avatar}.png?size=64` })
    : h('span', { class: 'avatar avatar-fallback', 'aria-hidden': 'true' }, u.username.slice(0, 1).toUpperCase())
  return h(
    'header',
    { class: 'topbar' },
    brand(),
    h(
      'div',
      { class: 'user' },
      avatar,
      h('span', { class: 'user-name' }, u.username),
      h('button', {
        class: 'btn btn-ghost', type: 'button',
        onclick: async () => {
          await api.logout()
          me = null
          location.hash = ''
          route()
        },
      }, t('nav.logout')),
    ),
  )
}

function renderLogin() {
  const failed = new URLSearchParams(location.search).get('login') === 'failed'
  if (failed) history.replaceState(null, '', location.pathname + location.hash)
  page(
    h(
      'main',
      { class: 'login' },
      h(
        'section',
        { class: 'card login-card' },
        brand(),
        h('h1', {}, t('login.title')),
        h('p', { class: 'secondary' }, t('login.body')),
        failed ? h('p', { class: 'alert', role: 'alert' }, t('login.failed')) : null,
        h('a', { class: 'btn btn-discord', href: api.loginURL }, discordLogo(), t('login.button')),
        h('p', { class: 'muted small' }, t('login.privacy')),
      ),
      h('p', { class: 'muted small' }, t('app.tagline')),
    ),
  )
}

function renderGuilds(m: api.Me) {
  const list = m.guilds.length
    ? h(
        'ul',
        { class: 'guild-list' },
        ...m.guilds.map((g) =>
          h(
            'li',
            {},
            h(
              'a',
              { class: 'card guild-card', href: `#/g/${g.discord_guild_id}` },
              h('span', { class: 'guild-icon', 'aria-hidden': 'true' }, g.name.slice(0, 1).toUpperCase()),
              h(
                'span',
                { class: 'guild-text' },
                h('strong', {}, g.name),
                h('span', { class: 'muted small' }, [
                  t(g.report_frequency === 'monthly' ? 'guilds.monthly' : 'guilds.weekly'),
                  t(g.anonymous ? 'guilds.anonymous' : 'guilds.named'),
                ].join(' · ')),
              ),
              g.active ? null : h('span', { class: 'badge' }, t('guilds.inactive')),
            ),
          ),
        ),
      )
    : h('div', { class: 'card empty' }, h('h2', {}, t('guilds.empty.title')), h('p', { class: 'secondary' }, t('guilds.empty.body')))
  page(header(m), h('main', { class: 'container' }, h('h1', {}, t('guilds.title')), list))
}

async function renderGuild(m: api.Me, guildID: string, preset: Preset) {
  const g = m.guilds.find((x) => x.discord_guild_id === guildID)
  if (!g) {
    page(header(m), h('main', { class: 'container' }, h('div', { class: 'card empty' }, h('p', {}, t('guild.notFound')), h('a', { class: 'btn', href: '#/' }, t('nav.servers')))))
    return
  }
  const range = rangeFor(preset, todayIn(g.timezone))
  const body = h('div', { class: 'dashboard', 'aria-busy': 'true' }, skeleton())
  const picker = h(
    'div',
    { class: 'segmented', role: 'radiogroup', 'aria-label': t('period.label') },
    ...presets.map((p) =>
      h('a', {
        href: `#/g/${guildID}?p=${p}`, role: 'radio', 'aria-checked': String(p === preset),
        class: p === preset ? 'seg seg-on' : 'seg',
      }, t(`period.${p}`)),
    ),
  )
  page(
    header(m),
    h(
      'main',
      { class: 'container' },
      m.guilds.length > 1 ? h('a', { class: 'back', href: '#/' }, `← ${t('nav.servers')}`) : null,
      h(
        'div',
        { class: 'title-row' },
        h('div', {}, h('h1', {}, g.name), h('p', { class: 'muted' }, `${formatDay(range.from, { day: 'numeric', month: 'long', year: 'numeric' })} – ${formatDay(range.to, { day: 'numeric', month: 'long', year: 'numeric' })}`)),
      ),
      picker,
      body,
    ),
  )

  let r: api.Report
  try {
    r = await api.report(guildID, range.from, range.to)
  } catch (err) {
    if (err instanceof api.Unauthorized) return renderLogin()
    body.replaceChildren(errorCard(err))
    return
  }
  body.removeAttribute('aria-busy')
  if (r.responses === 0) {
    body.replaceChildren(h('div', { class: 'card empty' }, h('h2', {}, t('empty.title')), h('p', { class: 'secondary' }, t('empty.body'))))
    return
  }

  const tableWrap = h('div', { class: 'table-wrap', hidden: true }, trendTable(r.days))
  const toggle = h('button', { class: 'btn btn-ghost small', type: 'button', 'aria-expanded': 'false' }, t('chart.table.show'))
  toggle.addEventListener('click', () => {
    tableWrap.hidden = !tableWrap.hidden
    toggle.setAttribute('aria-expanded', String(!tableWrap.hidden))
    toggle.textContent = t(tableWrap.hidden ? 'chart.table.show' : 'chart.table.hide')
  })

  body.replaceChildren(
    h(
      'div',
      { class: 'stats' },
      stat(t('stat.average'), h('span', {}, h('span', { class: 'stat-emoji', 'aria-hidden': 'true' }, moodEmoji(r.average)), formatNumber(r.average, 1), h('span', { class: 'stat-unit' }, ' / 5')), moodLabel(r.average)),
      stat(t('stat.responses'), formatNumber(r.responses)),
      stat(t('stat.respondents'), formatNumber(r.respondents)),
    ),
    h(
      'section',
      { class: 'card' },
      h('div', { class: 'card-head' }, h('h2', {}, t('chart.trend')), toggle),
      h('p', { class: 'muted small' }, t('chart.trend.desc')),
      trendChart(r.days),
      tableWrap,
    ),
    h('div', { class: 'grid-2' },
      h('section', { class: 'card' }, h('h2', {}, t('chart.distribution')), distributionChart(r)),
      messagesCard(r),
    ),
  )
}

function stat(label: string, value: Node | string, note?: string) {
  return h('div', { class: 'card stat' }, h('span', { class: 'stat-label' }, label), h('span', { class: 'stat-value' }, value), note ? h('span', { class: 'muted small' }, note) : null)
}

function messagesCard(r: api.Report) {
  const list = r.messages.length
    ? h(
        'ul',
        { class: 'messages' },
        ...[...r.messages].reverse().map((msg) =>
          h(
            'li',
            {},
            h('span', { class: 'msg-mood', title: moodLabel(msg.mood) }, moodEmoji(msg.mood)),
            h(
              'div',
              {},
              h('p', { class: 'msg-text' }, msg.message),
              h('span', { class: 'muted small' }, [msg.username, formatDay(msg.day, { weekday: 'short', day: 'numeric', month: 'short' })].filter(Boolean).join(' · ')),
            ),
          ),
        ),
      )
    : h('p', { class: 'muted' }, t('messages.empty'))
  return h(
    'section',
    { class: 'card' },
    h('h2', {}, t('messages.title')),
    r.anonymous ? h('p', { class: 'muted small' }, `🔒 ${t('messages.anonymous')}`) : null,
    list,
  )
}

function skeleton() {
  return h('div', { class: 'skeleton' }, h('div', { class: 'sk sk-stats' }), h('div', { class: 'sk sk-chart' }))
}

function errorCard(err: unknown) {
  console.error(err)
  return h(
    'div',
    { class: 'card empty' },
    h('p', {}, t('error.generic')),
    h('button', { class: 'btn', type: 'button', onclick: () => route() }, t('error.retry')),
  )
}

function renderError(err: unknown) {
  page(h('main', { class: 'container' }, errorCard(err)))
}

function discordLogo() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('viewBox', '0 0 24 24')
  svg.setAttribute('aria-hidden', 'true')
  svg.setAttribute('class', 'discord-logo')
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  path.setAttribute('fill', 'currentColor')
  path.setAttribute('d', 'M20.32 4.37A19.8 19.8 0 0 0 15.4 2.85a.07.07 0 0 0-.08.04c-.21.38-.45.87-.61 1.25a18.3 18.3 0 0 0-5.49 0 12.6 12.6 0 0 0-.62-1.25.08.08 0 0 0-.08-.04 19.7 19.7 0 0 0-4.92 1.52.07.07 0 0 0-.03.03C.53 9.05-.32 13.58.1 18.06a.08.08 0 0 0 .03.05 19.9 19.9 0 0 0 6 3.03.08.08 0 0 0 .08-.03c.46-.63.87-1.3 1.22-2a.08.08 0 0 0-.04-.1 13.1 13.1 0 0 1-1.87-.9.08.08 0 0 1 0-.13l.37-.29a.07.07 0 0 1 .08-.01c3.93 1.8 8.18 1.8 12.06 0a.07.07 0 0 1 .08.01l.37.29a.08.08 0 0 1 0 .13c-.6.35-1.22.65-1.87.9a.08.08 0 0 0-.04.1c.36.7.77 1.37 1.22 2a.08.08 0 0 0 .08.03 19.8 19.8 0 0 0 6-3.03.08.08 0 0 0 .03-.05c.5-5.18-.84-9.68-3.55-13.66a.06.06 0 0 0-.03-.03ZM8.02 15.33c-1.18 0-2.16-1.08-2.16-2.42 0-1.33.96-2.42 2.16-2.42 1.21 0 2.18 1.1 2.16 2.42 0 1.34-.96 2.42-2.16 2.42Zm7.97 0c-1.18 0-2.15-1.08-2.15-2.42 0-1.33.95-2.42 2.15-2.42 1.22 0 2.18 1.1 2.16 2.42 0 1.34-.94 2.42-2.16 2.42Z')
  svg.append(path)
  return svg
}

window.addEventListener('hashchange', route)
route()
