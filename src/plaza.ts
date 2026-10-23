// The server's square: a shared map where the members who have this page open walk around as
// their Discord avatar and greet each other. The API is authoritative and sends positions 20
// times a second; this page only sends what was pressed and smooths the movement in between.

import { avatarURL } from './api'
import { h } from './dom'
import { t, type Key } from './i18n'
import { launchGame, type GameView, type LaunchHandle, type Office, type Person } from './launch'

export interface Obstacle {
  kind: 'fountain' | 'bench' | 'tree' | string
  x: number
  y: number
  w: number
  h: number
}

export interface World {
  w: number
  h: number
  radius: number
  obstacles: Obstacle[]
}

interface PlayerMsg {
  id: string
  name: string
  avatar?: string
  color: number
  x: number
  y: number
  host?: boolean
}

type ServerMsg =
  | { t: 'welcome'; you: string; world: World; players: PlayerMsg[] }
  | { t: 'join'; player: PlayerMsg }
  | { t: 'leave'; id: string }
  | { t: 'state'; p: { id: string; x: number; y: number }[] }
  | { t: 'emote'; id: string; e: Emote }
  | { t: 'high_five'; a: string; b: string }
  | { t: 'game_start'; map: Office; players: string[] }
  | GameView
  | { t: 'game_end' }
  | { t: 'error'; code: string }

export const emotes = ['wave', 'clap', 'laugh', 'heart', 'coffee', 'highfive'] as const
export type Emote = (typeof emotes)[number]

export const emoteIcon: Record<Emote, string> = { wave: '👋', clap: '👏', laugh: '😂', heart: '❤️', coffee: '☕', highfive: '🙌' }

// Avatar rings, picked by the API from the user ID. They read on both themes.
export const ringColors = ['#2a78d6', '#d6582a', '#2a9d5c', '#a347c8', '#d6a12a', '#d63a6f', '#1f9aa8', '#6b7280']

// keyVector turns the keys held into the direction the API expects: -1, 0 or 1 on each axis.
export function keyVector(keys: Set<string>): [number, number] {
  const has = (...ks: string[]) => ks.some((k) => keys.has(k))
  const dx = (has('ArrowRight', 'd') ? 1 : 0) - (has('ArrowLeft', 'a') ? 1 : 0)
  const dy = (has('ArrowDown', 's') ? 1 : 0) - (has('ArrowUp', 'w') ? 1 : 0)
  return [dx, dy]
}

// toWorld maps a point on the canvas, in CSS pixels, to world units.
export function toWorld(px: number, py: number, rect: { width: number; height: number }, world: { w: number; h: number }): [number, number] {
  return [(px / rect.width) * world.w, (py / rect.height) * world.h]
}

// approach moves a drawn position toward the server's, so 20 updates a second look smooth.
// Far jumps (a reconnect, a respawn) snap instead of gliding across the map.
export function approach(from: number, to: number, dt: number): number {
  if (Math.abs(to - from) > 120) return to
  return from + (to - from) * Math.min(1, dt * 15)
}

// uiScale enlarges avatars and names when the square is drawn small, as on a phone, so they
// stay readable; cssScale is CSS pixels per world unit.
export function uiScale(cssScale: number): number {
  return Math.min(2, Math.max(1, 0.75 / cssScale))
}

// easeOutBack overshoots a little before settling, for the emote bubbles' pop.
export function easeOutBack(x: number): number {
  const c = 1.70158
  return 1 + (c + 1) * (x - 1) ** 3 + c * (x - 1) ** 2
}

// mulberry32 is a tiny seeded random generator, so the grass looks the same for everyone.
export function mulberry32(seed: number): () => number {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let x = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296
  }
}

// Close codes from the API.
export const closedElsewhere = 4000

// The layout the API's obstacles sit on. Only obstacles block; the rest is decoration.
const pathWidth = 72
const discRadius = 170

interface Avatar {
  id: string
  name: string
  color: string
  img: HTMLImageElement
  x: number
  y: number
  tx: number
  ty: number
  emote?: { icon: string; at: number }
  burst?: number // when a high five rang around them
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  color: string
  at: number
}

const emoteMs = 2200
const confettiMs = 700
const burstMs = 400

export interface PlazaHandle {
  element: HTMLElement
  destroy: () => void
}

