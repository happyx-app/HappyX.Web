// The server's square: a shared map where the members who have this page open walk around as
// their Discord avatar and greet each other. The API is authoritative and sends positions 20
// times a second; this page only sends what was pressed and smooths the movement in between.

import { h } from './dom'
import { t } from './i18n'

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
}

type ServerMsg =
  | { t: 'welcome'; you: string; world: World; players: PlayerMsg[] }
  | { t: 'join'; player: PlayerMsg }
  | { t: 'leave'; id: string }
  | { t: 'state'; p: { id: string; x: number; y: number }[] }
  | { t: 'emote'; id: string; e: Emote }
  | { t: 'high_five'; a: string; b: string }

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

// Close codes from the API.
export const closedElsewhere = 4000

interface Avatar {
  id: string
  name: string
  color: string
  img: HTMLImageElement | null
  x: number
  y: number
  tx: number
  ty: number
  emote?: { icon: string; until: number }
}

const emoteMs = 2200

export interface PlazaHandle {
  element: HTMLElement
  destroy: () => void
}

export function plaza(guildID: string, myID: string): PlazaHandle {
  const canvas = h('canvas', { class: 'plaza-canvas', tabindex: 0, role: 'img', 'aria-label': t('plaza.canvas') })
  const status = h('p', { class: 'plaza-status muted small', role: 'status' }, t('plaza.connecting'))
  const people = h('ul', { class: 'plaza-people', 'aria-label': t('plaza.people') })
  const toast = h('p', { class: 'plaza-toast', role: 'status', hidden: true })
  const emoteBar = h(
    'div',
    { class: 'plaza-emotes', role: 'group', 'aria-label': t('plaza.emotes') },
    ...emotes.map((e, i) =>
      h('button', {
        class: 'plaza-emote', type: 'button', title: `${t(`plaza.emote.${e}`)} (${i + 1})`, 'aria-label': t(`plaza.emote.${e}`),
        onclick: () => sendEmote(e),
      }, emoteIcon[e]),
    ),
  )
  const stage = h('div', { class: 'plaza-stage' }, canvas, toast)
  const element = h(
    'div',
    { class: 'plaza' },
    h('section', { class: 'card plaza-card' }, stage, emoteBar, status),
    h('section', { class: 'card' }, h('h2', {}, t('plaza.people')), people),
    h('p', { class: 'muted small' }, t('plaza.help')),
  )

  let world: World | null = null
  const avatars = new Map<string, Avatar>()
  const keys = new Set<string>()
  let lastMove: [number, number] = [0, 0]
  let ws: WebSocket | null = null
  let retries = 0
  let retryTimer = 0
  let frame = 0
  let toastTimer = 0
  let destroyed = false

  function send(msg: object) {
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg))
  }

  function sendEmote(e: Emote) {
    send({ t: 'emote', e })
  }

  function avatarOf(p: PlayerMsg): Avatar {
    let img: HTMLImageElement | null = null
    if (p.avatar) {
      img = new Image()
      img.src = `https://cdn.discordapp.com/avatars/${p.id}/${p.avatar}.png?size=64`
    }
    return { id: p.id, name: p.name, color: ringColors[p.color % ringColors.length], img, x: p.x, y: p.y, tx: p.x, ty: p.y }
  }

  function renderPeople() {
    const list = [...avatars.values()].sort((a, b) => (a.id === myID ? -1 : b.id === myID ? 1 : a.name.localeCompare(b.name)))
    people.replaceChildren(
      ...list.map((a) => {
        const dot = h('span', { class: 'swatch', 'aria-hidden': 'true' })
        dot.style.background = a.color
        return h('li', { class: 'chip' }, dot, a.id === myID ? t('plaza.you', { name: a.name }) : a.name)
      }),
    )
    canvas.setAttribute('aria-label', t('plaza.canvas.count', { n: avatars.size }))
  }

  function showToast(text: string) {
    toast.textContent = text
    toast.hidden = false
    clearTimeout(toastTimer)
    toastTimer = window.setTimeout(() => (toast.hidden = true), 3000)
  }

  function onMessage(m: ServerMsg) {
    const now = performance.now()
    switch (m.t) {
      case 'welcome':
        world = m.world
        avatars.clear()
        for (const p of m.players) avatars.set(p.id, avatarOf(p))
        status.textContent = t('plaza.connected')
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
        if (a) a.emote = { icon: emoteIcon[m.e] ?? '👋', until: now + emoteMs }
        break
      }
      case 'high_five': {
        const a = avatars.get(m.a)
        const b = avatars.get(m.b)
        if (!a || !b) break
        if (a.id === myID || b.id === myID) showToast(t('plaza.highfive.you', { name: a.id === myID ? b.name : a.name }))
        else showToast(t('plaza.highfive', { a: a.name, b: b.name }))
        break
      }
    }
  }

  function connect() {
    clearTimeout(retryTimer)
    const proto = location.protocol === 'https:' ? 'wss' : 'ws'
    const sock = new WebSocket(`${proto}://${location.host}/api/web/guilds/${encodeURIComponent(guildID)}/plaza`)
    ws = sock
    status.textContent = t('plaza.connecting')
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
      renderPeople()
      if (ev.code === closedElsewhere) {
        status.replaceChildren(t('plaza.elsewhere'), ' ', h('button', { class: 'btn btn-ghost small', type: 'button', onclick: () => connect() }, t('plaza.comeBack')))
        return
      }
      if (retries >= 5) {
        status.replaceChildren(t('plaza.lost'), ' ', h('button', { class: 'btn btn-ghost small', type: 'button', onclick: () => { retries = 0; connect() } }, t('error.retry')))
        return
      }
      status.textContent = t('plaza.reconnecting')
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
    if (typing(e) || e.metaKey || e.ctrlKey || e.altKey) return
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
  const themeWatch = window.setInterval(() => (palette = readPalette()), 1000)

  function readPalette() {
    const css = getComputedStyle(document.documentElement)
    const v = (name: string) => css.getPropertyValue(name).trim()
    return {
      ground: v('--plaza-ground'), path: v('--plaza-path'), water: v('--plaza-water'), stone: v('--plaza-stone'),
      tree: v('--plaza-tree'), bench: v('--plaza-bench'), ink: v('--ink'), surface: v('--surface'), muted: v('--muted'),
    }
  }

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
    if (!ctx || !world) return
    const s = canvas.width / world.w
    ctx.setTransform(s, 0, 0, s, 0, 0)
    drawWorld(ctx, world)
    const list = [...avatars.values()]
    for (const a of list) {
      a.x = approach(a.x, a.tx, dt)
      a.y = approach(a.y, a.ty, dt)
    }
    // Lower avatars are drawn last, so they overlap the ones behind them.
    list.sort((p, q) => p.y - q.y)
    const k = uiScale(canvas.getBoundingClientRect().width / world.w)
    for (const a of list) drawAvatar(ctx, a, world.radius * k, k, now)
  }

  function drawWorld(ctx: CanvasRenderingContext2D, w: World) {
    ctx.fillStyle = palette.ground
    ctx.fillRect(0, 0, w.w, w.h)
    // Two paths crossing at the fountain.
    ctx.fillStyle = palette.path
    ctx.fillRect(0, w.h / 2 - 34, w.w, 68)
    ctx.fillRect(w.w / 2 - 34, 0, 68, w.h)
    for (const o of w.obstacles) {
      const cx = o.x + o.w / 2
      const cy = o.y + o.h / 2
      if (o.kind === 'fountain') {
        // Avatars bump into the stone rim: the API treats round things as circles this wide.
        circle(ctx, cx, cy, o.w / 2, palette.stone)
        circle(ctx, cx, cy, o.w / 2 - 10, palette.water)
        circle(ctx, cx, cy, 14, palette.stone)
      } else if (o.kind === 'tree') {
        circle(ctx, cx, cy, o.w / 2, palette.tree)
        ctx.globalAlpha = 0.25
        circle(ctx, cx - o.w / 8, cy - o.h / 8, o.w / 4, palette.surface)
        ctx.globalAlpha = 1
      } else {
        ctx.fillStyle = palette.bench
        roundRect(ctx, o.x, o.y, o.w, o.h, 8)
      }
    }
  }

  function drawAvatar(ctx: CanvasRenderingContext2D, a: Avatar, r: number, k: number, now: number) {
    const mine = a.id === myID
    circle(ctx, a.x, a.y, r + (mine ? 4 : 3), a.color)
    ctx.save()
    ctx.beginPath()
    ctx.arc(a.x, a.y, r, 0, Math.PI * 2)
    ctx.clip()
    if (a.img?.complete && a.img.naturalWidth > 0) {
      ctx.drawImage(a.img, a.x - r, a.y - r, r * 2, r * 2)
    } else {
      ctx.fillStyle = palette.surface
      ctx.fillRect(a.x - r, a.y - r, r * 2, r * 2)
      ctx.fillStyle = a.color
      ctx.font = `600 ${r}px system-ui, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(a.name.slice(0, 1).toUpperCase(), a.x, a.y + 1)
    }
    ctx.restore()

    // The name sits on a small label so it reads over grass and paths alike.
    const label = mine ? t('plaza.youShort') : a.name.length > 14 ? `${a.name.slice(0, 13)}…` : a.name
    ctx.font = `${mine ? 600 : 500} ${13 * k}px system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const tw = ctx.measureText(label).width + 12 * k
    ctx.fillStyle = palette.surface
    ctx.globalAlpha = 0.9
    roundRect(ctx, a.x - tw / 2, a.y + r + 6 * k, tw, 18 * k, 9 * k)
    ctx.globalAlpha = 1
    ctx.fillStyle = palette.ink
    ctx.fillText(label, a.x, a.y + r + 15.5 * k)

    if (a.emote && a.emote.until > now) {
      const left = (a.emote.until - now) / emoteMs
      const rise = (1 - left) * 10
      ctx.globalAlpha = Math.min(1, left * 4)
      ctx.fillStyle = palette.surface
      circle(ctx, a.x + r * 0.9, a.y - r - (14 + rise) * k, 17 * k, palette.surface)
      ctx.font = `${20 * k}px system-ui, sans-serif`
      ctx.fillText(a.emote.icon, a.x + r * 0.9, a.y - r - (13 + rise) * k)
      ctx.globalAlpha = 1
    }
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
      clearInterval(themeWatch)
      ro.disconnect()
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
      ws?.close(1000)
      ws = null
    },
  }
}

function circle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string) {
  ctx.fillStyle = fill
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fill()
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, hgt: number, r: number) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, hgt, r)
  ctx.fill()
}
