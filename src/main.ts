import './style.css'
import * as api from './api'
import { answers, distributionChart, lineChart, trendChart, trendTable, type Series } from './charts'
import { h } from './dom'
import * as icons from './icons'
import { formatDay, formatNumber, formatRange, lang, weekdayPlural, languages, moodEmoji, moodLabel, setLanguage, t } from './i18n'
import { evolutionPeriods, evolutionRange, gameTotals, isEvolutionPeriod, latestMessages, seriesColor, share, toPoints, type EvolutionPeriod } from './evolution'
import { defaultPreset, isPreset, presets, rangeFor, todayIn, type Preset } from './periods'
import { comparable, delta, extremeDays, isNewGuild, filterMessages, highestWeekday, lowestWeekday, moodFilters, nextReportDay, nextSurveyDay, participationRate, previousRange, tone, weekdayAverages, type MoodFilter, type WeekdayStat } from './insights'
import { botLanguages, dangerZone, daysLabel, settingsForm, surveyMessageCard } from './settings'
import { accessCard } from './access'
import { surveyRolesCard } from './surveyRoles'
import { guildVacationsCard, myVacationCard } from './vacation'
import { gamePage } from './game'
import { guildExport, privacyPage } from './privacy'
import { policyPage } from './policy'
import { termsPage } from './terms'
import { applySavedTheme, currentTheme, setTheme } from './theme'
import logoURL from './logo.svg'
import panelEnLight from './landing/panel-en-light.jpg'
import panelEnDark from './landing/panel-en-dark.jpg'
import panelEsLight from './landing/panel-es-light.jpg'
import panelEsDark from './landing/panel-es-dark.jpg'
import panelEnLightPhone from './landing/panel-en-light-movil.jpg'
import panelEnDarkPhone from './landing/panel-en-dark-movil.jpg'
import panelEsLightPhone from './landing/panel-es-light-movil.jpg'
import panelEsDarkPhone from './landing/panel-es-dark-movil.jpg'
import reportEn from './landing/report-en.jpg'
import reportEs from './landing/report-es.jpg'
import * as survey from './surveyMessage'
import { confetti } from './confetti'
import { reloadCanvas, showCanvas } from './canvas'

// Routes live in the hash so nginx only has to serve index.html:
//   #/                       servers (or my evolution for someone who manages none); the landing page when logged out
//   #/about                  the landing page
//   #/g/<guildID>?p=<preset> one server's dashboard
//   #/g/<guildID>/settings   its settings
//   #/me?p=<period>&g=<id>   my own answers, optionally one server only
//   #/games                  servers where I can play «Who's who?»
//   #/game/<guildID>         the game in one server (the bot links here)
//   #/privacy                the user's own data: download or erase it
//   #/privacy-policy         the privacy policy, public (the URL given to Discord)
//   #/terms                  the terms of service, public (also given to Discord)
// /demo serves the same app on a made-up server, without logging in (see api.isDemo).

const app = document.getElementById('app')!
document.documentElement.lang = lang
applySavedTheme()
if (api.isDemo) document.title = `HappyX · ${t('demo.label')}`
let me: api.Me | null = null

// The public legal pages, by route.
const legal: Record<string, () => HTMLElement[]> = { '/privacy-policy': policyPage, '/terms': termsPage }