export function plaza(guildID: string, myID: string): PlazaHandle {
  const canvas = h('canvas', { class: 'plaza-canvas', tabindex: 0, role: 'img', 'aria-label': t('plaza.canvas') })
  const statusText = h('span', {}, t('plaza.connecting'))
  const status = h('p', { class: 'plaza-status small', role: 'status' }, h('span', { class: 'plaza-dot', 'aria-hidden': 'true' }), statusText)
  const peopleTitle = h('h2', {}, t('plaza.people', { n: 0 }))
  const people = h('ul', { class: 'plaza-people' })
  const copyButton = h('button', { class: 'btn btn-ghost small', type: 'button', hidden: true, onclick: () => copyLink() }, `🔗 ${t('plaza.copyLink')}`)
  const toast = h('p', { class: 'plaza-toast', role: 'status', hidden: true })
  const emoteButton = (e: Emote, i: number) => {
    const b = h('button', {
      class: 'plaza-emote', type: 'button', 'data-key': i + 1, title: `${t(`plaza.emote.${e}`)} (${i + 1})`, 'aria-label': t(`plaza.emote.${e}`),
      onclick: () => sendEmote(e),
    }, emoteIcon[e])
    return b
  }
  const buttons = emotes.map(emoteButton)
  const emoteBar = h(
    'div',
    { class: 'plaza-emotes', role: 'group', 'aria-label': t('plaza.emotes') },
    ...buttons.slice(0, -1),
    h('span', { class: 'plaza-divider', 'aria-hidden': 'true' }),
    buttons.at(-1)!,
  )
  const howTo = (keys: string, action: string) => h('div', { class: 'plaza-howto-row' }, h('dt', {}, ...keys.split(' ').map((k) => h('kbd', {}, k))), h('dd', {}, action))
  const help = h(
    'details',
    { class: 'card plaza-help', open: window.matchMedia('(min-width: 900px)').matches },
    h('summary', {}, t('plaza.howto')),
    h(
      'dl',
      { class: 'plaza-howto' },
      howTo('← ↑ → ↓', t('plaza.howto.move')),
      howTo('👆', t('plaza.howto.tap')),
      howTo('1 – 6', t('plaza.howto.emote')),
      howTo('🙌', t('plaza.howto.highfive')),
    ),
  )
  const stage = h('div', { class: 'plaza-stage' }, canvas, toast)
  // The host starts «El gran lanzamiento» from here; everyone else learns it exists.
  const launchButton = h('button', { class: 'btn btn-primary', type: 'button', hidden: true, onclick: () => send({ t: 'launch' }) }, t('launch.start'))
  const launchNote = h('p', { class: 'muted small' }, t('launch.askHost'))
  const launchCard = h('section', { class: 'card plaza-launch' }, h('h2', {}, `🚀 ${t('launch.name')}`), h('p', { class: 'small' }, t('launch.pitch')), launchButton, launchNote)
  const plazaCard = h('section', { class: 'card plaza-card' }, stage, h('div', { class: 'plaza-toolbar' }, status, emoteBar))
  const main = h('div', { class: 'plaza-main' }, plazaCard)
  const element = h(
    'div',
    { class: 'plaza' },
    main,
    h('aside', { class: 'plaza-side' }, h('section', { class: 'card' }, peopleTitle, people, copyButton), launchCard, help),
  )

  let world: World | null = null
  let dots: [number, number, number][] = []
  const avatars = new Map<string, Avatar>()
  const particles: Particle[] = []
  const keys = new Set<string>()
  let lastMove: [number, number] = [0, 0]
  let ws: WebSocket | null = null
  let retries = 0
  let retryTimer = 0
  let frame = 0
  let toastTimer = 0
  let destroyed = false
  let host = false
  let game: LaunchHandle | null = null
  // Everyone seen in the square, kept while a game runs so players who drop out keep a name.
  const known = new Map<string, Person>()

  function send(msg: object) {
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg))
  }

  function sendEmote(e: Emote) {
    send({ t: 'emote', e })
    const b = buttons[emotes.indexOf(e)]
    b.classList.remove('plaza-emote-sent')
    void b.offsetWidth // restart the flash
    b.classList.add('plaza-emote-sent')
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(location.href)
      copyButton.textContent = `✓ ${t('plaza.copied')}`
    } catch {
      copyButton.textContent = location.href
    }
  }

  function avatarOf(p: PlayerMsg): Avatar {
    // Until the picture loads (or if the CDN is unreachable) the initial is drawn instead.
    const img = new Image()
    img.src = avatarURL(p.id, p.avatar, 128)
    const a = { id: p.id, name: p.name, color: ringColors[p.color % ringColors.length], img, x: p.x, y: p.y, tx: p.x, ty: p.y }
    known.set(p.id, a)
    return a
  }

  function renderLaunch() {
    launchButton.hidden = !host || game !== null
    launchButton.disabled = avatars.size < 3
    launchNote.hidden = host && avatars.size >= 3
    launchNote.textContent = host ? t('launch.needPeople') : t('launch.askHost')
    launchCard.hidden = game !== null
  }

  function startGame(office: Office) {
    game?.destroy()
    keys.clear()
    updateMove()
    game = launchGame({ office, me: myID, host, person: (id) => known.get(id), send })
    plazaCard.hidden = true
    help.hidden = true
    main.prepend(game.element)
    renderLaunch()
  }

  function endGame() {
    game?.destroy()
    game = null
    plazaCard.hidden = false
    help.hidden = false
    renderLaunch()
    resize()
  }

  function renderPeople() {
    const list = [...avatars.values()].sort((a, b) => (a.id === myID ? -1 : b.id === myID ? 1 : a.name.localeCompare(b.name)))
    people.replaceChildren(
      ...list.map((a) => {
        const pic = h('img', { class: 'plaza-person-pic', alt: '', src: a.img.src })
        pic.style.borderColor = a.color
        return h('li', { class: a.id === myID ? 'plaza-person plaza-person-me' : 'plaza-person' }, pic, h('span', {}, a.id === myID ? t('plaza.you', { name: a.name }) : a.name))
      }),
    )
    peopleTitle.textContent = t('plaza.people', { n: avatars.size })
    copyButton.hidden = avatars.size !== 1
    canvas.setAttribute('aria-label', t('plaza.canvas.count', { n: avatars.size }))
    renderLaunch()
  }

  function setStatus(text: string, live: boolean, action?: HTMLElement) {
    status.classList.toggle('plaza-live', live)
    statusText.replaceChildren(text, ...(action ? [' ', action] : []))
  }

  function showToast(text: string, mine: boolean) {
    toast.textContent = text
    toast.classList.toggle('plaza-toast-me', mine)
    toast.hidden = false
    clearTimeout(toastTimer)
    toastTimer = window.setTimeout(() => (toast.hidden = true), 3000)
  }

  function highFive(a: Avatar, b: Avatar, now: number) {
    a.burst = b.burst = now
    const mx = (a.x + b.x) / 2
    const my = (a.y + b.y) / 2 - 10
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2 + Math.random() * 0.6
      const speed = 60 + Math.random() * 60
      particles.push({ x: mx, y: my, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 60, color: i % 2 ? a.color : b.color, at: now })
    }
    if (a.id === myID || b.id === myID) showToast(t('plaza.highfive.you', { name: a.id === myID ? b.name : a.name }), true)
    else showToast(t('plaza.highfive', { a: a.name, b: b.name }), false)
  }

  function onMessage(m: ServerMsg) {
    const now = performance.now()
    switch (m.t) {
      case 'welcome':
        world = m.world
        dots = grassDots(world)
        avatars.clear()
        for (const p of m.players) avatars.set(p.id, avatarOf(p))
        host = !!m.players.find((p) => p.id === m.you)?.host
        if (game) endGame()
        setStatus(t('plaza.connected'), true)
        retries = 0
        renderPeople()
        resize()
        break
      case 'join':
        avatars.set(m.player.id, avatarOf(m.player))
        renderPeople()
        break
      case 'leave':
        avatars.delete(m.id)
        renderPeople()
        break
      case 'state':
        for (const p of m.p) {
          const a = avatars.get(p.id)
          if (a) [a.tx, a.ty] = [p.x, p.y]
        }
        break
      case 'emote': {
        const a = avatars.get(m.id)
        if (a) a.emote = { icon: emoteIcon[m.e] ?? '👋', at: now }
        break
      }
      case 'high_five': {
        const a = avatars.get(m.a)
        const b = avatars.get(m.b)
        if (a && b) highFive(a, b, now)
        break
      }
      case 'game_start':
        startGame(m.map)
        break
      case 'game':
        game?.update(m)
        break
      case 'game_end':
        endGame()
        break
      case 'error':
        showToast(t(`launch.error.${m.code}` as Key), false)
        break
    }
  }

  function connect() {
    clearTimeout(retryTimer)
    const proto = location.protocol === 'https:' ? 'wss' : 'ws'
    const sock = new WebSocket(`${proto}://${location.host}/api/web/guilds/${encodeURIComponent(guildID)}/plaza`)
    ws = sock
    setStatus(t('plaza.connecting'), false)
    sock.onmessage = (ev) => {
      try {
        onMessage(JSON.parse(ev.data as string) as ServerMsg)
      } catch {
        // A message we don't understand: ignore it rather than break the square.
      }
    }
    sock.onclose = (ev) => {
      if (destroyed || ws !== sock) return
      ws = null
      avatars.clear()
      if (game) endGame()
      renderPeople()
      if (ev.code === closedElsewhere) {
        setStatus(t('plaza.elsewhere'), false, h('button', { class: 'btn btn-ghost small', type: 'button', onclick: () => connect() }, t('plaza.comeBack')))
        return
      }
      if (retries >= 5) {
        setStatus(t('plaza.lost'), false, h('button', { class: 'btn btn-ghost small', type: 'button', onclick: () => { retries = 0; connect() } }, t('error.retry')))
        return
      }
      setStatus(t('plaza.reconnecting'), false)
      retryTimer = window.setTimeout(connect, [1000, 2000, 4000, 8000, 15000][retries++])
    }
  }

  // --- input ---

  const keyNames: Record<string, string> = { ArrowUp: 'ArrowUp', ArrowDown: 'ArrowDown', ArrowLeft: 'ArrowLeft', ArrowRight: 'ArrowRight', w: 'w', a: 'a', s: 's', d: 'd', W: 'w', A: 'a', S: 's', D: 'd' }

  function typing(e: KeyboardEvent) {
    const el = e.target as HTMLElement | null
    return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)
  }

  function updateMove() {
    const v = keyVector(keys)
    if (v[0] !== lastMove[0] || v[1] !== lastMove[1]) {
      lastMove = v
      send({ t: 'move', dx: v[0], dy: v[1] })
    }
  }

  function onKeyDown(e: KeyboardEvent) {
    if (game || typing(e) || e.metaKey || e.ctrlKey || e.altKey) return
    const k = keyNames[e.key]
    if (k) {
      e.preventDefault() // arrows would scroll the page
      keys.add(k)
      updateMove()
      return
    }
    const n = Number(e.key)
    if (n >= 1 && n <= emotes.length && !e.repeat) sendEmote(emotes[n - 1])
  }

  function onKeyUp(e: KeyboardEvent) {
    const k = keyNames[e.key]
    if (k && keys.delete(k)) updateMove()
  }

  function onBlur() {
    keys.clear()
    updateMove()
  }

  canvas.addEventListener('pointerdown', (e) => {
    if (!world) return
    const r = canvas.getBoundingClientRect()
    const [x, y] = toWorld(e.clientX - r.left, e.clientY - r.top, r, world)
    lastMove = [0, 0]
    send({ t: 'goto', x: Math.round(x), y: Math.round(y) })
  })
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  window.addEventListener('blur', onBlur)

  // --- drawing ---

  let palette = readPalette()
  // Repaint when the theme toggle flips data-theme, and when the system theme changes.
  const repaint = () => (palette = readPalette())
  const themeWatch = new MutationObserver(repaint)
  themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  const systemTheme = window.matchMedia('(prefers-color-scheme: dark)')
  systemTheme.addEventListener('change', repaint)

  const ro = new ResizeObserver(() => resize())
  ro.observe(stage)

  function resize() {
    const dpr = window.devicePixelRatio || 1
    const r = canvas.getBoundingClientRect()
    canvas.width = Math.max(1, Math.round(r.width * dpr))
    canvas.height = Math.max(1, Math.round(r.height * dpr))
  }

  let last = performance.now()
  function draw(now: number) {
    frame = requestAnimationFrame(draw)
    const dt = Math.min(0.1, (now - last) / 1000)
    last = now
    const ctx = canvas.getContext('2d')
    if (!ctx || !world || game) return
    const s = canvas.width / world.w
    ctx.setTransform(s, 0, 0, s, 0, 0)
    const k = uiScale(canvas.getBoundingClientRect().width / world.w)
    drawWorld(ctx, world, dots, palette, now)

    const list = [...avatars.values()]
    for (const a of list) {
      a.x = approach(a.x, a.tx, dt)
      a.y = approach(a.y, a.ty, dt)
    }
    // Lower avatars are drawn last, so they overlap the ones behind them.
    list.sort((p, q) => p.y - q.y)
    const r = world.radius * 1.2 * k
    for (const a of list) drawShadow(ctx, a, r)
    for (const a of list) drawAvatar(ctx, a, r, k, now)
    drawParticles(ctx, dt, now)
    if (avatars.size === 1) drawAlone(ctx, world, k)
  }

  function drawShadow(ctx: CanvasRenderingContext2D, a: Avatar, r: number) {
    const walking = Math.hypot(a.tx - a.x, a.ty - a.y) > 1
    ctx.fillStyle = palette.shadow
    ctx.beginPath()
    ctx.ellipse(a.x, a.y + r + 2, r * 0.8 * (walking ? 0.9 : 1), r * 0.3, 0, 0, Math.PI * 2)
    ctx.fill()
  }

  function drawAvatar(ctx: CanvasRenderingContext2D, a: Avatar, r: number, k: number, now: number) {
    const mine = a.id === myID
    const walking = Math.hypot(a.tx - a.x, a.ty - a.y) > 1
    const y = a.y + (walking ? -Math.abs(Math.sin(now / 90)) * 3 : Math.sin(now / 900) * 0.8)
    const x = a.x

    if (mine) {
      ctx.save()
      ctx.strokeStyle = palette.accent
      ctx.lineWidth = 2
      ctx.setLineDash([6, 5])
      ctx.lineDashOffset = -now / 40
      ctx.beginPath()
      ctx.arc(x, y, r + 10, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()
    }
    if (a.burst !== undefined && now - a.burst < burstMs) {
      const p = (now - a.burst) / burstMs
      ctx.globalAlpha = 1 - p
      ctx.strokeStyle = a.color
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.arc(x, y, r + 24 * p, 0, Math.PI * 2)
      ctx.stroke()
      ctx.globalAlpha = 1
    }
    circle(ctx, x, y, r + 5, palette.surface)
    ctx.strokeStyle = a.color
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(x, y, r + 2.5, 0, Math.PI * 2)
    ctx.stroke()
    ctx.save()
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.clip()
    if (a.img.complete && a.img.naturalWidth > 0) {
      ctx.drawImage(a.img, x - r, y - r, r * 2, r * 2)
    } else {
      ctx.fillStyle = a.color
      ctx.fillRect(x - r, y - r, r * 2, r * 2)
      ctx.fillStyle = '#fff'
      ctx.font = `600 ${r * 0.9}px system-ui, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(a.name.slice(0, 1).toUpperCase(), x, y + 1)
    }
    ctx.restore()

    // The name sits on a pill so it reads over grass and paths alike; yours is the accent one.
    const label = mine ? t('plaza.youShort') : a.name.length > 12 ? `${a.name.slice(0, 11)}…` : a.name
    ctx.font = `600 ${12 * k}px system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const tw = ctx.measureText(label).width + 14 * k
    const ly = y + r + 8 * k
    ctx.beginPath()
    ctx.roundRect(x - tw / 2, ly, tw, 18 * k, 9 * k)
    if (mine) {
      ctx.fillStyle = palette.accent
      ctx.fill()
      ctx.fillStyle = '#fff'
    } else {
      ctx.globalAlpha = 0.95
      ctx.fillStyle = palette.surface
      ctx.fill()
      ctx.globalAlpha = 1
      ctx.strokeStyle = palette.border
      ctx.lineWidth = 1
      ctx.stroke()
      ctx.fillStyle = palette.ink
    }
    ctx.fillText(label, x, ly + 9.5 * k)

    const emoting = a.emote && now - a.emote.at < emoteMs
    if (emoting) drawBubble(ctx, a.emote!, x, y - r - 26 * k, k, now)
    else if (mine) {
      // A small marker over your head, so you find yourself in a crowd.
      const my = y - r - 14 * k + Math.sin(now / 300) * 2
      ctx.fillStyle = palette.accent
      ctx.beginPath()
      ctx.moveTo(x - 4 * k, my - 6 * k)
      ctx.lineTo(x + 4 * k, my - 6 * k)
      ctx.lineTo(x, my)
      ctx.closePath()
      ctx.fill()
    }
  }

  function drawBubble(ctx: CanvasRenderingContext2D, e: { icon: string; at: number }, x: number, cy: number, k: number, now: number) {
    const age = now - e.at
    const pop = age < 180 ? easeOutBack(age / 180) * 0.4 + 0.6 : 1
    const fade = Math.min(1, (emoteMs - age) / 300)
    const rise = fade < 1 ? (1 - fade) * 6 * k : 0
    ctx.save()
    ctx.globalAlpha = Math.max(0, fade)
    ctx.translate(x, cy - rise)
    ctx.scale(pop, pop)
    const w = 34 * k
    const hh = 30 * k
    ctx.shadowColor = palette.shadow
    ctx.shadowBlur = 6
    ctx.shadowOffsetY = 2
    ctx.fillStyle = palette.surface
    ctx.beginPath()
    ctx.roundRect(-w / 2, -hh / 2, w, hh, 10 * k)
    ctx.moveTo(-6 * k, hh / 2)
    ctx.lineTo(0, hh / 2 + 6 * k)
    ctx.lineTo(6 * k, hh / 2)
    ctx.fill()
    ctx.shadowColor = 'transparent'
    ctx.strokeStyle = palette.border
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.roundRect(-w / 2, -hh / 2, w, hh, 10 * k)
    ctx.stroke()
    ctx.font = `${20 * k}px system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(e.icon, 0, 1)
    ctx.restore()
  }

  function drawParticles(ctx: CanvasRenderingContext2D, dt: number, now: number) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i]
      const age = now - p.at
      if (age > confettiMs) {
        particles.splice(i, 1)
        continue
      }
      p.vy += 200 * dt
      p.x += p.vx * dt
      p.y += p.vy * dt
      ctx.globalAlpha = 1 - age / confettiMs
      ctx.fillStyle = p.color
      ctx.fillRect(p.x - 2, p.y - 2, 4, 4)
    }
    ctx.globalAlpha = 1
  }

  function drawAlone(ctx: CanvasRenderingContext2D, w: World, k: number) {
    const title = t('plaza.alone.title')
    const body = t('plaza.alone.body')
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = `600 ${15 * k}px system-ui, sans-serif`
    const tw = Math.max(ctx.measureText(title).width, (ctx.font = `${13 * k}px system-ui, sans-serif`, ctx.measureText(body).width)) + 32 * k
    const ph = 52 * k
    const y = w.h - 60 * k - ph / 2
    ctx.globalAlpha = 0.88
    ctx.fillStyle = palette.surface
    ctx.beginPath()
    ctx.roundRect(w.w / 2 - tw / 2, y - ph / 2, tw, ph, 14 * k)
    ctx.fill()
    ctx.globalAlpha = 1
    ctx.fillStyle = palette.ink2
    ctx.font = `600 ${15 * k}px system-ui, sans-serif`
    ctx.fillText(title, w.w / 2, y - 9 * k)
    ctx.fillStyle = palette.muted
    ctx.font = `${13 * k}px system-ui, sans-serif`
    ctx.fillText(body, w.w / 2, y + 11 * k)
  }

  frame = requestAnimationFrame(draw)
  connect()

  return {
    element,
    destroy() {
      destroyed = true
      cancelAnimationFrame(frame)
      clearTimeout(retryTimer)
      clearTimeout(toastTimer)
      themeWatch.disconnect()
      systemTheme.removeEventListener('change', repaint)
      ro.disconnect()
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
      game?.destroy()
      ws?.close(1000)
      ws = null
    },
  }
}

type Palette = ReturnType<typeof readPalette>

function readPalette() {
  const css = getComputedStyle(document.documentElement)
  const v = (name: string) => css.getPropertyValue(name).trim()
  const p = (name: string) => v(`--plaza-${name}`)
  return {
    ground: p('ground'), grassDot: p('grass-dot'), path: p('path'), edge: p('edge'), tileLine: p('tile-line'),
    stone: p('stone'), stoneDark: p('stone-dark'), water: p('water'), waterLight: p('water-light'),
    tree: p('tree'), treeLight: p('tree-light'), treeDark: p('tree-dark'), bench: p('bench'), benchDark: p('bench-dark'),
    lamp: p('lamp'), lampAlpha: Number(p('lamp-alpha')) || 0.35, shadow: p('shadow'),
    ink: v('--ink'), ink2: v('--ink-2'), surface: v('--surface'), muted: v('--muted'), border: v('--border'), accent: v('--accent'),
  }
}

// grassDots scatters little tufts on the grass, the same for everyone.
function grassDots(w: World): [number, number, number][] {
  const rand = mulberry32(7)
  const out: [number, number, number][] = []
  while (out.length < 60) {
    const x = rand() * w.w
    const y = rand() * w.h
    const r = 2 + rand()
    if (onPaving(w, x, y, 8)) continue
    out.push([x, y, r])
  }
  return out
}

function onPaving(w: World, x: number, y: number, margin = 0): boolean {
  const half = pathWidth / 2 + margin
  return Math.abs(y - w.h / 2) < half || Math.abs(x - w.w / 2) < half || Math.hypot(x - w.w / 2, y - w.h / 2) < discRadius + margin
}

function pavingPath(ctx: CanvasRenderingContext2D, w: World) {
  ctx.beginPath()
  ctx.rect(0, w.h / 2 - pathWidth / 2, w.w, pathWidth)
  ctx.rect(w.w / 2 - pathWidth / 2, 0, pathWidth, w.h)
  ctx.moveTo(w.w / 2 + discRadius, w.h / 2)
  ctx.arc(w.w / 2, w.h / 2, discRadius, 0, Math.PI * 2)
}

function drawWorld(ctx: CanvasRenderingContext2D, w: World, dots: [number, number, number][], c: Palette, now: number) {
  const cx = w.w / 2
  const cy = w.h / 2
  ctx.fillStyle = c.ground
  ctx.fillRect(0, 0, w.w, w.h)
  for (const [x, y, r] of dots) circle(ctx, x, y, r, c.grassDot)

  // Paths with a kerb along their sides, and the paved square around the fountain.
  ctx.fillStyle = c.path
  ctx.fillRect(0, cy - pathWidth / 2, w.w, pathWidth)
  ctx.fillRect(cx - pathWidth / 2, 0, pathWidth, w.h)
  ctx.strokeStyle = c.edge
  ctx.lineWidth = 2
  ctx.beginPath()
  for (const d of [-1, 1]) {
    ctx.moveTo(0, cy + (d * pathWidth) / 2)
    ctx.lineTo(w.w, cy + (d * pathWidth) / 2)
    ctx.moveTo(cx + (d * pathWidth) / 2, 0)
    ctx.lineTo(cx + (d * pathWidth) / 2, w.h)
  }
  ctx.stroke()
  circle(ctx, cx, cy, discRadius, c.path)
  ctx.beginPath()
  ctx.arc(cx, cy, discRadius, 0, Math.PI * 2)
  ctx.stroke()

  // Paving tiles, only on the paved parts.
  ctx.save()
  pavingPath(ctx, w)
  ctx.clip()
  ctx.strokeStyle = c.tileLine
  ctx.lineWidth = 1
  ctx.beginPath()
  for (let x = 0; x <= w.w; x += 40) {
    ctx.moveTo(x, 0)
    ctx.lineTo(x, w.h)
  }
  for (let y = 0; y <= w.h; y += 40) {
    ctx.moveTo(0, y)
    ctx.lineTo(w.w, y)
  }
  ctx.stroke()
  ctx.restore()

  // The office entrance the team games will open onto, and planters beside it.
  ctx.fillStyle = c.stoneDark
  ctx.beginPath()
  ctx.roundRect(cx - 60, 14, 120, 20, 6)
  ctx.fill()
  ctx.fillStyle = c.surface
  ctx.font = '600 12px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('☕ HQ', cx, 24.5)
  for (const px of [cx - 200, cx + 140]) {
    ctx.fillStyle = c.tree
    ctx.strokeStyle = c.stone
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.roundRect(px, 16, 60, 18, 6)
    ctx.fill()
    ctx.stroke()
  }

  // Shadows first, so every prop stands on the ground.
  ctx.fillStyle = c.shadow
  for (const o of w.obstacles) {
    ctx.beginPath()
    ctx.ellipse(o.x + o.w / 2 + 6, o.y + o.h / 2 + 8, o.w / 2, (o.h / 2) * 0.55 + (o.kind === 'bench' ? 4 : 0), 0, 0, Math.PI * 2)
    ctx.fill()
  }

  // Lamps around the square.
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2
    const lx = cx + Math.cos(a) * (discRadius + 5)
    const ly = cy + Math.sin(a) * (discRadius + 5)
    const glow = ctx.createRadialGradient(lx, ly, 0, lx, ly, 40)
    glow.addColorStop(0, c.lamp)
    glow.addColorStop(1, 'transparent')
    ctx.globalAlpha = c.lampAlpha
    ctx.fillStyle = glow
    ctx.beginPath()
    ctx.arc(lx, ly, 40, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1
    circle(ctx, lx, ly, 6, c.stoneDark)
    circle(ctx, lx, ly, 3.5, c.lamp)
  }

  for (const o of w.obstacles) {
    const ox = o.x + o.w / 2
    const oy = o.y + o.h / 2
    if (o.kind === 'fountain') drawFountain(ctx, ox, oy, o.w / 2, c, now)
    else if (o.kind === 'tree') drawTree(ctx, ox, oy, o.w, c)
    else drawBench(ctx, o, c)
  }
}

function drawFountain(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, c: Palette, now: number) {
  circle(ctx, x, y, r, c.stone)
  ctx.strokeStyle = c.stoneDark
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.arc(x, y, r - 1.5, 0, Math.PI * 2)
  ctx.stroke()
  const water = ctx.createRadialGradient(x, y, 0, x, y, r - 12)
  water.addColorStop(0, c.waterLight)
  water.addColorStop(1, c.water)
  circle(ctx, x, y, r - 12, water)
  // Ripples spreading from the middle.
  ctx.strokeStyle = c.waterLight
  ctx.lineWidth = 1.5
  for (let i = 0; i < 2; i++) {
    const p = (now / 1800 + i / 2) % 1
    ctx.globalAlpha = 0.6 * (1 - p)
    ctx.beginPath()
    ctx.arc(x, y, 20 + p * (r - 36), 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.globalAlpha = 1
  circle(ctx, x, y, 12, c.stone)
  ctx.globalAlpha = 0.5
  circle(ctx, x - 3, y - 3, 4, c.surface)
  ctx.globalAlpha = 1
}

function drawTree(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, c: Palette) {
  ctx.strokeStyle = c.stone
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.arc(x, y, size / 2 + 6, 0, Math.PI * 2)
  ctx.stroke()
  ctx.fillStyle = c.bench
  ctx.fillRect(x - 4, y + size * 0.38, 8, 10)
  circle(ctx, x, y, (size / 2) * 0.9, c.tree)
  ctx.strokeStyle = c.treeDark
  ctx.lineWidth = 2
  ctx.stroke()
  circle(ctx, x - size / 6, y - size / 6, size / 4, c.treeLight)
}

function drawBench(ctx: CanvasRenderingContext2D, o: Obstacle, c: Palette) {
  ctx.fillStyle = c.benchDark
  for (const lx of [o.x + 8, o.x + o.w - 12]) ctx.fillRect(lx, o.y + o.h - 2, 4, 5)
  ctx.fillStyle = c.bench
  ctx.beginPath()
  ctx.roundRect(o.x, o.y, o.w, o.h, 6)
  ctx.fill()
  ctx.strokeStyle = c.benchDark
  ctx.lineWidth = 1.5
  ctx.beginPath()
  for (let i = 1; i <= 3; i++) {
    const sy = o.y + (o.h * i) / 4
    ctx.moveTo(o.x + 6, sy)
    ctx.lineTo(o.x + o.w - 6, sy)
  }
  ctx.stroke()
}

function circle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string | CanvasGradient) {
  ctx.fillStyle = fill
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fill()
}
