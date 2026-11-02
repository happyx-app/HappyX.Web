// The team canvas: members draw on the background of a server's pages (dashboard, settings,
// game) and the drawings stay until someone erases them. The canvas is fixed behind the content,
// so drawings show in the margins and between cards; picking a pen fades the content so the whole
// screen can be drawn on. Members erase their own drawings; those who may change the settings see
// who drew what and erase anything.
//
// A drawing is anchored to a point given as a fraction of the screen, and its points are px from
// there, scaled down on narrow screens: what is drawn in the margin stays in the margin.

import * as api from './api'
import { h, s } from './dom'
import { lang, t } from './i18n'
import { type Box, countDrawings, gap, localPoint, maxPoints, sameDrawingMs, sameDrawingPx, scaleFor } from './canvasGeometry'

export { countDrawings }

export const penColors = ['#7c3aed', '#fbbf24', '#ec4899', '#3b82f6', '#22c55e'] as const
// penDot is a pen's colour swatch. The colour goes in through the CSSOM: the site's CSP blocks
// style attributes.
function penDot(color: number, small = false): HTMLElement {
  const dot = h('span', { class: small ? 'canvas-pen canvas-pen-small' : 'canvas-pen' })
  dot.style.setProperty('--pen', penColors[color] ?? penColors[0])
  return dot
}

const colorKeys = ['canvas.color.0', 'canvas.color.1', 'canvas.color.2', 'canvas.color.3', 'canvas.color.4'] as const

function newDrawingID(): string {
  try {
    return crypto.randomUUID()
  } catch {
    return Math.random().toString(36).slice(2) + Date.now().toString(36)
  }
}

type Mode = { pen: number } | 'erase' | 'moderate' | null

interface State {
  guildID: string
  canvas: api.Canvas
  etag: string
}

let state: State | null = null
let wanted: string | null = null // the server whose page is open
let mode: Mode = null
let hover: string | null = null // drawing ID under the pointer
let drawing: { stroke: api.CanvasStroke; last: [number, number] } | null = null
let pending: api.CanvasStroke[] = [] // drawn here, not yet saved (or never, in the demo)
// Drawings erased while some of their strokes were still being saved: those strokes are erased
// as soon as they are. Erased drawings' IDs aren't used again, so they stay until the server
// changes.
const erasedWhileSaving = new Set<string>()
// Goes up on every change made here, so a check that started before one doesn't undo it.
let edits = 0
// How often an open page checks for other people's drawings.
const pollMs = 30_000
let timer: number | undefined
const listeners = new Set<() => void>()

// --- DOM ---

// The page's parts are built on first use, so the module can be loaded where there is no page.
let el: HTMLCanvasElement | null = null
let ctx: CanvasRenderingContext2D | null = null
let dock: HTMLElement
let bar: HTMLElement
let pens: HTMLButtonElement[] = []
let eraseBtn: HTMLButtonElement
let moderateBtn: HTMLButtonElement
let pop: HTMLElement | null = null
let modal: HTMLElement | null = null