async function route() {
  const [path, query = ''] = location.hash.replace(/^#/, '').split('?')
  try {
    me ??= await api.me()
    me.games ??= []
    me.member_guilds ??= []
    me.paused_guilds ??= []
  } catch (err) {
    showCanvas(null)
    // The legal pages are public, and must stay readable even if the API is down.
    if (legal[path]) return renderLegal(null, legal[path]())
    if (err instanceof api.Unauthorized && !api.isDemo) {
      const ask = signInReason(path)
      return ask ? renderSignIn(path, ask) : renderLanding(null)
    }
    return renderError(err)
  }
  // A server's pages share its team canvas, behind them.
  showCanvas(path.match(/^\/(?:g|game)\/(\d+)(?:\/settings)?$/)?.[1] ?? null)
  if (legal[path]) return renderLegal(me, legal[path]())
  // The demo's made-up admin has no landing page or personal data of their own.
  if (api.isDemo && (path === '/about' || path === '/privacy')) return location.replace('#/')
  if (path === '/about') return renderLanding(me)
  const gameID = path.match(/^\/game\/(\d+)$/)?.[1]
  // ?history (from «My evolution») scrolls to the past rounds.
  if (gameID) return renderGame(me, gameID, new URLSearchParams(query).has('history'))
  if (path === '/games') {
    if (me.games.length === 1) return location.replace(`#/game/${me.games[0].discord_guild_id}`)
    return renderGames(me)
  }
  if (path === '/privacy') return renderPrivacy(me)
  const settingsID = path.match(/^\/g\/(\d+)\/settings$/)?.[1]
  if (settingsID) return renderSettings(me, settingsID)
  const guildID = path.match(/^\/g\/(\d+)$/)?.[1]
  if (guildID) {
    const q = new URLSearchParams(query)
    const p = q.get('p')
    const g = me.guilds.find((x) => x.discord_guild_id === guildID)
    // Right after «Add to Discord», the bot may not have registered the server yet.
    if (!g && q.get('added') === '1' && !api.isDemo) return renderConnecting(me, guildID)
    if (g && q.has('added')) return location.replace(`#/g/${guildID}`)
    return renderGuild(me, guildID, isPreset(p) ? p : g ? defaultPreset(g.report_frequency, todayIn(g.timezone)) : 'last-30', isPreset(p))
  }
  if (path === '/me' || (path === '' && me.guilds.length === 0)) {
    const q = new URLSearchParams(query)
    const p = q.get('p')
    return renderMe(me, isEvolutionPeriod(p) ? p : 'month', q.get('g'))
  }
  // With one server, the list would be a single card: go straight to it. «Servers» links to #/.
  if (me.guilds.length === 1 && (path === '' || path === '/')) {
    location.replace(`#/g/${me.guilds[0].discord_guild_id}`)
    return
  }
  renderGuilds(me)
}

function page(...children: (Node | null)[]) {
  const nodes = children.filter((c): c is Node => c !== null)
  // In the demo the notice stays on top, together with the top bar.
  if (api.isDemo && nodes[0] instanceof HTMLElement && nodes[0].classList.contains('topbar')) {
    nodes[0] = h('div', { class: 'demo-head' }, demoBanner(), nodes[0])
  }
  app.replaceChildren(...skipLink(nodes), ...nodes, ...(me && !api.isDemo ? [footer()] : []))
  window.scrollTo(0, 0)
}

// The first Tab stop jumps past the top bar to the page's main content. It moves focus by hand:
// the hash belongs to the router.
function skipLink(nodes: Node[]): HTMLElement[] {
  const main = nodes.map((n) => (n instanceof HTMLElement ? n.closest('main') ?? n.querySelector('main') : null)).find((m) => m)
  if (!main) return []
  main.tabIndex = -1
  return [
    h('a', { class: 'skip-link', href: '#', onclick: (e: Event) => { e.preventDefault(); main.focus() } }, t('nav.skip')),
  ]
}

// The demo's notice: what this is, and how to get it for real.
function demoBanner() {
  return h(
    'div',
    { class: 'demo-banner', role: 'note' },
    h(
      'p',
      {},
      h('span', { class: 'demo-badge' }, t('demo.label')),
      h('span', {}, h('strong', {}, t('demo.title')), ' ', h('span', { class: 'demo-more' }, t('demo.body'))),
    ),
    h(
      'div',
      { class: 'demo-actions' },
      h('a', { class: 'btn btn-sun', href: api.inviteURL }, discordLogo(), t('landing.add')),
      h('a', { class: 'demo-home', href: '/' }, t('demo.home')),
    ),
  )
}

const footer = () =>
  h(
    'footer',
    { class: 'footer' },
    h('span', { class: 'footer-links' }, h('a', { href: '#/privacy-policy' }, t('nav.privacy')), h('a', { href: '#/terms' }, t('nav.terms')), h('a', { href: '#/privacy' }, t('privacy.title'))),
  )

// The landing page's footer, also under the privacy policy when nobody is logged in.
const landingFooter = () =>
  h('footer', { class: 'landing-footer muted small' }, brand(), h('span', { class: 'footer-links' }, h('a', { href: '#/privacy-policy' }, t('nav.privacy')), h('a', { href: '#/terms' }, t('nav.terms')), h('span', {}, '© ', new Date().getFullYear())))

// The top bar shows short codes so it still fits on a phone.
function languagePicker(short = false) {
  return h(
    'select',
    { class: 'lang-picker', 'aria-label': t('nav.language'), onchange: (e: Event) => setLanguage((e.target as HTMLSelectElement).value) },
    ...languages.map(([code, name]) => h('option', { value: code, selected: code === lang }, short ? code.toUpperCase() : name)),
  )
}

// Shows the mode it switches to, like most theme buttons.
function themeToggle() {
  const btn = h('button', { class: 'btn btn-ghost icon-btn theme-toggle', type: 'button' })
  const paint = () => {
    const next = currentTheme() === 'dark' ? 'light' : 'dark'
    btn.replaceChildren(next === 'dark' ? icons.moon() : icons.sun())
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

// In the demo the logo leaves it for the real site: on a phone «Back to HappyX» doesn't fit.
const brand = () =>
  h(
    'a',
    api.isDemo ? { class: 'brand', href: '/', 'aria-label': t('demo.home') } : { class: 'brand', href: '#/' },
    h('img', { class: 'brand-mark', src: logoURL, alt: '' }),
    h('span', { class: 'brand-text' }, 'HappyX'),
  )

function header(m: api.Me, active: 'me' | 'servers' | 'games' | 'privacy' | 'none' = 'servers') {
  const u = m.user
  // Some networks block Discord's image server: show the name's initial instead of a broken image.
  const avatar: HTMLElement = h('img', {
    class: 'avatar',
    alt: '',
    src: api.avatarURL(u.discord_user_id, u.avatar),
    onerror: () => avatar.replaceWith(h('span', { class: 'avatar avatar-initial', 'aria-hidden': 'true' }, [...u.username.trim()][0]?.toUpperCase() ?? '?')),
  })
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
        m.guilds.length > 0 || memberGuilds(m).length > 0
          ? h('a', { href: '#/', class: active === 'servers' ? 'nav-link nav-on' : 'nav-link', 'aria-current': active === 'servers' ? 'page' : undefined }, t('nav.servers'))
          : null,
        m.games.length > 0
          ? h('a', { href: '#/games', class: active === 'games' ? 'nav-link nav-on' : 'nav-link', 'aria-current': active === 'games' ? 'page' : undefined }, t('nav.games'))
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
      api.isDemo
        ? null
        : h('button', {
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

const shots: Record<string, string> = { 'en-light': panelEnLight, 'en-dark': panelEnDark, 'es-light': panelEsLight, 'es-dark': panelEsDark }
const phoneShots: Record<string, string> = { 'en-light': panelEnLightPhone, 'en-dark': panelEnDarkPhone, 'es-light': panelEsLightPhone, 'es-dark': panelEsDarkPhone }

// The public landing page: what HappyX is, with buttons to add the bot and to log in. A logged-in
// user reaches it at #/about, where "Log in" becomes "Open dashboard".
function renderLanding(m: api.Me | null) {
  if (!m) me = null // logged out, or the session is gone
  const failed = new URLSearchParams(location.search).get('login') === 'failed'
  if (failed) history.replaceState(null, '', location.pathname + location.hash)
  const add = () => h('a', { class: 'btn btn-discord', href: api.inviteURL }, discordLogo(), t('landing.add'))
  const demo = () => h('a', { class: 'btn btn-outline', href: '/demo' }, t('landing.demo'))
  // Someone without any dashboard goes to «My evolution», and the button says so.
  const enter = (cls = 'btn btn-outline') =>
    !m
      ? h('a', { class: cls, href: api.loginURL }, t('landing.login'))
      : m.guilds.length
        ? h('a', { class: cls, href: '#/' }, t('landing.dashboard'))
        : h('a', { class: cls, href: '#/me' }, t('nav.me'))
  const feature = (title: string, body: string) => h('li', {}, h('h3', {}, title), h('p', { class: 'secondary' }, body))
  // A real capture of the demo dashboard, in the page's language and theme.
  const shotLang = lang === 'es' ? 'es' : 'en'
  const shot = (theme: 'light' | 'dark') =>
    h(
      'picture',
      { class: `shot-${theme}` },
      h('source', { media: '(max-width: 600px)', srcset: phoneShots[`${shotLang}-${theme}`], width: 780, height: 1500 }),
      h('img', { src: shots[`${shotLang}-${theme}`], alt: theme === 'light' ? t('landing.shot.alt') : '', width: 2400, height: 1500, loading: 'lazy', decoding: 'async' }),
    )
  page(
    h(
      'header',
      { class: 'topbar' },
      brand(),
      h('div', { class: 'user' }, themeToggle(), languagePicker(true), enter('btn btn-ghost')),
    ),
    h(
      'main',
      { class: 'landing' },
      h(
        'section',
        { class: 'hero' },
        h(
          'div',
          { class: 'hero-text' },
          h('h1', {}, ...marked(t('landing.title'))),
          h('p', { class: 'lead secondary' }, t('landing.body')),
          failed ? h('p', { class: 'alert', role: 'alert' }, t('landing.failed')) : null,
          h('div', { class: 'actions' }, add(), demo()),
        ),
        h('div', { class: 'hero-art' }, surveyMock()),
      ),
      h(
        'section',
        { class: 'landing-section' },
        h('h2', {}, t('landing.shot.title')),
        h('figure', { class: 'shot' }, h('div', { class: 'shot-frame' }, shot('light'), shot('dark')), h('figcaption', {}, t('landing.shot.caption'))),
      ),
      // The report image exactly as the bot draws it, for the demo's made-up week.
      h(
        'section',
        { class: 'landing-section report-shot' },
        h('div', {}, h('h2', {}, t('landing.report.title')), h('p', { class: 'secondary' }, t('landing.report.body'))),
        h('img', { src: lang === 'es' ? reportEs : reportEn, alt: t('landing.report.alt'), width: 1200, height: 1234, loading: 'lazy', decoding: 'async' }),
      ),
      h(
        'section',
        { class: 'landing-section' },
        h('h2', {}, t('landing.features.title')),
        h(
          'ul',
          { class: 'feature-list' },
          feature(t('landing.f.kudos.title'), t('landing.f.kudos.body')),
          feature(t('landing.f.game.title'), t('landing.f.game.body')),
          feature(t('landing.f.web.title'), t('landing.f.web.body')),
          feature(t('landing.f.settings.title'), t('landing.f.settings.body')),
        ),
      ),
      h(
        'section',
        { class: 'landing-section' },
        h('h2', {}, t('landing.privacy.title')),
        h(
          'ul',
          { class: 'checks privacy' },
          ...(['landing.privacy.1', 'landing.privacy.2', 'landing.privacy.3', 'landing.privacy.4'] as const).map((k) => h('li', {}, t(k))),
        ),
      ),
      h(
        'section',
        { class: 'cta' },
        h('h2', {}, t('landing.cta.title')),
        h('p', { class: 'secondary' }, t('landing.cta.body')),
        h('div', { class: 'actions' }, add(), demo(), enter()),
      ),
    ),
    landingFooter(),
  )
}

// *words* in a title are highlighted, like a marker pen.
const marked = (text: string) => text.split('*').map((part, i) => (i % 2 ? h('mark', {}, part) : part))

// The survey DM exactly as the bot sends it (see surveyMessage.ts), in the page's language and
// theme, to a made-up member of a made-up server.
function surveyMock() {
  const language = survey.botStrings[lang] ? lang : 'en'
  const guild = t('landing.mock.guild')
  const c = survey.surveyCard('', guild, language, true, { id: '0', name: 'Laura', streak: 0 }, new Date())
  const b = survey.botStrings[language]
  return h(
    'figure',
    { class: 'dc-preview dc-mock', 'aria-hidden': 'true' },
    h('img', { class: 'dc-avatar', src: logoURL, alt: '' }),
    h(
      'div',
      { class: 'dc-body' },
      h('div', { class: 'dc-head' }, h('strong', {}, 'HappyX'), h('span', { class: 'dc-app' }, 'APP'), h('span', { class: 'dc-time' }, t('landing.mock.time'))),
      h(
        'div',
        { class: 'dc-embed dc-embed-thumb' },
        h(
          'div',
          {},
          h('div', { class: 'dc-embed-author' }, c.author),
          h('div', { class: 'dc-embed-heading' }, c.greeting ?? ''),
          h('div', { class: 'dc-content' }, c.text),
          h('div', { class: 'dc-embed-footer' }, c.footer),
        ),
        h('span', { class: 'dc-thumb' }, [...guild][0]),
      ),
      h('div', { class: 'dc-buttons' }, ...survey.moodEmojis.map((e) => h('span', { class: 'dc-button dc-emoji' }, e))),
      h('div', { class: 'dc-buttons' }, h('span', { class: 'dc-button' }, `🔕 ${b.stop}`)),
    ),
  )
}

const memberGuilds = (m: api.Me) => m.member_guilds ?? []

// A server where the user is a member without access to the dashboard: its name, and its page
// shows the team canvas.
const memberGuildCard = (g: api.GameGuild) =>
  h(
    'li',
    {},
    h(
      'a',
      { class: 'card guild-card', href: `#/g/${g.discord_guild_id}` },
      h('span', { class: 'guild-icon', 'aria-hidden': 'true' }, g.name.slice(0, 1).toUpperCase()),
      h('span', { class: 'guild-text' }, h('strong', {}, g.name), h('span', { class: 'muted small' }, t('guilds.access.none'))),
    ),
  )

// «Already added it?» and a button that rereads the user's servers from Discord.
const refreshLine = (next?: string, label = t('guilds.refresh')) =>
  h('p', { class: 'muted small refresh-line' }, t('guilds.added'), ' ', h('a', { class: 'btn btn-outline', href: api.refreshURL(next) }, label))

function renderGuilds(m: api.Me) {
  const list = m.guilds.length || memberGuilds(m).length
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
                  g.access === 'view' || g.access === 'manage' ? t(`access.level.${g.access}`) : '',
                ].filter(Boolean).join(' · ')),
              ),
            ),
          ),
        ),
        ...memberGuilds(m).map(memberGuildCard),
      )
    : h(
        'div',
        { class: 'card empty' },
        h('h2', {}, t('guilds.empty.title')),
        h('p', { class: 'secondary' }, t('guilds.empty.body')),
        h('a', { class: 'btn btn-discord', href: api.inviteURL }, discordLogo(), t('landing.add')),
        // The servers you own or administer come from Discord when you log in.
        refreshLine(),
      )
  page(header(m), h('main', { class: 'container' }, h('h1', {}, t('guilds.title')), list))
}

