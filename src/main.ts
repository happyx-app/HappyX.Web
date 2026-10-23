import './style.css'
import * as api from './api'
import { answers, distributionChart, lineChart, trendChart, trendTable, type Series } from './charts'
import { h, s } from './dom'
import { formatDay, formatNumber, lang, languages, moodEmoji, moodLabel, setLanguage, t } from './i18n'
import { evolutionPeriods, evolutionRange, isEvolutionPeriod, latestMessages, seriesColor, toPoints, type EvolutionPeriod } from './evolution'
import { isPreset, presets, rangeFor, todayIn, type Preset } from './periods'
import { settingsForm } from './settings'
import { applySavedTheme, currentTheme, setTheme } from './theme'

// Routes live in the hash so nginx only has to serve index.html:
//   #/                       servers (or my evolution for someone who manages none)
//   #/g/<guildID>?p=<preset> one server's dashboard
//   #/g/<guildID>/settings   its settings
//   #/me?p=<period>&g=<id>   my own answers, optionally one server only

const app = document.getElementById('app')!
document.documentElement.lang = lang
applySavedTheme()
let me: api.Me | null = null

async function route() {
  try {
    me ??= await api.me()
  } catch (err) {
    if (err instanceof api.Unauthorized) return renderLogin()
    return renderError(err)
  }
  const [path, query = ''] = location.hash.replace(/^#/, '').split('?')
  const settingsID = path.match(/^\/g\/(\d+)\/settings$/)?.[1]
  if (settingsID) return renderSettings(me, settingsID)
  const guildID = path.match(/^\/g\/(\d+)$/)?.[1]
  if (guildID) {
    const p = new URLSearchParams(query).get('p')
    return renderGuild(me, guildID, isPreset(p) ? p : 'last-30')
  }
  if (path === '/me' || (path === '' && me.guilds.length === 0)) {
    const q = new URLSearchParams(query)
    const p = q.get('p')
    return renderMe(me, isEvolutionPeriod(p) ? p : 'month', q.get('g'))
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

// The top bar shows short codes so it still fits on a phone.
function languagePicker(short = false) {
  return h(
    'select',
    { class: 'lang-picker', 'aria-label': t('nav.language'), onchange: (e: Event) => setLanguage((e.target as HTMLSelectElement).value) },
    ...languages.map(([code, name]) => h('option', { value: code, selected: code === lang }, short ? code.toUpperCase() : name)),
  )
}

// Line icons in the text colour, so they stay black and white in both modes.
const icon = (...shapes: SVGElement[]) =>
  s('svg', { viewBox: '0 0 24 24', class: 'icon', 'aria-hidden': 'true', fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, ...shapes)

const sunIcon = () =>
  icon(
    s('circle', { cx: 12, cy: 12, r: 4 }),
    s('path', { d: 'M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41' }),
  )

const moonIcon = () => icon(s('path', { d: 'M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z' }))

// Shows the mode it switches to, like most theme buttons.
function themeToggle() {
  const btn = h('button', { class: 'btn btn-ghost theme-toggle', type: 'button' })
  const paint = () => {
    const next = currentTheme() === 'dark' ? 'light' : 'dark'
    btn.replaceChildren(next === 'dark' ? moonIcon() : sunIcon())
    btn.setAttribute('aria-label', t(next === 'dark' ? 'nav.theme.dark' : 'nav.theme.light'))
    btn.title = btn.getAttribute('aria-label')!
  }
  btn.addEventListener('click', () => {
    setTheme(currentTheme() === 'dark' ? 'light' : 'dark')
    paint()
  })
  paint()
  return btn
}

const brand = () => h('a', { class: 'brand', href: '#/' }, h('span', { class: 'brand-mark', 'aria-hidden': 'true' }, '🙂'), h('span', { class: 'brand-text' }, 'HappyX'))

function header(m: api.Me, active: 'me' | 'servers' = 'servers') {
  const u = m.user
  const avatar = u.avatar
    ? h('img', { class: 'avatar', alt: '', src: `https://cdn.discordapp.com/avatars/${u.discord_user_id}/${u.avatar}.png?size=64` })
    : h('span', { class: 'avatar avatar-fallback', 'aria-hidden': 'true' }, u.username.slice(0, 1).toUpperCase())
  return h(
    'header',
    { class: 'topbar' },
    h(
      'div',
      { class: 'topbar-left' },
      brand(),
      h(
        'nav',
        { class: 'nav' },
        h('a', { href: '#/me', class: active === 'me' ? 'nav-link nav-on' : 'nav-link', 'aria-current': active === 'me' ? 'page' : undefined }, t('nav.me')),
        m.guilds.length > 0
          ? h('a', { href: '#/', class: active === 'servers' ? 'nav-link nav-on' : 'nav-link', 'aria-current': active === 'servers' ? 'page' : undefined }, t('nav.servers'))
          : null,
      ),
    ),
    h(
      'div',
      { class: 'user' },
      themeToggle(),
      languagePicker(true),
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
  const feature = (icon: string, title: string, body: string) =>
    h('li', { class: 'feature' }, h('span', { class: 'feature-icon', 'aria-hidden': 'true' }, icon), h('span', {}, h('strong', {}, title), h('span', { class: 'secondary' }, body)))
  page(
    h(
      'main',
      { class: 'login' },
      h('div', { class: 'login-top' }, themeToggle(), languagePicker()),
      h(
        'section',
        { class: 'card login-card' },
        brand(),
        h('h1', {}, t('login.title')),
        h('p', { class: 'secondary' }, t('login.body')),
        h(
          'ul',
          { class: 'features' },
          feature('📈', t('login.me.title'), t('login.me.body')),
          feature('📊', t('login.servers.title'), t('login.servers.body')),
          feature('⚙️', t('login.settings.title'), t('login.settings.body')),
        ),
        failed ? h('p', { class: 'alert', role: 'alert' }, t('login.failed')) : null,
        h('a', { class: 'btn btn-discord', href: api.loginURL }, discordLogo(), t('login.button')),
        h('p', { class: 'muted small' }, t('login.privacy')),
      ),
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
        h('a', { class: 'btn btn-ghost', href: `#/g/${guildID}/settings` }, `⚙️ ${t('settings.link')}`),
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

async function renderMe(m: api.Me, period: EvolutionPeriod, filter: string | null) {
  const range = evolutionRange(period, todayIn(Intl.DateTimeFormat().resolvedOptions().timeZone))
  const href = (p: EvolutionPeriod, g: string | null) => `#/me?p=${p}${g ? `&g=${g}` : ''}`
  const body = h('div', { class: 'dashboard', 'aria-busy': 'true' }, skeleton())
  page(
    header(m, 'me'),
    h(
      'main',
      { class: 'container' },
      h('div', {}, h('h1', {}, t('nav.me')), h('p', { class: 'muted' }, `🔒 ${t('me.subtitle')}`)),
      h(
        'div',
        { class: 'segmented', role: 'radiogroup', 'aria-label': t('me.period.label') },
        ...evolutionPeriods.map((p) =>
          h('a', { href: href(p, filter), role: 'radio', 'aria-checked': String(p === period), class: p === period ? 'seg seg-on' : 'seg' }, t(`me.period.${p}`)),
        ),
      ),
      body,
    ),
  )

  let data: api.MyMoods
  try {
    data = await api.myMoods(range.from, range.to)
  } catch (err) {
    if (err instanceof api.Unauthorized) return renderLogin()
    body.replaceChildren(errorCard(err))
    return
  }
  body.removeAttribute('aria-busy')
  if (data.guilds.every((g) => g.responses === 0)) {
    body.replaceChildren(h('div', { class: 'card empty' }, h('h2', {}, t('me.empty.title')), h('p', { class: 'secondary' }, t('me.empty.body'))))
    return
  }

  // Colours come from each server's place in the full list, so filtering never repaints a line.
  const all = data.guilds.map((g, i) => ({ g, color: seriesColor(i) }))
  const selected = all.some(({ g }) => g.discord_guild_id === filter) ? filter : null
  const shown = all.filter(({ g }) => selected === null || g.discord_guild_id === selected)
  const pts = toPoints(data.guilds, range, period)
  const lines = shown.filter((s): s is { g: api.MyGuildMoods; color: string } => s.color !== null)
  const series: Series[] = lines.map(({ g, color }) => ({ name: g.name, color, values: pts.values.get(g.discord_guild_id)! }))
  const xLabel = (x: string) => (pts.byWeek ? t('me.weekOf', { day: formatDay(x) }) : formatDay(x, { weekday: 'short', day: 'numeric', month: 'short' }))

  const chart = lineChart(pts.xs, series, {
    label: t('me.chart'),
    tick: (x) => formatDay(x, pts.byWeek ? { month: 'short' } : { day: 'numeric', month: 'short' }),
    // By week, label the first week of each month.
    tickAt: pts.byWeek ? (i) => i === 0 || pts.xs[i].slice(0, 7) !== pts.xs[i - 1].slice(0, 7) : undefined,
    tooltip: (i) => [
      h('div', { class: 'tooltip-title' }, xLabel(pts.xs[i])),
      ...lines.map(({ g, color }) => {
        const v = pts.values.get(g.discord_guild_id)![i]
        const n = pts.counts.get(g.discord_guild_id)![i]
        return h(
          'div',
          { class: 'tooltip-row' },
          swatch(color),
          h('span', { class: 'tooltip-name' }, g.name),
          v === null
            ? h('span', { class: 'muted' }, '–')
            : h('strong', {}, `${moodEmoji(v)} ${formatNumber(v, pts.byWeek ? 1 : 0)}`, pts.byWeek ? h('span', { class: 'muted' }, ` · ${answers(n)}`) : null),
        )
      }),
    ],
  })

  const table = h(
    'table',
    { class: 'table' },
    h('thead', {}, h('tr', {}, h('th', {}, t('chart.day')), ...lines.map(({ g }) => h('th', { class: 'num' }, g.name)))),
    h(
      'tbody',
      {},
      ...pts.xs.map((x, i) =>
        h('tr', {}, h('td', {}, xLabel(x)), ...lines.map(({ g }) => {
          const v = pts.values.get(g.discord_guild_id)![i]
          return h('td', { class: 'num' }, v === null ? '–' : `${moodEmoji(v)} ${formatNumber(v, pts.byWeek ? 1 : 0)}`)
        })),
      ),
    ),
  )
  const tableWrap = h('div', { class: 'table-wrap', hidden: true }, table)
  const toggle = h('button', { class: 'btn btn-ghost small', type: 'button', 'aria-expanded': 'false' }, t('chart.table.show'))
  toggle.addEventListener('click', () => {
    tableWrap.hidden = !tableWrap.hidden
    toggle.setAttribute('aria-expanded', String(!tableWrap.hidden))
    toggle.textContent = t(tableWrap.hidden ? 'chart.table.show' : 'chart.table.hide')
  })

  // The chips are the legend and the filter at once.
  const chips =
    all.length > 1
      ? h(
          'div',
          { class: 'chips', role: 'group', 'aria-label': t('me.filter.label') },
          h('a', { href: href(period, null), class: selected === null ? 'chip chip-on' : 'chip', 'aria-pressed': String(selected === null) }, t('me.all')),
          ...all.map(({ g, color }) =>
            h(
              'a',
              { href: href(period, g.discord_guild_id), class: selected === g.discord_guild_id ? 'chip chip-on' : 'chip', 'aria-pressed': String(selected === g.discord_guild_id) },
              color ? swatch(color) : null,
              g.name,
            ),
          ),
        )
      : null

  body.replaceChildren(
    h(
      'section',
      { class: 'card' },
      h('div', { class: 'card-head' }, h('h2', {}, t('me.chart')), toggle),
      h('p', { class: 'muted small' }, t(pts.byWeek ? 'me.chart.desc.week' : 'me.chart.desc.day')),
      chips,
      chart,
      tableWrap,
    ),
    h('div', { class: 'grid-2' }, ...shown.map(({ g, color }) => myGuildCard(g, color))),
  )
}

function myGuildCard(g: api.MyGuildMoods, color: string | null) {
  const msgs = latestMessages(g)
  const streak = g.streak === 0 ? t('me.streak.none') : g.streak === 1 ? t('me.streak.one') : t('me.streak', { n: formatNumber(g.streak) })
  return h(
    'section',
    { class: 'card my-guild' },
    h('h2', { class: 'my-guild-name' }, color ? swatch(color) : null, g.name),
    h(
      'div',
      { class: 'my-guild-stats' },
      g.responses > 0
        ? h('span', { class: 'stat-value' }, h('span', { class: 'stat-emoji', 'aria-hidden': 'true' }, moodEmoji(g.average)), formatNumber(g.average, 1), h('span', { class: 'stat-unit' }, ' / 5'))
        : h('span', { class: 'stat-value muted' }, '–'),
      h(
        'span',
        { class: 'my-guild-meta' },
        h('span', {}, g.responses > 0 ? `${moodLabel(g.average)} · ${answers(g.responses)}` : t('chart.noAnswers')),
        h('span', { class: g.streak > 0 ? 'streak streak-on' : 'streak' }, g.streak > 0 ? `🔥 ${streak}` : streak),
      ),
    ),
    h('h3', { class: 'small secondary' }, t('me.latest')),
    msgs.length
      ? h(
          'ul',
          { class: 'messages' },
          ...msgs.map((e) =>
            h(
              'li',
              {},
              h('span', { class: 'msg-mood', title: moodLabel(e.mood) }, moodEmoji(e.mood)),
              h('div', {}, h('p', { class: 'msg-text' }, e.message ?? ''), h('span', { class: 'muted small' }, formatDay(e.day, { weekday: 'short', day: 'numeric', month: 'short' }))),
            ),
          ),
        )
      : h('p', { class: 'muted small' }, t('me.noComments')),
  )
}

function swatch(color: string) {
  const el = h('span', { class: 'swatch', 'aria-hidden': 'true' })
  el.style.background = color
  return el
}

function renderSettings(m: api.Me, guildID: string) {
  const g = m.guilds.find((x) => x.discord_guild_id === guildID)
  if (!g) {
    page(header(m), h('main', { class: 'container' }, h('div', { class: 'card empty' }, h('p', {}, t('guild.notFound')), h('a', { class: 'btn', href: '#/' }, t('nav.servers')))))
    return
  }
  page(
    header(m),
    h(
      'main',
      { class: 'container narrow' },
      h('a', { class: 'back', href: `#/g/${guildID}` }, `← ${t('settings.back')}`),
      h('h1', {}, g.name),
      settingsForm(
        g,
        (updated) => {
          m.guilds = m.guilds.map((x) => (x.discord_guild_id === updated.discord_guild_id ? updated : x))
        },
        () => renderLogin(),
      ),
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
    r.anonymous
      ? h('p', { class: 'muted small' }, `🔒 ${t('messages.anonymous')}`)
      : r.messages.some((m) => !m.username)
        ? h('p', { class: 'muted small' }, `🔒 ${t('messages.earlier_anonymous')}`)
        : null,
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