const icon = (d: string) =>
  s('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.8, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, s('path', { d }))
const pencilIcon = () => icon('M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4ZM13.5 6.5l4 4')
const eraserIcon = () => icon('M7 21h10M5.5 15.5 14 7l5 5-8.5 8.5H8.5l-3-3a1.4 1.4 0 0 1 0-2ZM10 11l5 5')
const shieldIcon = () => icon('M12 3 5 6v5c0 4.5 3 8.3 7 10 4-1.7 7-5.5 7-10V6l-7-3ZM9 12l2 2 4-4')

const tool = (label: string, content: Node, onclick: () => void, cls = '') =>
  h('button', { type: 'button', class: `canvas-tool ${cls}`.trim(), title: label, 'aria-label': label, 'aria-pressed': 'false', onclick }, content)

function build(): HTMLCanvasElement {
  if (el) return el
  const layer = h('canvas', { class: 'canvas-layer', 'aria-hidden': 'true' })
  el = layer
  ctx = layer.getContext('2d')
  dock = h('div', { class: 'canvas-dock', role: 'toolbar', 'aria-label': t('canvas.toolbar') })
  bar = h('div', { class: 'canvas-bar', role: 'status' })
  const fab = tool(t('canvas.open'), pencilIcon(), () => dock.classList.toggle('open'), 'canvas-fab')
  pens = penColors.map((_, i) =>
    tool(t('canvas.pen', { color: t(colorKeys[i]) }), penDot(i), () => setMode(isPen(mode) && mode.pen === i ? null : { pen: i })),
  )
  eraseBtn = tool(t('canvas.erase'), eraserIcon(), () => setMode(mode === 'erase' ? null : 'erase'))
  moderateBtn = tool(t('canvas.moderate'), shieldIcon(), () => setMode(mode === 'moderate' ? null : 'moderate'))
  dock.append(fab, ...pens, h('span', { class: 'canvas-sep', 'aria-hidden': 'true' }), eraseBtn, moderateBtn)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && wanted && !drawing) void load()
  })
  addEventListener('resize', () => {
    if (layer.isConnected) fit()
  })
  layer.addEventListener('pointerdown', (e) => {
    closePop()
    if (!mode) return
    if (isPen(mode)) {
      layer.setPointerCapture(e.pointerId)
      startStroke(e.clientX, e.clientY, mode.pen)
      return
    }
    const st = hit(e.clientX, e.clientY)
    if (!st) return
    if (mode === 'erase') void erase(st)
    else {
      hover = st.drawing_id
      paint()
      openPop(st, e.clientX, e.clientY)
    }
  })
  layer.addEventListener('pointermove', (e) => {
    if (drawing) return extendStroke(e.clientX, e.clientY)
    if ((mode === 'erase' || mode === 'moderate') && !pop) {
      const id = hit(e.clientX, e.clientY)?.drawing_id ?? null
      if (id !== hover) {
        hover = id
        paint()
      }
    }
  })
  layer.addEventListener('pointerup', endStroke)
  layer.addEventListener('pointercancel', endStroke)

  addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return
    if (modal) {
      modal.remove()
      modal = null
    } else if (pop) closePop()
    else if (mode) setMode(null)
  })

  return layer
}

const isPen = (m: Mode): m is { pen: number } => typeof m === 'object' && m !== null

// --- Public API ---

// showCanvas puts the canvas of the server whose page is open behind it, or takes it away for
// pages of no server.
export function showCanvas(guildID: string | null) {
  if (guildID === wanted && guildID !== null) return
  wanted = guildID
  setMode(null)
  if (state && state.guildID !== guildID) {
    state = null
    pending = []
    erasedWhileSaving.clear()
    paint()
    notify()
  }
  if (!guildID) return unmount()
  void load()
}

// reloadCanvas reads the canvas again, e.g. after the setting changed.
export function reloadCanvas() {
  if (state) state.etag = ''
  void load()
}

// canvasState is the open server's canvas, for its settings.
export const canvasState = (): { guildID: string; canvas: api.Canvas } | null => (state ? { guildID: state.guildID, canvas: state.canvas } : null)