// How long the web waits for the bot to register a server it was just added to.
const connectTries = 8
const connectEvery = 1500

// After «Add to Discord», Discord sends the user here before the bot may have told the API about
// the new server: ask again for a few seconds, then open its panel.
async function renderConnecting(m: api.Me, guildID: string) {
  const card = h(
    'div',
    { class: 'card empty', 'aria-live': 'polite', 'aria-busy': 'true' },
    h('h2', {}, t('guild.connecting.title')),
  )
  page(header(m), h('main', { class: 'container' }, card))
  for (let i = 0; i < connectTries; i++) {
    await new Promise((r) => setTimeout(r, connectEvery))
    // The user may have left the page meanwhile.
    if (!location.hash.startsWith(`#/g/${guildID}`)) return
    try {
      const fresh = await api.me()
      fresh.games ??= []
      fresh.member_guilds ??= []
      me = fresh
      if (fresh.guilds.some((g) => g.discord_guild_id === guildID)) return location.replace(`#/g/${guildID}`)
    } catch {
      // Try again on the next round.
    }
  }
  card.removeAttribute('aria-busy')
  card.replaceChildren(
    h('h2', {}, t('guild.connecting.slowTitle')),
    h('p', { class: 'secondary' }, t('guild.connecting.slowBody')),
    h('a', { class: 'btn btn-outline', href: api.refreshURL(`/g/${guildID}`) }, t('me.noServer.refresh')),
  )
}

// «Your survey is paused in <server>» and the button that turns it back on, as /happyx resume does
// in Discord. Afterwards the page is drawn again without it.
function pausedNotice(g: api.GameGuild) {
  const note = h('p', { class: 'alert small', role: 'alert', hidden: true }, t('paused.failed'))
  const button = h('button', { class: 'btn', type: 'button' }, t('paused.resume'))
  button.addEventListener('click', async () => {
    button.disabled = true
    note.hidden = true
    try {
      await api.setMySurvey(g.discord_guild_id, true)
      me = null
      route()
    } catch {
      button.disabled = false
      note.hidden = false
    }
  })
  return h('div', { class: 'card paused-notice' }, h('p', {}, t('paused.text', { server: g.name })), button, note)
}

const inAnyServer = (m: api.Me) => m.guilds.length > 0 || m.games.length > 0 || memberGuilds(m).length > 0 || pausedIn(m).length > 0

const pausedIn = (m: api.Me, guildID?: string) => (m.paused_guilds ?? []).filter((g) => guildID === undefined || g.discord_guild_id === guildID)

// A member without access to the dashboard sees the server's name and its team canvas behind,
// and the way to their own answers and the game.
function renderMemberGuild(m: api.Me, g: api.GameGuild) {
  const plays = m.games.some((x) => x.discord_guild_id === g.discord_guild_id)
  page(
    header(m),
    h(
      'main',
      { class: 'container' },
      h('h1', {}, g.name),
      ...pausedIn(m, g.discord_guild_id).map(pausedNotice),
      h(
        'div',
        { class: 'card empty no-access' },
        h('h2', {}, t('guild.noAccess.title')),
        h('p', { class: 'secondary' }, t('guild.noAccess.body')),
        h(
          'p',
          { class: 'no-access-links' },
          h('a', { class: 'btn', href: '#/me' }, t('nav.me')),
          plays ? h('a', { class: 'btn', href: `#/game/${g.discord_guild_id}` }, t('signin.game.short')) : null,
        ),
      ),
    ),
  )
}

