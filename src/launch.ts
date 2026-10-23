// «El gran lanzamiento», played from the square. The API runs the game and sends each player
// only what they may see: the manager gets the whole office and every task, a worker only what
// is near them and their own order. This page draws that and sends what was pressed.

import { h } from './dom'
import { t, type Key } from './i18n'
import { approach, uiScale } from './plaza'

export interface Room {
  id: string
  x: number
  y: number
  w: number
  h: number
}

export interface Spot {
  id: string
  x: number
  y: number
  room: string
}

export interface Office {
  tile: number
  cols: number
  rows: number
  tiles: string[]
  rooms: Room[]
  stations: Spot[]
  tables: Spot[]
  seat: [number, number]
  vision: number
}

export interface Task {
  id: number
  item: string
  to: string
  left: number
  worker?: string
}

export interface GamePlayer {
  id: string
  x: number
  y: number
  carry?: string
  task?: number
  away?: boolean
}

export interface GameEvent {
  t: 'round' | 'order' | 'picked' | 'delivered' | 'expired' | 'task' | 'manager'
  round?: number
  manager?: string
  task?: number
  worker?: string
  item?: string
  to?: string
}

export type Role = 'manager' | 'worker' | 'spectator'

export interface GameView {
  t: 'game'
  phase: 'intro' | 'playing' | 'summary' | 'final'
  round: number
  rounds: number
  left: number
  manager: string
  role: Role
  players: GamePlayer[]
  tasks?: Task[]
  order?: Task & { target: [number, number] }
  delivered: number[]
  expired: number[]
  ev?: GameEvent[]
}

export interface Person {
  name: string
  color: string
  img: HTMLImageElement
}

export const itemIcon: Record<string, string> = { doc: '📄', box: '📦', coffee: '☕' }
const stationIcon: Record<string, string> = { doc: '🖨️', box: '📦', coffee: '☕' }

// Each room keeps its colour on the floor, the tables and the task list.
export const roomColors: Record<string, string> = {
  blue: '#2a78d6', green: '#2a9d5c', boss: '#a347c8', cafe: '#d6a12a', print: '#6b7280', store: '#d6582a',
}

// formatClock shows seconds as m:ss.
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

// tileAt maps a point on the canvas, in CSS pixels, to the office tile under it.
export function tileAt(px: number, py: number, rect: { width: number; height: number }, o: Pick<Office, 'cols' | 'rows'>): [number, number] {
  const x = Math.floor((px / rect.width) * o.cols)
  const y = Math.floor((py / rect.height) * o.rows)
  return [Math.min(o.cols - 1, Math.max(0, x)), Math.min(o.rows - 1, Math.max(0, y))]
}

// edgePoint is where on a circle of radius r around (x, y) an arrow toward (tx, ty) sits, and
// the arrow's angle.
export function edgePoint(x: number, y: number, tx: number, ty: number, r: number): [number, number, number] {
  const a = Math.atan2(ty - y, tx - x)
  return [x + Math.cos(a) * r, y + Math.sin(a) * r, a]
}

const roomName = (id: string) => t(`launch.room.${id}` as Key)
const itemText = (id: string) => t(`launch.item.${id}` as Key)
// A destination inside a sentence: «lleva un café a la Sala Azul».
const roomTo = (id: string) => t(`launch.to.${id}` as Key)

interface Drawn extends GamePlayer {
  dx: number // where it is drawn, smoothed toward x, y
  dy: number
}

export interface LaunchOptions {
  office: Office
  me: string
  host: boolean
  person: (id: string) => Person | undefined
  send: (msg: object) => void
}

export interface LaunchHandle {
  element: HTMLElement
  update: (v: GameView) => void
  destroy: () => void
}

const toastMs = 3500
const flashMs = 900