// onCanvasChange calls fn whenever the canvas is read or changed; it returns how to stop.
export function onCanvasChange(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

// confirmClear asks before erasing the whole canvas.
export function confirmClear() {
  if (!state) return
  const n = countDrawings(allStrokes())
  const cancel = h('button', { type: 'button', class: 'btn btn-ghost' }, t('canvas.cancel'))
  const ok = h('button', { type: 'button', class: 'btn btn-danger' }, t('canvas.clear.ok'))
  const err = h('p', { class: 'error small', role: 'alert', hidden: true })
  modal?.remove()
  modal = h(
    'div',
    { class: 'canvas-modal-back' },
    h(
      'div',
      { class: 'card canvas-modal', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'canvas-clear-title' },
      h('h2', { id: 'canvas-clear-title' }, t('canvas.clear.title')),
      h('p', { class: 'muted' }, n === 1 ? t('canvas.clear.body.one') : t('canvas.clear.body', { n })),
      err,
      h('div', { class: 'canvas-modal-actions' }, cancel, ok),
    ),
  )
  const close = () => {
    modal?.remove()
    modal = null
  }
  cancel.onclick = close
  modal.onclick = (e) => {
    if (e.target === modal) close()
  }
  ok.onclick = async () => {
    const st = state
    if (!st) return close()
    ok.disabled = true
    try {
      if (!api.isDemo) {
        const { version } = await api.clearCanvas(st.guildID)
        st.canvas.version = version
      }
      st.canvas.strokes = []
      st.etag = ''
      edits++
      // Strokes still being saved go too.
      pending.forEach((x) => erasedWhileSaving.add(x.drawing_id))
      pending = []
      close()
      setMode(null)
      changed()
    } catch {
      ok.disabled = false
      err.hidden = false
      err.textContent = t('canvas.error.erase')
    }
  }
  document.body.append(modal)
  cancel.focus()
}

// --- Loading ---

async function load() {
  const guildID = wanted
  if (!guildID) return
  clearTimeout(timer)
  const seen = edits
  try {
    const res = await api.canvas(guildID, state?.guildID === guildID ? state.etag : '')
    if (wanted !== guildID) return
    // Something changed here meanwhile: this answer is older than it, the next check isn't.
    if (res && (seen === edits || state?.guildID !== guildID)) {
      state = { guildID, canvas: res.canvas, etag: res.etag }
      hover = null
      changed()
    }
  } catch {
    // A server the viewer can't see, or the API is down: no canvas, and try again later.
    if (wanted !== guildID) return
    if (!state || state.guildID !== guildID) unmount()
  }
  if (wanted === guildID) timer = window.setTimeout(poll, pollMs)
}

// poll checks for other people's drawings while the page is visible. Pages in the background
// check again as soon as they come back.
function poll() {
  if (document.visibilityState === 'visible' && !drawing) void load()
  else timer = window.setTimeout(poll, pollMs)
}

function changed() {
  const st = state
  const on = !!st && st.canvas.enabled
  if (on) mount()
  else unmount()
  if (st && el) moderateBtn.hidden = !st.canvas.can_moderate
  paint()
  notify()
}

function notify() {
  listeners.forEach((fn) => fn())
}

function mount() {
  const layer = build()
  if (!layer.isConnected) document.body.prepend(layer)
  if (!dock.isConnected) document.body.append(dock, bar)
  document.body.classList.add('has-canvas')
  fit()
}

function unmount() {
  if (!el) return
  setMode(null)
  el.remove()
  dock.remove()
  bar.remove()
  document.body.classList.remove('has-canvas')
}

// --- Drawing ---

const allStrokes = () => [...(state?.canvas.strokes ?? []), ...pending]

function fit() {
  if (!el) return
  const r = devicePixelRatio || 1
  el.width = Math.round(innerWidth * r)
  el.height = Math.round(innerHeight * r)
  el.style.width = `${innerWidth}px`
  el.style.height = `${innerHeight}px`
  ctx?.setTransform(r, 0, 0, r, 0, 0)
  paint()
}

function screenPoints(st: Pick<api.CanvasStroke, 'anchor' | 'points'>): [number, number][] {
  const k = scaleFor(innerWidth)
  const ax = st.anchor[0] * innerWidth
  const ay = st.anchor[1] * innerHeight
  const out: [number, number][] = []
  for (let i = 0; i + 1 < st.points.length; i += 2) out.push([ax + st.points[i] * k, ay + st.points[i + 1] * k])
  return out
}

function box(st: Pick<api.CanvasStroke, 'anchor' | 'points'>): Box {
  const b: Box = [Infinity, Infinity, -Infinity, -Infinity]
  for (const [x, y] of screenPoints(st)) {
    b[0] = Math.min(b[0], x)
    b[1] = Math.min(b[1], y)
    b[2] = Math.max(b[2], x)
    b[3] = Math.max(b[3], y)
  }
  return b
}

function trace(st: api.CanvasStroke) {
  if (!ctx) return
  const p = screenPoints(st)
  if (p.length === 0) return
  ctx.beginPath()
  ctx.moveTo(p[0][0], p[0][1])
  for (let i = 1; i < p.length - 1; i++) ctx.quadraticCurveTo(p[i][0], p[i][1], (p[i][0] + p[i + 1][0]) / 2, (p[i][1] + p[i + 1][1]) / 2)
  const last = p[p.length - 1]
  ctx.lineTo(last[0], last[1])
}

function paint() {
  if (!ctx || !el?.isConnected) return
  ctx.clearRect(0, 0, innerWidth, innerHeight)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  const width = 4 * Math.max(0.75, scaleFor(innerWidth))
  const picking = mode === 'erase' || mode === 'moderate'
  const strokes = [...allStrokes(), ...(drawing ? [drawing.stroke] : [])]
  for (const st of strokes) {
    const lit = hover === st.drawing_id
    if (lit) {
      trace(st)
      ctx.strokeStyle = 'rgba(208, 59, 59, 0.25)'
      ctx.lineWidth = width + 12
      ctx.stroke()
    }
    // While picking, what can't be picked fades.
    ctx.globalAlpha = picking && !lit && !(mode === 'moderate' || st.mine) ? 0.35 : picking && !lit ? 0.6 : 1
    trace(st)
    ctx.strokeStyle = penColors[st.color] ?? penColors[0]
    ctx.lineWidth = width
    ctx.stroke()
    ctx.globalAlpha = 1
  }
}

// hit returns the drawing under (x, y) that the current mode may pick.
function hit(x: number, y: number): api.CanvasStroke | null {
  let best: api.CanvasStroke | null = null
  let bestD = 10
  for (const st of allStrokes()) {
    if (mode === 'erase' && !st.mine) continue
    const p = screenPoints(st)
    for (let i = 0; i + 1 < p.length; i++) {
      const [ax, ay] = p[i]
      const [bx, by] = p[i + 1]
      const dx = bx - ax
      const dy = by - ay
      const l = dx * dx + dy * dy || 1
      const u = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l))
      const d = Math.hypot(x - ax - u * dx, y - ay - u * dy)
      if (d < bestD) {
        bestD = d
        best = st
      }
    }
  }
  return best
}