async function renderGuild(m: api.Me, guildID: string, preset: Preset, chosen = true) {
  const g = m.guilds.find((x) => x.discord_guild_id === guildID)
  if (!g) {
    const member = memberGuilds(m).find((x) => x.discord_guild_id === guildID)
    if (member) return renderMemberGuild(m, member)
    page(header(m), h('main', { class: 'container' }, h('div', { class: 'card empty' }, h('p', {}, t('guild.notFound')), h('a', { class: 'btn', href: '#/' }, t('nav.servers')))))
    return
  }
  const range = rangeFor(preset, todayIn(g.timezone))
  const body = h('div', { class: 'dashboard', 'aria-busy': 'true' }, skeleton())
  const dates = h('p', { class: 'muted' }, formatRange(range.from, range.to))
  const picker = h(
    'div',
    { class: 'segmented', role: 'navigation', 'aria-label': t('period.label') },
    ...presets.map((p) =>
      h('a', {
        href: `#/g/${guildID}?p=${p}`, ...(p === preset ? { 'aria-current': 'page' } : {}),
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
        h('div', {}, h('h1', {}, g.name), dates),
        api.canManage(g) ? h('a', { class: 'btn btn-ghost', href: `#/g/${guildID}/settings` }, icons.gear(), h('span', { class: 'gear-label' }, t('settings.link'))) : null,
      ),
      picker,
      body,
    ),
  )

  const before = previousRange(range, preset)
  let r: api.Report
  let prev: api.Report | null
  // Older APIs don't have it; the dashboard just leaves that card out.
  let health: api.Health | null
  try {
    // The period before only adds comparisons, so the dashboard still shows without it.
    ;[r, prev, health] = await Promise.all([
      api.report(guildID, range.from, range.to),
      api.report(guildID, before.from, before.to).catch(() => null),
      api.health(guildID).catch(() => null),
    ])
  } catch (err) {
    if (err instanceof api.Unauthorized) return renderLanding(null)
    body.replaceChildren(errorCard(err))
    return
  }
  // A default period without answers, when this week has some (a new server, early in the
  // month): open on this week instead.
  const thisWeek = rangeFor('this-week', todayIn(g.timezone))
  if (r.responses === 0 && !chosen && preset !== 'this-week') {
    const now = await api.report(guildID, thisWeek.from, thisWeek.to).catch(() => null)
    if (now && now.responses > 0) {
      history.replaceState(null, '', `#/g/${guildID}?p=this-week`)
      return renderGuild(m, guildID, 'this-week')
    }
  }
  body.removeAttribute('aria-busy')
  const healthSection = health ? healthCard(g, health) : null
  const extra = healthSection ? [healthSection] : []
  if (r.responses === 0 && isNewGuild(g.created_at)) {
    body.replaceChildren(firstSteps(g), ...extra)
    return
  }
  if (r.responses === 0) {
    const next = nextSurveyDay(g.timezone, g.survey_hour, g.working_days ?? [1, 2, 3, 4, 5])
    const longer = preset !== 'last-30' && preset !== 'last-90'
    body.replaceChildren(
      h(
        'div',
        { class: 'card empty' },
        h('h2', {}, t('empty.title')),
        g.survey_enabled === false
          ? h('p', { class: 'secondary' }, t('empty.off'))
          : next ? h('p', { class: 'secondary' }, t('empty.body', { day: formatDay(next, { weekday: 'long', day: 'numeric', month: 'long' }), time: `${String(g.survey_hour).padStart(2, '0')}:00` })) : null,
        longer ? h('a', { class: 'btn', href: `#/g/${guildID}?p=last-30` }, t('empty.longer')) : null,
      ),
      ...extra,
    )
    return
  }
  // With answers on fewer than 3 days there is no tone or trend yet. If they all fall in this week,
  // the dashboard opens on it, unless the period was chosen.
  const answeredDays = r.days.filter((d) => d.responses > 0)
  const few = answeredDays.length < fewDays
  if (few && !chosen && preset !== 'this-week' && answeredDays.every((d) => d.day >= thisWeek.from)) {
    history.replaceState(null, '', `#/g/${guildID}?p=this-week`)
    return renderGuild(m, guildID, 'this-week')
  }
  const old = comparable(prev) ? prev : null
  // The comparison is said once, here; the deltas below don't repeat it.
  if (old) dates.append(` · ${t('range.compared', { range: formatRange(before.from, before.to, false) })}`)
  const week = preset === 'this-week' || preset === 'last-week'
  const peaks = week ? { high: null, low: null } : extremeDays(r.days, r.average)
  const notes = [
    ...(peaks.high !== null ? [{ index: peaks.high, text: t('chart.highest', { value: formatNumber(r.days[peaks.high].average, 1) }) }] : []),
    ...(peaks.low !== null ? [{ index: peaks.low, text: t('chart.lowest', { value: formatNumber(r.days[peaks.low].average, 1) }), below: true }] : []),
  ]
  const rate = participationRate(r.participation)
  const oldRate = participationRate(old?.participation)

  const messages = messagesCard(r)
  // From a day on the chart or its table to that day's comments.
  const comments = (i: number) => messages.countOn(r.days[i].day)
  const pickDay = (i: number) => {
    messages.showDay(r.days[i].day)
    focusCard(messages.card)
  }
  const tableWrap = h('div', { class: 'table-wrap', hidden: true }, trendTable(r.days, comments, pickDay))
  const toggle = h('button', { class: 'btn btn-ghost small', type: 'button', 'aria-expanded': 'false' }, t('chart.table.show'))
  toggle.addEventListener('click', () => {
    tableWrap.hidden = !tableWrap.hidden
    toggle.setAttribute('aria-expanded', String(!tableWrap.hidden))
    toggle.textContent = t(tableWrap.hidden ? 'chart.table.show' : 'chart.table.hide')
  })
  const weekdays = weekdayAverages(r.days)
  const kudos = r.kudos ?? { count: 0, givers: 0, receivers: 0, highlights: [] }

  body.replaceChildren(
    summaryCard(r, old, week ? [] : weekdays, few),
    ...[toWatch([
      ...(health && healthSection ? [healthAlert(health, healthSection)] : []),
      lowComments(r, messages),
      rate !== null && oldRate !== null && oldRate - rate >= participationDrop && healthSection
        ? { text: t('watch.participation', { n: formatNumber(oldRate - rate) }), go: () => focusCard(healthSection) }
        : null,
    ])].filter((n): n is HTMLElement => n !== null),
    h(
      'div',
      { class: 'stats' },
      stat(t('stat.average'), h('span', {}, h('span', { class: 'stat-emoji', 'aria-hidden': 'true' }, moodEmoji(Math.round(r.average * 10) / 10)), formatNumber(r.average, 1), h('span', { class: 'stat-unit' }, ' / 5')), old ? deltaNote(r.average, old.average, 1) : moodLabel(r.average)),
      rate !== null
        ? stat(t('stat.participation'), h('span', {}, formatNumber(rate), h('span', { class: 'stat-unit' }, ' %')), oldRate !== null ? deltaNote(rate, oldRate, 0, 'delta.points') : t('stat.participation.note', { n: formatNumber(r.participation!.answered), of: formatNumber(r.participation!.recipients) }))
        : stat(t('stat.responses'), formatNumber(r.responses), old ? deltaNote(r.responses, old.responses) : undefined),
      stat(
        t('stat.respondents'),
        h('span', {}, formatNumber(r.respondents), health && health.audience > 0 ? h('span', { class: 'stat-unit' }, ` ${t('stat.of', { n: formatNumber(health.audience) })}`) : null),
        // «At least once», so «10 of 10» doesn't read as the opposite of the participation figure.
        old ? h('span', { class: 'stat-notes' }, t('stat.respondents.note'), deltaNote(r.respondents, old.respondents)) : t('stat.respondents.note'),
      ),
      stat(t('stat.kudos'), h('span', {}, h('span', { class: 'stat-emoji', 'aria-hidden': 'true' }, '💛'), formatNumber(kudos.count)), old?.kudos ? deltaNote(kudos.count, old.kudos.count) : undefined),
    ),
    h(
      'section',
      { class: 'card' },
      h('div', { class: 'card-head' }, h('h2', {}, t('chart.trend')), toggle),
      old ? h('div', { class: 'legend' }, h('span', {}, h('i', { class: 'swatch-line' }), formatRange(range.from, range.to, false)), h('span', {}, h('i', { class: 'swatch-line swatch-dashed' }), formatRange(before.from, before.to, false))) : null,
      trendChart(r.days, old?.days, notes, comments, pickDay),
      tableWrap,
    ),
    week
      ? h('section', { class: 'card' }, h('h2', {}, t('chart.distribution')), h('p', { class: 'muted small' }, answers(r.responses)), distributionChart(r))
      : h('div', { class: 'grid-2' },
          weekdayCard(weekdays),
          h('section', { class: 'card' }, h('h2', {}, t('chart.distribution')), h('p', { class: 'muted small' }, answers(r.responses)), distributionChart(r)),
        ),
    h('div', { class: 'grid-2' },
      messages.card,
      kudosCard(kudos),
    ),
    ...extra,
  )
}

// «To review»: at most three lines under the summary, from fixed rules on the team's own numbers,
// each leading to where to look. Without any, the section is left out.
type Watch = { text: string; go: () => void }

// A drop in participation of at least this many points is worth a look.
const participationDrop = 15

function toWatch(items: (Watch | null)[]) {
  const shown = items.filter((x): x is Watch => x !== null).slice(0, 3)
  if (!shown.length) return null
  return h(
    'section',
    { class: 'to-watch', 'aria-labelledby': 'to-watch-title' },
    h('h2', { id: 'to-watch-title' }, t('watch.title')),
    h(
      'ul',
      {},
      ...shown.map((w) =>
        h('li', { class: 'health-alert' }, h('span', { class: 'todo-open', 'aria-hidden': 'true' }, '○'), h('span', {}, w.text), h('a', { href: '#', onclick: (e: Event) => (e.preventDefault(), w.go()) }, `${t('health.alert.see')} →`)),
      ),
    ),
  )
}

// A server added less than 14 days ago and still without answers: what it is set to, and where
// to change it, instead of «no answers in this period». Whether the survey is on, and when it goes
// out, is in «Server status» below.
function firstSteps(g: api.Guild) {
  const settings = `#/g/${g.discord_guild_id}/settings`
  const manage = api.canManage(g)
  const hour = `${String(g.survey_hour).padStart(2, '0')}:00`
  const item = (done: boolean | null, text: string, link?: string) =>
    h('li', {}, h('span', { class: done === null ? 'todo-info' : done ? 'todo-done' : 'todo-open', 'aria-hidden': 'true' }, done === null ? icons.info() : done ? '✓' : '○'), h('span', {}, text), link && manage ? h('a', { href: settings }, `${link} →`) : null)
  const language = botLanguages.find(([code]) => code === g.language)?.[1] ?? g.language
  return h(
    'section',
    { class: 'card' },
    h('h2', {}, t('first.title')),
    h(
      'ul',
      { class: 'todo' },
      item(null, t('first.language', { language }), t('first.change')),
      item(null, t('first.time', { days: daysLabel(g.working_days ?? [1, 2, 3, 4, 5]), time: hour, timezone: g.timezone }), t('first.change')),
      item(null, t('first.assistant')),
    ),
  )
}

function focusCard(card: HTMLElement) {
  card.tabIndex = -1
  card.scrollIntoView({ block: 'start' })
  card.focus({ preventScroll: true })
}

// When the last survey didn't reach everyone, or reaches nobody: «Server status», at the bottom.
function healthAlert(x: api.Health, card: HTMLElement): Watch | null {
  const last = x.last_survey
  const text =
    x.audience === 0
      ? t('health.audience.none')
      : last && last.failed > 0
        ? t(last.failed === 1 ? 'health.alert.failed.one' : 'health.alert.failed', { n: formatNumber(last.failed), day: formatDay(last.day, { weekday: 'long' }) })
        : null
  return text ? { text, go: () => focusCard(card) } : null
}

// Comments of Bad or Awful in the period: the comments card, filtered to them.
function lowComments(r: api.Report, messages: { card: HTMLElement; show: (f: MoodFilter) => void }): Watch | null {
  const n = filterMessages(r.messages, 'low').length
  if (n === 0) return null
  return {
    text: n === 1 ? t('watch.low.one') : t('watch.low', { n: formatNumber(n) }),
    go: () => {
      messages.show('low')
      focusCard(messages.card)
    },
  }
}

// When the next survey and report go out, how the last survey went, and what is left to set up.
function healthCard(g: api.Guild, x: api.Health) {
  const days = g.working_days ?? [1, 2, 3, 4, 5]
  const next = nextSurveyDay(g.timezone, g.survey_hour, days)
  const hour = `${String(g.survey_hour).padStart(2, '0')}:00`
  const long = { weekday: 'long', day: 'numeric', month: 'short' } as const
  const tile = (label: string, value: string, note: string) =>
    h('div', { class: 'health-tile' }, h('span', { class: 'muted small' }, label), h('strong', {}, value), h('span', { class: 'muted small' }, note))
  const last = x.last_survey
  const todo: HTMLElement[] = []
  // done: ✓, false: ○ (something to do), null: · (just a fact, nothing to do).
  const item = (done: boolean | null, text: string, link?: [string, string]) =>
    h('li', {}, h('span', { class: done === null ? 'todo-info' : done ? 'todo-done' : 'todo-open', 'aria-hidden': 'true' }, done === null ? icons.info() : done ? '✓' : '○'), h('span', {}, text), link && api.canManage(g) ? h('a', { href: link[0] }, `${link[1]} →`) : null)
  const settings = `#/g/${g.discord_guild_id}/settings`
  const surveyOn = g.survey_enabled !== false
  if (!surveyOn) todo.push(item(false, t('health.survey.off'), [settings, t('health.start')]))
  todo.push(item(x.audience > 0 && surveyOn ? true : x.audience > 0 ? null : false, x.audience > 0 ? t(surveyOn ? 'health.audience' : 'health.audience.off', { n: formatNumber(x.audience) }) : t('health.audience.none'), x.audience > 0 ? undefined : [settings, t('health.review')]))
  if (x.opted_out > 0) todo.push(item(null, x.opted_out === 1 ? t('health.optedOut.one') : t('health.optedOut', { n: formatNumber(x.opted_out) })))
  const away = x.on_vacation ?? 0
  if (away > 0) todo.push(item(null, away === 1 ? t('health.onVacation.one') : t('health.onVacation', { n: formatNumber(away) })))
  todo.push(item(g.games_enabled, t(!g.games_enabled ? 'health.game.off' : surveyOn ? 'health.game.on' : 'health.game.web'), g.games_enabled ? undefined : [settings, t('health.turnOn')]))
  return h(
    'section',
    { class: 'card' },
    h('h2', {}, t('health.title')),
    h(
      'div',
      { class: 'health' },
      tile(t('health.nextSurvey'), !surveyOn ? t('health.survey.offShort') : next ? `${formatDay(next, long)}, ${hour}` : t('health.noDays'), surveyOn ? g.timezone : t('health.survey.offNote')),
      tile(
        t('health.lastSurvey'),
        last ? t('health.sent', { n: formatNumber(last.recipients - last.failed), of: formatNumber(last.recipients) }) : t(isNewGuild(g.created_at) ? 'health.none.yet' : 'health.none'),
        last ? `${formatDay(last.day, long)} · ${last.failed === 0 ? t('health.noFailures') : t(last.failed === 1 ? 'health.failed.one' : 'health.failed', { n: formatNumber(last.failed) })}` : '',
      ),
      // Without answers there is no report to send, so while the survey is off there is no date.
      surveyOn
        ? tile(t('health.nextReport'), formatDay(nextReportDay(g.report_frequency, g.timezone), long), t(g.report_dm === false ? 'health.report.web' : 'health.report.dm'))
        : tile(t('health.nextReport'), t('health.report.none'), t('health.survey.offNote')),
    ),
    h('ul', { class: 'todo' }, ...todo),
  )
}

// Below this many days with answers, the dashboard gives no tone or trend.
const fewDays = 3

// The period in a few words: the tone as the title, then only what the numbers below don't
// say (how the average moved, and the weekday that costs the most).
function summaryCard(r: api.Report, old: api.Report | null, weekdays: WeekdayStat[], few = false) {
  if (few) return h('section', { class: 'card summary' }, h('div', {}, h('p', { class: 'secondary' }, t('summary.few', { n: fewDays }))))
  const parts: string[] = []
  if (old) {
    const d = delta(r.average, old.average, 1)
    parts.push(d.trend === 'flat' ? t('summary.avg.same') : t(d.trend === 'up' ? 'summary.avg.up' : 'summary.avg.down', { delta: formatNumber(Math.abs(d.value), 1) }))
  }
  const low = lowestWeekday(weekdays)
  if (low) parts.push(t('summary.lowDay', { day: weekdayPlural(low.day), avg: formatNumber(low.average, 1) }))
  return h(
    'section',
    { class: 'card summary' },
    h('div', {}, h('h2', {}, t(`summary.tone.${tone(r.average)}`)), parts.length ? h('p', { class: 'secondary' }, parts.join(' ')) : null),
  )
}

// «▲ +0,3», coloured by direction. The header says what it compares with.
function deltaNote(now: number, before: number, digits = 0, unit: 'delta.vs' | 'delta.points' = 'delta.vs') {
  const d = delta(now, before, digits)
  const sign = d.value > 0 ? '+' : d.value < 0 ? '−' : ''
  const arrow = d.trend === 'up' ? '▲ ' : d.trend === 'down' ? '▼ ' : '= '
  const amount = t(unit === 'delta.points' ? 'delta.sr.points' : 'delta.vs', { value: formatNumber(Math.abs(d.value), digits) })
  // Screen readers get the change in words instead of «▼ −0,2».
  const spoken = d.trend === 'flat' ? t('delta.sr.same') : t(d.trend === 'up' ? 'delta.sr.up' : 'delta.sr.down', { value: amount })
  return h(
    'span',
    { class: `delta delta-${d.trend}` },
    h('span', { 'aria-hidden': 'true' }, arrow, d.trend === 'flat' ? t('delta.same') : t(unit, { value: `${sign}${formatNumber(Math.abs(d.value), digits)}` })),
    h('span', { class: 'sr-only' }, spoken),
  )
}

function weekdayCard(stats: WeekdayStat[]) {
  const low = lowestWeekday(stats)
  const high = highestWeekday(stats)
  const desc = low && high
    ? t('weekday.desc', { low: weekdayPlural(low.day), lowAvg: formatNumber(low.average, 1), high: weekdayPlural(high.day), highAvg: formatNumber(high.average, 1) })
    : t('weekday.flat')
  return h(
    'section',
    { class: 'card' },
    h('h2', {}, t('weekday.title')),
    stats.length < 2 ? null : h('p', { class: 'muted small' }, desc),
    stats.length < 2
      ? h('p', { class: 'muted' }, t('weekday.few'))
      : h(
          'div',
          { class: 'bars', role: 'list' },
          ...stats.map((w) =>
            h(
              'div',
              { class: 'bar-row', role: 'listitem', title: `${formatDay(w.day, { weekday: 'long' })}: ${formatNumber(w.average, 1)} · ${answers(w.responses)}` },
              h('span', { class: 'bar-label' }, capitalize(formatDay(w.day, { weekday: 'long' }))),
              h('span', { class: 'bar-track' }, fill(((w.average - 1) / 4) * 100, w === low)),
              h('span', { class: 'bar-value' }, `${moodEmoji(w.average)} ${formatNumber(w.average, 1)}`),
            ),
          ),
        ),
  )
}

// Widths go through CSSOM: the CSP forbids inline style attributes.
function fill(pct: number, warm = false) {
  const el = h('span', { class: warm ? 'bar bar-warm' : 'bar' })
  el.style.width = `${Math.max(2, pct)}%`
  return el
}

function kudosCard(k: api.KudosSummary) {
  return h(
    'section',
    { class: 'card' },
    h('h2', {}, t('kudos.title')),
    k.count === 0
      ? h('p', { class: 'muted' }, t('kudos.empty'))
      : h('p', { class: 'muted small' }, t('kudos.counts', { givers: formatNumber(k.givers), receivers: formatNumber(k.receivers) })),
    k.top_receivers?.length
      ? h(
          'div',
          { class: 'bars', role: 'list', 'aria-label': t('kudos.top') },
          ...k.top_receivers.map((x) =>
            h(
              'div',
              { class: 'bar-row', role: 'listitem' },
              h('span', { class: 'bar-label' }, x.username || '?'),
              h('span', { class: 'bar-track' }, fill((x.count / k.top_receivers![0].count) * 100)),
              h('span', { class: 'bar-value' }, formatNumber(x.count)),
            ),
          ),
        )
      : null,
    ...k.highlights.map((x) => {
      const kudo = h(
        'figure',
        { class: 'kudo' },
        h('blockquote', {}, `«${x.message}»`),
        h('figcaption', { class: 'muted small' }, `${x.from_username || '?'} → ${x.to_username || '?'} · ${formatDay(x.day, { weekday: 'short', day: 'numeric', month: 'short' })}`),
      )
      kudo.addEventListener('click', (e) => confetti(e.clientX, e.clientY))
      return kudo
    }),
  )
}

// Whether the viewer has no answer in the last 12 months. data is the period already loaded.
async function neverAnswered(period: EvolutionPeriod, data: api.MyMoods) {
  if (period === 'year') return data.guilds.every((g) => g.responses === 0)
  const year = evolutionRange('year', todayIn(Intl.DateTimeFormat().resolvedOptions().timeZone))
  try {
    return (await api.myMoods(year.from, year.to)).guilds.every((g) => g.responses === 0)
  } catch {
    return false
  }
}

// «My evolution» for someone without HappyX on any server: what's missing, and the way to add it.
// Admins add it; everyone else asks an admin, and can look at the demo meanwhile.
function noServerCard() {
  return h(
    'div',
    { class: 'card empty' },
    h('h2', {}, t('me.noServer.title')),
    h('p', { class: 'secondary' }, t('me.noServer.body')),
    h(
      'div',
      { class: 'empty-choices' },
      h(
        'div',
        { class: 'empty-choice' },
        h('p', {}, h('strong', {}, t('me.noServer.admin'))),
        h('a', { class: 'btn btn-discord', href: api.inviteURL }, discordLogo(), t('landing.add')),
        refreshLine('/me', t('me.noServer.refresh')),
      ),
      h(
        'div',
        { class: 'empty-choice' },
        h('p', {}, h('strong', {}, t('me.noServer.member')), ' ', t('me.noServer.ask')),
        h('a', { class: 'btn btn-outline', href: '/demo' }, t('landing.demo')),
      ),
    ),
  )
}

// «My evolution» without answers, when the survey is off in every server the viewer manages and
// they get it from no other server: it says so instead of «the survey reaches you», and leads to
// where it starts.
function surveyOffCard(m: api.Me) {
  if (api.isDemo || m.guilds.length === 0 || memberGuilds(m).length > 0 || m.guilds.some((g) => g.survey_enabled !== false)) return null
  const one = m.guilds.length === 1 ? m.guilds[0] : null
  const start = one && api.canManage(one) ? h('a', { class: 'btn', href: `#/g/${one.discord_guild_id}/settings` }, t('health.start')) : !one ? h('a', { class: 'btn', href: '#/' }, t('nav.servers')) : null
  return h(
    'div',
    { class: 'card empty' },
    h('h2', {}, one ? t('me.off.title', { server: one.name }) : t('me.off.title.many')),
    h('p', { class: 'secondary' }, t(one && !api.canManage(one) ? 'me.off.body.ask' : 'me.off.body')),
    start,
  )
}

async function renderMe(m: api.Me, period: EvolutionPeriod, filter: string | null) {
  const range = evolutionRange(period, todayIn(Intl.DateTimeFormat().resolvedOptions().timeZone))
  const href = (p: EvolutionPeriod, g: string | null) => `#/me?p=${p}${g ? `&g=${g}` : ''}`
  const body = h('div', { class: 'dashboard', 'aria-busy': 'true' }, skeleton())
  const myGamesSlot = h('div', { class: 'dashboard' })
  // Your game score is extra: if it fails to load, the rest of the page still works.
  api
    .myGames(range.from, range.to)
    .then((r) => {
      const played = r.guilds.filter((g) => g.weeks.some((w) => w.guesses > 0))
      myGamesSlot.replaceChildren(...played.map((g) => myGamesCard(g, played.length > 1)))
    })
    .catch(() => {})
  const dates = h('p', { class: 'me-dates' }, formatRange(range.from, range.to))
  const periods = h(
    'div',
    { class: 'segmented', role: 'navigation', 'aria-label': t('me.period.label') },
    ...evolutionPeriods.map((p) =>
      h('a', { href: href(p, filter), ...(p === period ? { 'aria-current': 'page' } : {}), class: p === period ? 'seg seg-on' : 'seg' }, t(`me.period.${p}`)),
    ),
  )
  page(
    header(m, 'me'),
    h(
      'main',
      { class: 'container' },
      h('div', {}, h('h1', {}, t('nav.me')), h('p', { class: 'muted privacy-note' }, icons.lock(), t('me.subtitle')), dates),
      ...pausedIn(m).map(pausedNotice),
      periods,
      body,
      // Vacations are for people in a server with HappyX, not for someone who has none yet.
      myGamesSlot,
      inAnyServer(m) ? myVacationCard(() => renderLanding(null)) : null,
    ),
  )

  let data: api.MyMoods
  try {
    data = await api.myMoods(range.from, range.to)
  } catch (err) {
    if (err instanceof api.Unauthorized) return renderLanding(null)
    body.replaceChildren(errorCard(err))
    return
  }
  body.removeAttribute('aria-busy')
  if (data.guilds.every((g) => g.responses === 0)) {
    // Someone with no server to manage or play in, and no answer in the last year, most likely
    // has no server with HappyX: say how to add it instead.
    const noServer = !api.isDemo && m.guilds.length === 0 && m.games.length === 0 && memberGuilds(m).length === 0 && (await neverAnswered(period, data))
    // Without a single answer, the period and its dates say nothing.
    if (noServer) {
      dates.remove()
      periods.remove()
    }
    body.replaceChildren(noServer ? noServerCard() : surveyOffCard(m) ?? h('div', { class: 'card empty' }, h('h2', {}, t('me.empty.title')), h('p', { class: 'secondary' }, t('me.empty.body'))))
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
    weekLines: !pts.byWeek,
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
        h('span', { class: g.streak > 0 ? 'streak streak-on' : 'streak' }, streak),
      ),
    ),
    // Older APIs don't say whether the server is anonymous: then the line is left out.
    g.anonymous === undefined
      ? null
      : h('p', { class: 'muted small' }, icons.inline(g.anonymous ? icons.lock : icons.eye), t(g.anonymous ? 'me.mode.anonymous' : 'me.mode.named')),
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
  const back = h('a', { class: 'back', href: `#/g/${guildID}` }, `← ${t('settings.back')}`)
  if (!api.canManage(g)) {
    page(header(m), h('main', { class: 'container narrow' }, back, h('h1', {}, g.name), h('div', { class: 'card' }, h('p', {}, t('settings.readonly')))))
    return
  }
  // Who has access, the server export and deleting it are for owners only. The demo can show who
  // has access, but has nothing to export or delete.
  const owner = api.isOwner(g)
  const real = owner && !api.isDemo
  const onSaved = (updated: api.Guild) => {
    const before = m.guilds.find((x) => x.discord_guild_id === updated.discord_guild_id)
    m.guilds = m.guilds.map((x) => (x.discord_guild_id === updated.discord_guild_id ? { ...updated, access: x.access } : x))
    if (before?.canvas_enabled !== updated.canvas_enabled) reloadCanvas()
  }
  const sections: [label: string, card: HTMLElement | null][] = [
    [t('settings.title'), settingsForm(g, onSaved, () => renderLanding(null))],
    [t('survey.title'), surveyMessageCard(g, onSaved, () => renderLanding(null), m.user)],
    [t('surveyRoles.title'), surveyRolesCard(g, onSaved, () => renderLanding(null))],
    [t('vacation.title'), guildVacationsCard(g, () => renderLanding(null))],
    [t('access.title'), owner ? accessCard(g, () => refreshAfterHandover(guildID), () => renderLanding(null)) : null],
    [t('export.title'), real ? guildExport(g, () => renderLanding(null)) : null],
    [
      t('danger.title'),
      real
        ? dangerZone(
            g,
            () => {
              m.guilds = m.guilds.filter((x) => x.discord_guild_id !== guildID)
              renderDeleted(m, g.name)
            },
            () => renderLanding(null),
          )
        : null,
    ],
  ]
  const cards = sections.flatMap(([label, card], i) => (card ? [{ label, card, id: `section-${i}` }] : []))
  cards.forEach((c) => {
    c.card.id ||= c.id
    // The section list moves focus to the card it scrolls to, so Tab carries on from there.
    c.card.tabIndex = -1
  })
  unsavedCards = () => cards.filter((c) => c.card.isConnected && c.card.querySelector('[data-dirty="true"]')).map((c) => c.label)
  page(
    header(m),
    h(
      'main',
      { class: 'container settings-page' },
      h(
        'div',
        { class: 'settings-layout' },
        h('div', { class: 'settings-head' }, back, h('h1', {}, g.name), h('p', { class: 'muted' }, t('settings.assistant'))),
        sectionNav(cards),
        h('div', { class: 'settings-sections' }, ...cards.map((c) => c.card)),
      ),
    ),
  )
}