export function launchGame(o: LaunchOptions): LaunchHandle {
  const { office, me } = o
  const worldW = office.cols * office.tile
  const worldH = office.rows * office.tile
  const nameOf = (id: string) => o.person(id)?.name ?? '?'

  const roundText = h('span', { class: 'launch-round' })
  const roleText = h('span', { class: 'launch-role' })
  const scoreText = h('span', { class: 'launch-score' })
  const clock = h('span', { class: 'launch-clock', 'aria-label': '' })
  const stop = o.host
    ? h('button', { class: 'btn btn-ghost small', type: 'button', onclick: () => o.send({ t: 'stop' }) }, t('launch.stop'))
    : null
  const bar = h('div', { class: 'launch-bar' }, h('div', { class: 'launch-bar-main' }, roundText, roleText), h('div', { class: 'launch-bar-side' }, scoreText, clock, stop))
  const canvas = h('canvas', { class: 'launch-canvas', tabindex: 0, role: 'img', 'aria-label': t('launch.canvas') })
  const overlay = h('div', { class: 'launch-overlay', hidden: true })
  const toast = h('p', { class: 'plaza-toast', role: 'status', hidden: true })
  const panel = h('div', { class: 'launch-panel' })
  const element = h('section', { class: 'card launch-card' }, bar, h('div', { class: 'launch-stage' }, canvas, overlay, toast), panel)

  let view: GameView | null = null
  const drawn = new Map<string, Drawn>()
  let selTask = 0
  let selWorker = ''
  let panelKey = ''
  let overlayKey = ''
  const taskClocks = new Map<number, HTMLElement>()
  let orderClock: HTMLElement | null = null
  const flashes: { x: number; y: number; color: string; at: number }[] = []
  let toastTimer = 0
  let frame = 0

  function showToast(text: string, mine = false) {
    toast.textContent = text
    toast.classList.toggle('plaza-toast-me', mine)
    toast.hidden = false
    clearTimeout(toastTimer)
    toastTimer = window.setTimeout(() => (toast.hidden = true), toastMs)
  }

  function onEvent(e: GameEvent) {
    const item = e.item ? itemText(e.item) : ''
    const room = e.to ? roomTo(e.to) : ''
    switch (e.t) {
      case 'order':
        if (e.worker === me) showToast(t('launch.ev.order', { item, room }), true)
        break
      case 'delivered': {
        const tb = office.tables.find((x) => x.id === e.to)
        if (tb) flashes.push({ x: (tb.x + 0.5) * office.tile, y: (tb.y + 0.5) * office.tile, color: roomColors[tb.id] ?? '#2a78d6', at: performance.now() })
        if (e.worker === me) showToast(t('launch.ev.deliveredYou', { item, room }), true)
        else showToast(t('launch.ev.delivered', { name: nameOf(e.worker ?? ''), item, room }))
        break
      }
      case 'expired':
        showToast(t('launch.ev.expired', { item, room }))
        break
      case 'manager':
        if (e.manager === me) showToast(t('launch.ev.managerYou'), true)
        else showToast(t('launch.ev.manager', { name: nameOf(e.manager ?? '') }))
        break
    }
  }

  // --- the bar, the overlay and the panel, rebuilt only when what they show changes ---

  function renderBar(v: GameView) {
    roundText.textContent = t('launch.round', { n: v.round, total: v.rounds })
    roleText.textContent = t(`launch.role.${v.role}` as Key)
    roleText.dataset.role = v.role
    scoreText.textContent = t('launch.delivered', { n: v.delivered.reduce((a, b) => a + b, 0) })
    clock.textContent = formatClock(v.left)
    clock.classList.toggle('launch-clock-low', v.phase === 'playing' && v.left <= 30)
  }

  function renderOverlay(v: GameView) {
    const key = `${v.phase}:${v.round}:${v.manager}:${v.role}`
    if (key === overlayKey) return
    overlayKey = key
    const card = (...children: (Node | string | null)[]) => h('div', { class: 'launch-overlay-card' }, ...children)
    switch (v.phase) {
      case 'intro': {
        const m = o.person(v.manager)
        const pic = m ? h('img', { class: 'launch-overlay-pic', alt: '', src: m.img.src }) : null
        if (pic && m) pic.style.borderColor = m.color
        overlay.replaceChildren(card(
          pic,
          h('h2', {}, t('launch.intro.title', { n: v.round, name: v.manager === me ? t('plaza.youShort') : nameOf(v.manager) })),
          h('p', {}, t(v.role === 'manager' ? 'launch.intro.manager' : 'launch.intro.worker')),
        ))
        break
      }
      case 'summary': {
        const i = v.round - 1
        overlay.replaceChildren(card(
          h('h2', {}, t('launch.summary.title', { n: v.round })),
          h('p', {}, t('launch.summary.body', { delivered: v.delivered[i] ?? 0, expired: v.expired[i] ?? 0 })),
        ))
        break
      }
      case 'final': {
        const total = v.delivered.reduce((a, b) => a + b, 0)
        overlay.replaceChildren(card(
          h('h2', {}, `🚀 ${t('launch.final.title', { n: total })}`),
          h('ul', { class: 'launch-final' }, ...v.delivered.map((d, i) => h('li', {}, t('launch.final.round', { n: i + 1, delivered: d })))),
          h('p', { class: 'muted small' }, t('launch.final.back')),
        ))
        break
      }
      default:
        overlay.replaceChildren()
    }
    overlay.hidden = v.phase === 'playing'
  }

  function avatarPic(id: string) {
    const p = o.person(id)
    const img = h('img', { class: 'launch-pic', alt: '', src: p?.img.src ?? '' })
    if (p) img.style.borderColor = p.color
    return img
  }

  function choose(task: number, worker: string) {
    if (task && worker) {
      o.send({ t: 'order', w: worker, task })
      selTask = 0
      selWorker = ''
    } else {
      selTask = task
      selWorker = worker
    }
    panelKey = ''
    if (view) renderPanel(view)
  }

  function renderPanel(v: GameView) {
    const tasks = v.tasks ?? []
    const workers = v.players.filter((p) => p.id !== v.manager)
    const canOrder = v.role === 'manager' && (v.phase === 'intro' || v.phase === 'playing')
    if (selTask && !tasks.some((x) => x.id === selTask)) selTask = 0
    if (selWorker && !workers.some((p) => p.id === selWorker)) selWorker = ''
    const key = JSON.stringify([v.role, canOrder, selTask, selWorker, tasks.map((x) => [x.id, x.worker]), workers.map((p) => [p.id, p.task, p.carry, p.away]), v.order && [v.order.id, v.order.target]])
    if (key !== panelKey) {
      panelKey = key
      taskClocks.clear()
      orderClock = null
      panel.replaceChildren(...(v.role === 'worker' ? workerPanel(v) : managerPanel(tasks, workers, canOrder)))
    }
    // Between rounds the overlay says it all.
    panel.hidden = v.phase === 'summary' || v.phase === 'final'
    for (const x of tasks) {
      const c = taskClocks.get(x.id)
      if (c) {
        c.textContent = formatClock(x.left)
        c.classList.toggle('launch-clock-low', x.left <= 15)
      }
    }
    if (orderClock && v.order) {
      orderClock.textContent = formatClock(v.order.left)
      orderClock.classList.toggle('launch-clock-low', v.order.left <= 15)
    }
  }

  function managerPanel(tasks: Task[], workers: GamePlayer[], canOrder: boolean): Node[] {
    const hint = canOrder && selTask ? t('launch.pickWorker') : canOrder && selWorker ? t('launch.pickTask', { name: nameOf(selWorker) }) : ''
    const list = tasks.length === 0
      ? h('p', { class: 'muted small' }, t('launch.tasks.none'))
      : h('ul', { class: 'launch-tasks' }, ...tasks.map((x) => {
        const c = h('span', { class: 'launch-task-clock' }, formatClock(x.left))
        taskClocks.set(x.id, c)
        const who = x.worker
          ? h('span', { class: 'launch-task-who' }, avatarPic(x.worker), nameOf(x.worker))
          : h('span', { class: 'launch-task-who muted' }, t('launch.unassigned'))
        const btn = h('button', {
          class: 'launch-task' + (selTask === x.id ? ' launch-selected' : ''), type: 'button', disabled: !canOrder,
          'aria-pressed': selTask === x.id ? 'true' : 'false',
          onclick: () => choose(selTask === x.id ? 0 : x.id, selWorker),
        },
        h('span', { class: 'launch-task-icon', 'aria-hidden': 'true' }, itemIcon[x.item] ?? '•'),
        h('span', { class: 'launch-task-main' }, h('span', { class: 'launch-task-what' }, t('launch.order', { item: itemText(x.item), room: roomTo(x.to) })), who),
        c)
        btn.style.setProperty('--room', roomColors[x.to] ?? 'var(--accent)')
        return h('li', {}, btn)
      }))
    const team = h('ul', { class: 'launch-team' }, ...workers.map((p) => {
      const task = tasks.find((x) => x.id === p.task)
      const doing = task ? `${itemIcon[task.item] ?? ''} → ${roomName(task.to)}` : t('launch.idle')
      return h('li', {}, h('button', {
        class: 'launch-worker' + (selWorker === p.id ? ' launch-selected' : ''), type: 'button', disabled: !canOrder || p.away,
        'aria-pressed': selWorker === p.id ? 'true' : 'false',
        onclick: () => choose(selTask, selWorker === p.id ? '' : p.id),
      }, avatarPic(p.id), h('span', { class: 'launch-worker-main' }, h('span', { class: 'launch-worker-name' }, nameOf(p.id), p.carry ? ` ${itemIcon[p.carry] ?? ''}` : '', p.away ? ` · ${t('launch.away')}` : ''), h('span', { class: 'muted small' }, doing))))
    }))
    return [
      h('div', { class: 'launch-col' }, h('h3', {}, t('launch.tasks', { n: tasks.length })), list),
      h('div', { class: 'launch-col' }, h('h3', {}, t('launch.workers')), team, hint ? h('p', { class: 'launch-hint', role: 'status' }, hint) : null),
    ]
  }

  function workerPanel(v: GameView): Node[] {
    const ord = v.order
    if (!ord) return [h('p', { class: 'launch-order launch-order-none' }, t('launch.order.none'))]
    const meNow = v.players.find((p) => p.id === me)
    const carrying = meNow?.carry === ord.item
    const from = office.stations.find((s) => s.id === ord.item)
    orderClock = h('span', { class: 'launch-task-clock' }, formatClock(ord.left))
    const step = (done: boolean, text: string) => h('li', { class: done ? 'launch-step launch-step-done' : 'launch-step' }, h('span', { 'aria-hidden': 'true' }, done ? '✓' : '○'), text)
    const card = h(
      'div',
      { class: 'launch-order' },
      h('span', { class: 'launch-task-icon', 'aria-hidden': 'true' }, itemIcon[ord.item] ?? '•'),
      h('div', { class: 'launch-task-main' },
        h('strong', {}, t('launch.order', { item: itemText(ord.item), room: roomTo(ord.to) })),
        h('ol', { class: 'launch-steps' },
          step(carrying, t('launch.step.pick', { room: roomName(from?.room ?? '') })),
          step(false, t('launch.step.drop', { room: roomName(ord.to) })),
        ),
      ),
      orderClock,
    )
    card.style.setProperty('--room', roomColors[ord.to] ?? 'var(--accent)')
    return [card]
  }

  function update(v: GameView) {
    view = v
    const seen = new Set<string>()
    for (const p of v.players) {
      seen.add(p.id)
      const d = drawn.get(p.id)
      if (d) Object.assign(d, p, { carry: p.carry, task: p.task, away: p.away })
      else drawn.set(p.id, { ...p, dx: p.x, dy: p.y })
    }
    for (const id of drawn.keys()) if (!seen.has(id)) drawn.delete(id)
    for (const e of v.ev ?? []) onEvent(e)
    renderBar(v)
    renderOverlay(v)
    renderPanel(v)
  }

  // --- input ---

  const keys = new Set<string>()
  let lastMove = '0,0'
  const keyNames: Record<string, string> = { ArrowUp: 'u', ArrowDown: 'd', ArrowLeft: 'l', ArrowRight: 'r', w: 'u', s: 'd', a: 'l', d: 'r', W: 'u', S: 'd', A: 'l', D: 'r' }

  function sendMove() {
    const dx = (keys.has('r') ? 1 : 0) - (keys.has('l') ? 1 : 0)
    const dy = (keys.has('d') ? 1 : 0) - (keys.has('u') ? 1 : 0)
    const k = `${dx},${dy}`
    if (k !== lastMove) {
      lastMove = k
      o.send({ t: 'g_move', dx, dy })
    }
  }

  function onKeyDown(e: KeyboardEvent) {
    const el = e.target as HTMLElement | null
    if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT')) return
    if (e.metaKey || e.ctrlKey || e.altKey || view?.role !== 'worker') return
    const k = keyNames[e.key]
    if (!k) return
    e.preventDefault()
    keys.add(k)
    sendMove()
  }

  function onKeyUp(e: KeyboardEvent) {
    const k = keyNames[e.key]
    if (k && keys.delete(k)) sendMove()
  }

  function onBlur() {
    keys.clear()
    sendMove()
  }

  canvas.addEventListener('pointerdown', (e) => {
    if (!view) return
    const r = canvas.getBoundingClientRect()
    const px = e.clientX - r.left
    const py = e.clientY - r.top
    if (view.role === 'worker') {
      const [x, y] = tileAt(px, py, r, office)
      lastMove = '0,0'
      o.send({ t: 'g_goto', x, y })
      return
    }
    if (view.role !== 'manager') return
    // The manager taps a worker on the plan to pick them.
    const wx = (px / r.width) * worldW
    const wy = (py / r.height) * worldH
    let best = ''
    let bestD = office.tile * 0.8
    for (const d of drawn.values()) {
      const dist = Math.hypot(d.dx - wx, d.dy - wy)
      if (d.id !== view.manager && !d.away && dist < bestD) [best, bestD] = [d.id, dist]
    }
    if (best) choose(selTask, selWorker === best ? '' : best)
  })
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  window.addEventListener('blur', onBlur)

  // --- drawing ---

  let palette = readPalette()
  const repaint = () => (palette = readPalette())
  const themeWatch = new MutationObserver(repaint)
  themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  const systemTheme = window.matchMedia('(prefers-color-scheme: dark)')
  systemTheme.addEventListener('change', repaint)
  const ro = new ResizeObserver(() => resize())
  ro.observe(canvas)

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
    if (!ctx) return
    const s = canvas.width / worldW
    ctx.setTransform(s, 0, 0, s, 0, 0)
    const k = uiScale(canvas.getBoundingClientRect().width / worldW)
    drawOffice(ctx, office, palette)
    for (const d of drawn.values()) {
      d.dx = approach(d.dx, d.x, dt)
      d.dy = approach(d.dy, d.y, dt)
    }
    const v = view
    const mine = drawn.get(me)
    const target = v?.order ? { x: (v.order.target[0] + 0.5) * office.tile, y: (v.order.target[1] + 0.5) * office.tile } : null
    if (target && v?.phase === 'playing') drawTarget(ctx, target.x, target.y, now)
    drawFlashes(ctx, now)
    const list = [...drawn.values()].sort((a, b) => a.dy - b.dy)
    const r = office.tile * 0.42 * k
    for (const d of list) drawPlayer(ctx, d, r, k, v, now)
    // A worker sees the office through a circle around them; the arrow points past its edge.
    if (v?.role === 'worker' && mine) {
      const vr = office.vision * office.tile
      drawFog(ctx, mine.dx, mine.dy, vr)
      if (target && v.phase === 'playing' && Math.hypot(target.x - mine.dx, target.y - mine.dy) > vr - office.tile / 2) {
        const [ax, ay, angle] = edgePoint(mine.dx, mine.dy, target.x, target.y, vr - 14 * k)
        drawArrow(ctx, ax, ay, angle, k, roomColors[v.order!.to] ?? palette.accent, now)
      }
    }
  }

  function drawPlayer(ctx: CanvasRenderingContext2D, d: Drawn, r: number, k: number, v: GameView | null, now: number) {
    const p = o.person(d.id)
    const color = p?.color ?? '#6b7280'
    const isManager = d.id === v?.manager
    const selected = d.id === selWorker
    const walking = Math.hypot(d.x - d.dx, d.y - d.dy) > 1
    const x = d.dx
    const y = d.dy + (walking ? -Math.abs(Math.sin(now / 90)) * 2.5 : 0)
    ctx.globalAlpha = d.away ? 0.45 : 1
    ctx.fillStyle = palette.shadow
    ctx.beginPath()
    ctx.ellipse(x, d.dy + r + 1, r * 0.75, r * 0.28, 0, 0, Math.PI * 2)
    ctx.fill()
    if (d.id === me || selected) {
      ctx.save()
      ctx.strokeStyle = palette.accent
      ctx.lineWidth = 2
      ctx.setLineDash([5, 4])
      ctx.lineDashOffset = -now / 40
      ctx.beginPath()
      ctx.arc(x, y, r + 8, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()
    }
    fillCircle(ctx, x, y, r + 4, palette.surface)
    ctx.strokeStyle = color
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(x, y, r + 2, 0, Math.PI * 2)
    ctx.stroke()
    ctx.save()
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.clip()
    if (p && p.img.complete && p.img.naturalWidth > 0) ctx.drawImage(p.img, x - r, y - r, r * 2, r * 2)
    else {
      ctx.fillStyle = color
      ctx.fillRect(x - r, y - r, r * 2, r * 2)
    }
    ctx.restore()
    // What they carry, or the manager's tie.
    const badge = isManager ? '👔' : d.carry ? itemIcon[d.carry] : ''
    if (badge) {
      const bx = x + r * 0.8
      const by = y - r * 0.8
      fillCircle(ctx, bx, by, 10 * k, palette.surface)
      ctx.strokeStyle = palette.border
      ctx.lineWidth = 1
      ctx.stroke()
      ctx.font = `${12 * k}px system-ui, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(badge, bx, by + 1)
    }
    const name = d.id === me ? t('plaza.youShort') : (p?.name ?? '?')
    const label = name.length > 10 ? `${name.slice(0, 9)}…` : name
    ctx.font = `600 ${11 * k}px system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const tw = ctx.measureText(label).width + 12 * k
    const ly = y + r + 5 * k
    ctx.beginPath()
    ctx.roundRect(x - tw / 2, ly, tw, 16 * k, 8 * k)
    ctx.fillStyle = d.id === me ? palette.accent : palette.surface
    ctx.fill()
    if (d.id !== me) {
      ctx.strokeStyle = palette.border
      ctx.lineWidth = 1
      ctx.stroke()
    }
    ctx.fillStyle = d.id === me ? '#fff' : palette.ink
    ctx.fillText(label, x, ly + 8.5 * k)
    ctx.globalAlpha = 1
  }

  function drawTarget(ctx: CanvasRenderingContext2D, x: number, y: number, now: number) {
    const p = (now / 1200) % 1
    ctx.strokeStyle = palette.accent
    ctx.lineWidth = 3
    ctx.globalAlpha = 1 - p
    ctx.beginPath()
    ctx.arc(x, y, office.tile * (0.55 + p * 0.5), 0, Math.PI * 2)
    ctx.stroke()
    ctx.globalAlpha = 1
  }

  function drawFlashes(ctx: CanvasRenderingContext2D, now: number) {
    for (let i = flashes.length - 1; i >= 0; i--) {
      const f = flashes[i]
      const p = (now - f.at) / flashMs
      if (p >= 1) {
        flashes.splice(i, 1)
        continue
      }
      ctx.globalAlpha = 1 - p
      ctx.strokeStyle = f.color
      ctx.lineWidth = 4
      ctx.beginPath()
      ctx.arc(f.x, f.y, office.tile * (0.5 + p * 1.5), 0, Math.PI * 2)
      ctx.stroke()
      ctx.font = `${22}px system-ui, sans-serif`
      ctx.textAlign = 'center'
      ctx.fillText('✨', f.x, f.y - office.tile * (0.6 + p))
    }
    ctx.globalAlpha = 1
  }

  function drawFog(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
    const g = ctx.createRadialGradient(x, y, r * 0.8, x, y, r)
    g.addColorStop(0, 'rgba(0,0,0,0)')
    g.addColorStop(1, palette.fog)
    ctx.fillStyle = g
    ctx.fillRect(0, 0, worldW, worldH)
  }

  function drawArrow(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, k: number, color: string, now: number) {
    const bob = Math.sin(now / 200) * 3
    ctx.save()
    ctx.translate(x + Math.cos(angle) * bob, y + Math.sin(angle) * bob)
    ctx.rotate(angle)
    ctx.fillStyle = color
    ctx.strokeStyle = palette.surface
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(14 * k, 0)
    ctx.lineTo(-8 * k, -11 * k)
    ctx.lineTo(-3 * k, 0)
    ctx.lineTo(-8 * k, 11 * k)
    ctx.closePath()
    ctx.stroke()
    ctx.fill()
    ctx.restore()
  }

  frame = requestAnimationFrame(draw)

  return {
    element,
    update,
    destroy() {
      cancelAnimationFrame(frame)
      clearTimeout(toastTimer)
      themeWatch.disconnect()
      systemTheme.removeEventListener('change', repaint)
      ro.disconnect()
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
      element.remove()
    },
  }
}

type Palette = ReturnType<typeof readPalette>

function readPalette() {
  const css = getComputedStyle(document.documentElement)
  const v = (name: string) => css.getPropertyValue(name).trim()
  return {
    floor: v('--office-floor'), wall: v('--office-wall'), wallTop: v('--office-wall-top'), desk: v('--office-desk'), deskDark: v('--office-desk-dark'),
    screen: v('--office-screen'), line: v('--office-line'), roomAlpha: Number(v('--office-room-alpha')) || 0.12, fog: v('--office-fog'),
    shadow: v('--plaza-shadow'), ink: v('--ink'), ink2: v('--ink-2'), surface: v('--surface'), border: v('--border'), accent: v('--accent'),
  }
}

function drawOffice(ctx: CanvasRenderingContext2D, o: Office, c: Palette) {
  const T = o.tile
  ctx.fillStyle = c.floor
  ctx.fillRect(0, 0, o.cols * T, o.rows * T)
  // Each room's floor in its colour, faintly, with its name in the corner.
  for (const r of o.rooms) {
    ctx.globalAlpha = c.roomAlpha
    ctx.fillStyle = roomColors[r.id] ?? c.accent
    ctx.fillRect(r.x * T, r.y * T, r.w * T, r.h * T)
    ctx.globalAlpha = 1
  }
  ctx.strokeStyle = c.line
  ctx.lineWidth = 1
  ctx.beginPath()
  for (let x = 1; x < o.cols; x++) {
    ctx.moveTo(x * T, 0)
    ctx.lineTo(x * T, o.rows * T)
  }
  for (let y = 1; y < o.rows; y++) {
    ctx.moveTo(0, y * T)
    ctx.lineTo(o.cols * T, y * T)
  }
  ctx.stroke()
  for (let y = 0; y < o.rows; y++) {
    for (let x = 0; x < o.cols; x++) {
      const ch = o.tiles[y][x]
      if (ch === '#') {
        ctx.fillStyle = c.wall
        ctx.fillRect(x * T, y * T, T, T)
        ctx.fillStyle = c.wallTop
        ctx.fillRect(x * T, y * T, T, T * 0.3)
      } else if (ch === 'd') {
        ctx.fillStyle = c.desk
        ctx.beginPath()
        ctx.roundRect(x * T + 2, y * T + 6, T - 4, T - 12, 4)
        ctx.fill()
        ctx.fillStyle = c.screen
        ctx.fillRect(x * T + T / 2 - 8, y * T + 10, 16, 10)
      }
    }
  }
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (const r of o.rooms) {
    ctx.font = '600 12px system-ui, sans-serif'
    ctx.fillStyle = c.ink2
    ctx.textAlign = 'left'
    ctx.fillText(roomName(r.id), r.x * T + 8, r.y * T + 12)
  }
  for (const s of o.stations) {
    const x = s.x * T
    const y = s.y * T
    ctx.fillStyle = c.deskDark
    ctx.beginPath()
    ctx.roundRect(x + 3, y + 3, T - 6, T - 6, 8)
    ctx.fill()
    ctx.font = '22px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(stationIcon[s.id] ?? '•', x + T / 2, y + T / 2 + 1)
  }
  for (const tb of o.tables) {
    const x = (tb.x + 0.5) * T
    const y = (tb.y + 0.5) * T
    fillCircle(ctx, x, y, T * 0.46, c.desk)
    ctx.strokeStyle = roomColors[tb.id] ?? c.accent
    ctx.lineWidth = 3
    ctx.stroke()
    ctx.font = '16px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('📥', x, y + 1)
  }
  // The manager's chair; the manager sits on it.
  const [sx, sy] = o.seat
  ctx.fillStyle = c.deskDark
  ctx.beginPath()
  ctx.roundRect(sx * T + 6, sy * T + 6, T - 12, T - 12, 10)
  ctx.fill()
}

function fillCircle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string) {
  ctx.fillStyle = fill
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fill()
}