// startStroke begins a stroke at (x, y). It continues the viewer's last drawing if that was
// drawn moments ago close by, so a drawing made of several strokes is erased as one.
function startStroke(x: number, y: number, color: number) {
  const now = Date.now()
  const k = scaleFor(innerWidth)
  const point: Box = [x, y, x, y]
  const near = [...allStrokes()]
    .reverse()
    .find((st) => st.mine && now - Date.parse(st.created_at) < sameDrawingMs && gap(box(st), point) < sameDrawingPx * k)
  const anchor: [number, number] = near ? near.anchor : [x / innerWidth, y / innerHeight]
  const first = localPoint(anchor, x, y, innerWidth, innerHeight)
  drawing = {
    stroke: {
      id: '',
      drawing_id: near ? near.drawing_id : newDrawingID(),
      color,
      anchor,
      points: [...first],
      mine: true,
      created_at: new Date(now).toISOString(),
    },
    last: first,
  }
}

function extendStroke(x: number, y: number) {
  if (!drawing) return
  const p = localPoint(drawing.stroke.anchor, x, y, innerWidth, innerHeight)
  if (Math.hypot(p[0] - drawing.last[0], p[1] - drawing.last[1]) < 2) return
  drawing.stroke.points.push(...p)
  drawing.last = p
  // A very long line is cut into strokes of the same drawing.
  if (drawing.stroke.points.length >= 2 * maxPoints) {
    const { color } = drawing.stroke
    endStroke()
    startStroke(x, y, color)
  }
  paint()
}

function endStroke() {
  const d = drawing
  drawing = null
  if (!d || d.stroke.points.length < 4 || !state) return paint()
  const st = d.stroke
  pending.push(st)
  paint()
  notify()
  void save(state.guildID, st)
}

async function save(guildID: string, st: api.CanvasStroke) {
  try {
    const res = await api.addCanvasStroke(guildID, { drawing_id: st.drawing_id, color: st.color, anchor: st.anchor, points: st.points })
    pending = pending.filter((x) => x !== st)
    edits++
    if (erasedWhileSaving.has(st.drawing_id)) {
      // Erased while it was being saved: erase it from the server too.
      try {
        const { version } = await api.deleteCanvasDrawing(guildID, st.drawing_id)
        if (state?.guildID === guildID) state.canvas.version = version
      } catch {
        // Already gone, or it shows up again at the next check and can be erased then.
      }
    } else if (state?.guildID === guildID && !state.canvas.strokes.some((x) => x.id === res.stroke.id)) {
      // (A check that ran meanwhile may have brought it already.)
      state.canvas.strokes.push(res.stroke)
      state.canvas.version = res.version
    }
  } catch (err) {
    // The demo keeps its drawings on the page, unsaved, as it says at the top.
    if (err instanceof api.DemoReadOnly) return
    pending = pending.filter((x) => x !== st)
    // 409 is a full canvas, or one turned off meanwhile.
    const full = err instanceof api.ApiError && err.status === 409 && /full/.test(err.message)
    const tooMany = err instanceof api.ApiError && err.status === 429
    flash(t(full ? 'canvas.error.full' : tooMany ? 'canvas.error.tooMany' : 'canvas.error.save'))
    if (err instanceof api.ApiError) reloadCanvas()
  }
  paint()
  notify()
}