// sectionNav lists the settings cards beside them on a wide screen and above them on a phone.
// The links scroll instead of changing the hash, which the router owns, and the one being read
// is highlighted as the page scrolls.
function sectionNav(cards: { label: string; card: HTMLElement }[]): HTMLElement {
  const links = cards.map(({ label, card }) =>
    // Only the danger zone's link is red; owners alone have it, and the demo doesn't.
    h('button', { class: label === t('danger.title') ? 'section-link section-danger' : 'section-link', type: 'button', onclick: () => { card.scrollIntoView({ block: 'start' }); card.focus({ preventScroll: true }); pinned = cards.findIndex((c) => c.card === card); mark(pinned) } }, label),
  )
  let pinned = -1
  const nav = h('nav', { class: 'settings-nav', 'aria-label': t('settings.sections') }, ...links)
  const mark = (i: number) => links.forEach((l, j) => (j === i ? l.setAttribute('aria-current', 'true') : l.removeAttribute('aria-current')))
  mark(0)
  const visible = new Set<Element>()
  const spy = new IntersectionObserver(
    (entries) => {
      if (!nav.isConnected) return spy.disconnect()
      for (const e of entries) (e.isIntersecting ? visible.add(e.target) : visible.delete(e.target))
      // A clicked link stays marked until the user scrolls on their own.
      if (pinned >= 0) return
      const atBottom = innerHeight + scrollY >= document.documentElement.scrollHeight - 4
      const i = atBottom ? cards.length - 1 : cards.findIndex((c) => visible.has(c.card))
      if (i >= 0) mark(i)
    },
    { rootMargin: '-80px 0px -55% 0px' },
  )
  cards.forEach((c) => spy.observe(c.card))
  addEventListener('wheel', () => (pinned = -1), { passive: true })
  addEventListener('touchmove', () => (pinned = -1), { passive: true })
  return nav
}

// refreshAfterHandover reloads what the user can do once they gave the main admin to someone
// else, and leaves the page if they can no longer manage the server.
async function refreshAfterHandover(guildID: string) {
  try {
    me = await api.me()
  } catch (err) {
    if (err instanceof api.Unauthorized) return renderLanding(null)
    return
  }
  const g = me.guilds.find((x) => x.discord_guild_id === guildID)
  if (!g) location.hash = '#/'
  else if (!api.isOwner(g)) route()
}

function renderDeleted(m: api.Me, name: string) {
  page(
    header(m),
    h(
      'main',
      { class: 'container narrow' },
      h(
        'div',
        { class: 'card empty' },
        h('h1', {}, t('danger.done.title')),
        h('p', {}, t('danger.done.body', { name })),
        h('a', { class: 'btn', href: '#/' }, t('nav.servers')),
      ),
    ),
  )
}

function renderPrivacy(m: api.Me) {
  page(
    header(m, 'privacy'),
    h(
      'main',
      { class: 'container narrow' },
      h('div', {}, h('h1', {}, t('privacy.title')), h('p', { class: 'muted' }, t('privacy.subtitle'))),
      ...privacyPage(m, () => renderErased(m), () => renderLanding(null)),
    ),
  )
}

// A legal page (privacy policy, terms): with the dashboard's top bar when logged in, the
// landing's otherwise.
// A logged-out visitor who follows a link into the app (the bot's game link, say) is asked to log
// in, and comes back to the same page afterwards. Other routes show the landing page.
function signInReason(path: string) {
  if (/^\/g\/\d+(\/settings)?$/.test(path)) return t('signin.guild')
  if (/^\/game\/\d+$/.test(path) || path === '/games') return t('signin.game')
  if (path === '/me') return t('signin.me')
  if (path === '/privacy') return t('signin.privacy')
  return null
}