async function erase(st: api.CanvasStroke) {
  const guildID = state?.guildID
  if (!state || !guildID) return
  const before = { strokes: state.canvas.strokes, pending }
  // Members only erase their own strokes, even of a drawing ID someone else used too.
  const goes = (x: api.CanvasStroke) => x.drawing_id === st.drawing_id && (mode === 'moderate' || x.mine)
  state.canvas.strokes = state.canvas.strokes.filter((x) => !goes(x))
  if (!api.isDemo && pending.some(goes)) erasedWhileSaving.add(st.drawing_id)
  pending = pending.filter((x) => !goes(x))
  edits++
  hover = null
  closePop()
  paint()
  notify()
  // Drawings never saved (in the demo) are gone already.
  if (api.isDemo || !before.strokes.some((x) => x.drawing_id === st.drawing_id)) return
  try {
    const { version } = await api.deleteCanvasDrawing(guildID, st.drawing_id)
    if (state?.guildID === guildID) state.canvas.version = version
  } catch (err) {
    // Already gone is fine; anything else puts it back.
    if (err instanceof api.NotFound) return
    if (state?.guildID === guildID) {
      state.canvas.strokes = before.strokes
      pending = before.pending
    }
    flash(t('canvas.error.erase'))
    paint()
    notify()
  }
}

// --- Modes, bar and popover ---

function setMode(m: Mode) {
  if (drawing) endStroke()
  mode = m
  if (!el) return
  hover = null
  closePop()
  document.body.classList.toggle('canvas-active', m !== null)
  document.body.classList.toggle('canvas-picking', m === 'erase' || m === 'moderate')
  pens.forEach((b, i) => b.setAttribute('aria-pressed', String(isPen(m) && m.pen === i)))
  eraseBtn.setAttribute('aria-pressed', String(m === 'erase'))
  moderateBtn.setAttribute('aria-pressed', String(m === 'moderate'))
  showBar()
  paint()
}

function showBar(message?: string) {
  if (!el) return
  const done = h('button', { type: 'button', class: 'btn btn-primary btn-small' }, t('canvas.done'))
  done.onclick = () => setMode(null)
  if (!mode) return bar.replaceChildren(...(message ? [h('span', { class: 'canvas-bar-error' }, message)] : []))
  const text = message
    ? h('span', { class: 'canvas-bar-error' }, message)
    : isPen(mode)
      ? h('span', {}, t('canvas.drawing'), h('span', { class: 'canvas-bar-hint' }, t('canvas.drawing.hint')))
      : h('span', {}, t(mode === 'erase' ? 'canvas.erasing' : 'canvas.moderating'))
  const dot = isPen(mode) ? penDot(mode.pen, true) : null
  const clear = mode === 'moderate' ? h('button', { type: 'button', class: 'btn btn-danger-outline btn-small' }, t('canvas.clear')) : null
  if (clear) clear.onclick = confirmClear
  bar.replaceChildren(...[dot, text, clear, done].filter((x): x is HTMLElement => x !== null))
  const top = document.querySelector('.topbar')?.getBoundingClientRect().bottom
  bar.style.top = innerWidth > 1180 && top ? `${top + 16}px` : ''
}

let flashTimer: number | undefined
function flash(message: string) {
  showBar(message)
  clearTimeout(flashTimer)
  flashTimer = window.setTimeout(() => showBar(), 5000)
}

function closePop() {
  pop?.remove()
  pop = null
}

const relative = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' })
function ago(iso: string): string {
  const mins = (Date.now() - Date.parse(iso)) / 60_000
  if (mins < 60) return relative.format(-Math.max(1, Math.round(mins)), 'minute')
  if (mins < 24 * 60) return relative.format(-Math.round(mins / 60), 'hour')
  return relative.format(-Math.round(mins / (24 * 60)), 'day')
}

function openPop(st: api.CanvasStroke, x: number, y: number) {
  closePop()
  const del = h('button', { type: 'button', class: 'btn btn-danger btn-small' }, t('canvas.deleteDrawing'))
  del.onclick = () => void erase(st)
  pop = h(
    'div',
    { class: 'canvas-pop', role: 'dialog', 'aria-label': t('canvas.moderate') },
    h(
      'p',
      { class: 'canvas-who' },
      penDot(st.color, true),
      h('strong', {}, st.author?.username || (st.mine ? t('canvas.you') : '?')),
      h('span', { class: 'muted' }, ` · ${ago(st.created_at)}`),
    ),
    del,
  )
  document.body.append(pop)
  const r = pop.getBoundingClientRect()
  pop.style.left = `${Math.min(innerWidth - r.width - 12, Math.max(12, x + 14))}px`
  pop.style.top = `${Math.min(innerHeight - r.height - 12, Math.max(12, y + 14))}px`
  del.focus()
}