function renderSignIn(path: string, reason: string) {
  me = null
  page(
    h('header', { class: 'topbar' }, brand(), h('div', { class: 'user' }, themeToggle(), languagePicker(true))),
    h(
      'main',
      { class: 'container narrow' },
      h(
        'div',
        { class: 'card signin' },
        h('h1', {}, reason),
        h('p', {}, h('a', { class: 'btn btn-discord', href: `${api.loginURL}?next=${encodeURIComponent(path)}` }, discordLogo(), t('landing.login'))),
      ),
    ),
    landingFooter(),
  )
}

function renderLegal(m: api.Me | null, content: HTMLElement[]) {
  if (!m) me = null
  const enter = m
    ? h('a', { class: 'btn btn-ghost', href: '#/' }, t('landing.dashboard'))
    : h('a', { class: 'btn btn-ghost', href: api.loginURL }, t('landing.login'))
  page(
    m ? header(m, 'none') : h('header', { class: 'topbar' }, brand(), h('div', { class: 'user' }, themeToggle(), languagePicker(true), enter)),
    h('main', { class: 'container narrow policy' }, ...content),
    m ? null : landingFooter(),
  )
}

function renderErased(m: api.Me) {
  m.games = []
  page(
    header(m, 'privacy'),
    h(
      'main',
      { class: 'container narrow' },
      h(
        'div',
        { class: 'card empty' },
        h('h1', {}, t('privacy.erased.title')),
        h('p', {}, t('privacy.erased.body')),
        h('a', { class: 'btn', href: '#/me' }, t('nav.me')),
      ),
    ),
  )
}

function renderGames(m: api.Me) {
  const list = m.games.length
    ? h(
        'ul',
        { class: 'guild-list' },
        ...m.games.map((g) =>
          h(
            'li',
            {},
            h(
              'a',
              { class: 'card guild-card', href: `#/game/${g.discord_guild_id}` },
              h('span', { class: 'guild-icon', 'aria-hidden': 'true' }, g.name.slice(0, 1).toUpperCase()),
              h('span', { class: 'guild-text' }, h('strong', {}, g.name), h('span', { class: 'muted small' }, t('game.title'))),
            ),
          ),
        ),
      )
    : h('div', { class: 'card empty' }, h('p', {}, t('games.empty')))
  page(header(m, 'games'), h('main', { class: 'container' }, h('h1', {}, t(m.games.length ? 'games.title' : 'game.title')), list))
}

async function renderGame(m: api.Me, guildID: string, toHistory = false) {
  const name = m.games.find((g) => g.discord_guild_id === guildID)?.name ?? ''
  const body = h('div', { class: 'dashboard', 'aria-busy': 'true' }, skeleton())
  const subtitle = h('p', { class: 'muted' }, name ? t('game.subtitle', { guild: name }) : '')
  page(
    header(m, 'games'),
    h(
      'main',
      { class: 'container game-page' },
      m.games.length > 1 ? h('a', { class: 'back', href: '#/games' }, `← ${t('games.title')}`) : null,
      h('div', {}, h('h1', {}, t('game.title')), subtitle),
      body,
    ),
  )
  let board: api.GameBoard
  try {
    board = await api.game(guildID)
  } catch (err) {
    if (err instanceof api.Unauthorized) return renderLanding(null)
    if (err instanceof api.NotFound) {
      body.replaceChildren(h('div', { class: 'card empty' }, h('p', {}, t('game.notFound')), h('a', { class: 'btn', href: '#/me' }, t('nav.me'))))
      body.removeAttribute('aria-busy')
      return
    }
    body.replaceChildren(errorCard(err))
    return
  }
  subtitle.textContent = t('game.subtitle', { guild: board.name })
  body.removeAttribute('aria-busy')
  body.replaceChildren(...gamePage(board, () => renderLanding(null)))
  if (toHistory) document.getElementById('history')?.scrollIntoView()
}

function stat(label: string, value: Node | string, note?: Node | string) {
  // A description list, so screen readers pair each figure with its name.
  return h('dl', { class: 'card stat' }, h('dt', { class: 'stat-label' }, label), h('dd', { class: 'stat-value' }, value), note ? h('dd', { class: 'muted small' }, note) : null)
}

function messagesCard(r: api.Report) {
  const list = h('ul', { class: 'messages' })
  let current: MoodFilter = 'all'
  // A day picked on the chart or its table: only its comments, whatever the mood.
  let day: string | null = null
  let all = false
  const counts = Object.fromEntries(moodFilters.map((f) => [f, filterMessages(r.messages, f).length])) as Record<MoodFilter, number>
  const chips = h('div', { class: 'chips', role: 'group', 'aria-label': t('messages.filter') })
  const more = h('button', { class: 'btn btn-ghost small more-btn', type: 'button' })
  more.addEventListener('click', () => {
    all = true
    draw()
  })
  const draw = () => {
    const matching = [...(day ? r.messages.filter((msg) => msg.day === day) : filterMessages(r.messages, current))].reverse()
    const shown = all ? matching : matching.slice(0, 8)
    more.hidden = shown.length === matching.length
    more.textContent = t('messages.more', { n: formatNumber(matching.length) })
    list.replaceChildren(
      ...(shown.length
        ? shown.map((msg) =>
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
          )
        : [h('li', { class: 'muted' }, t(r.messages.length ? 'messages.filter.none' : 'messages.empty'))]),
    )
    chips.replaceChildren(
      ...moodFilters.filter((f) => f === 'all' || counts[f] > 0).map((f) => {
        const on = !day && f === current
        const b = h('button', { type: 'button', 'aria-pressed': String(on), class: on ? 'chip chip-on' : 'chip' }, `${t(`messages.filter.${f}`)} · ${formatNumber(counts[f])}`)
        b.addEventListener('click', () => {
          current = f
          day = null
          all = false
          draw()
        })
        return b
      }),
      ...(day ? [h('button', { type: 'button', 'aria-pressed': 'true', class: 'chip chip-on' }, `${formatDay(day, { weekday: 'short', day: 'numeric', month: 'short' })} · ${formatNumber(matching.length)}`)] : []),
    )
  }
  draw()
  const show = (f: MoodFilter) => {
    current = f
    day = null
    all = false
    draw()
  }
  const showDay = (d: string) => {
    day = d
    all = true
    draw()
  }
  const countOn = (d: string) => r.messages.filter((msg) => msg.day === d).length
  const card = h(
    'section',
    { class: 'card' },
    h('h2', {}, t('messages.title')),
    r.anonymous
      ? h('p', { class: 'muted small privacy-note' }, icons.lock(), t('messages.anonymous'))
      : r.messages.some((m) => !m.username)
        ? h('p', { class: 'muted small privacy-note' }, icons.lock(), t('messages.earlier_anonymous'))
        : null,
    r.messages.length > 0 ? chips : null,
    list,
    more,
  )
  return { card, show, showDay, countOn }
}

function skeleton() {
  return h('div', { class: 'skeleton' }, h('div', { class: 'sk-row' }, ...[0, 1, 2, 3].map(() => h('div', { class: 'sk sk-stats' }))), h('div', { class: 'sk sk-chart' }))
}

function errorCard(err: unknown) {
  console.error(err)
  return h(
    'div',
    { class: 'card empty', role: 'alert' },
    h('h2', {}, t('error.generic')),
    h('button', { class: 'btn btn-primary', type: 'button', onclick: () => route() }, t('error.retry')),
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

// Each settings card has its own Save button, so leaving the page with changes in one asks first.
let unsavedCards: () => string[] = () => []
let shownURL = location.href
window.addEventListener('hashchange', () => {
  const dirty = unsavedCards()
  if (dirty.length && !confirm(t('settings.leave', { cards: dirty.join(', ') }))) {
    history.replaceState(null, '', shownURL)
    return
  }
  shownURL = location.href
  route()
})
window.addEventListener('beforeunload', (e) => {
  if (unsavedCards().length) e.preventDefault()
})
route()

const capitalize = (x: string) => x.charAt(0).toLocaleUpperCase() + x.slice(1)

// myGamesCard is your own «Who's who?» score in one server, for the period picked above. The
// bars only show from three rounds on: with fewer, the total says it all.
function myGamesCard(g: api.MyGames['guilds'][number], many: boolean) {
  const { weeks, correct, guesses, bars: recent } = gameTotals(g.weeks)
  const list = recent.length === 0 ? null : h(
    'ol',
    { class: 'mygames-bars' },
    ...recent.map((w) => {
      const day = formatDay(w.week, { day: 'numeric', month: 'short' })
      const score = t('game.history.score', { correct: w.correct, guesses: w.guesses })
      const fill = h('span', { class: 'mygames-fill' })
      // A sliver even at 0, so a round with no right guesses still shows as played.
      fill.style.height = `${Math.max(4, share(w.correct, w.guesses))}%`
      return h('li', {}, h('span', { class: 'sr-only' }, `${day}: ${score}`), h('span', { class: 'mygames-col', 'aria-hidden': 'true' }, fill), h('span', { class: 'small mygames-score', 'aria-hidden': 'true' }, score), h('span', { class: 'muted small', 'aria-hidden': 'true' }, day))
    }),
  )
  // A long period shows only the latest rounds: say so, so the bars don't read as all of them.
  const bars = list && (recent.length < weeks.length ? h('div', { class: 'mygames-recent' }, h('p', { class: 'muted small' }, t('me.games.bars', { n: recent.length })), list) : list)
  return h(
    'section',
    { class: 'card mygames' },
    h('h2', {}, many ? t('me.games.title.guild', { guild: g.name }) : t('me.games.title')),
    h('div', { class: bars ? 'mygames-body' : 'mygames-body mygames-solo' }, h('div', { class: 'mygames-total' }, h('strong', { class: 'stat-value' }, t('me.games.total', { correct, guesses })), h('span', { class: 'muted small' }, weeks.length === 1 ? t('me.games.rounds.one') : t('me.games.rounds', { n: weeks.length })), h('a', { href: `#/game/${g.discord_guild_id}?history`, class: 'small' }, `${t('me.games.link')} →`)), bars),
  )
}
