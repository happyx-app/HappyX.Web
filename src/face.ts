// The logo, drawn live: the same face as logo.svg, but its sunglasses follow the pointer and the
// face reacts a little to what happens on the page (a kudo, a saved form, a long pause). At rest it
// is the icon. Nothing moves, and no loop runs, for people who ask the system for less motion.
//
// Styles are set through SVG attributes only: the production CSP blocks style attributes.

import { s } from './dom'

export type Mood = 'happy' | 'proud'

// What the page tells the face. Anything can send it: react('happy').
export const react = (mood: Mood) => document.dispatchEvent(new CustomEvent<Mood>('happyx:mood', { detail: mood }))

// The pose the face is drawn in, in logo.svg units (a 64 × 64 box; at 28 px one unit is 0.44 px).
type Pose = {
  gx: number // glasses offset
  gy: number
  tilt: number // glasses rotation, degrees
  mouthW: number // half width of the mouth
  mouthY: number // y of the mouth corners
  smile: number // depth of the smile curve
  open: number // extra depth of the lower lip: 0 is the plain line of the icon
}
const keys: (keyof Pose)[] = ['gx', 'gy', 'tilt', 'mouthW', 'mouthY', 'smile', 'open']
const rest: Pose = { gx: 0, gy: 0, tilt: 0, mouthW: 11.2, mouthY: 40.8, smile: 5, open: 0 }
const zero: Pose = { gx: 0, gy: 0, tilt: 0, mouthW: 0, mouthY: 0, smile: 0, open: 0 }
const mouthKeys = new Set<keyof Pose>(['mouthW', 'mouthY', 'smile', 'open'])

// How far the glasses may travel towards the pointer: about a pixel at 28 px, a glance. Less and
// nobody sees it; more and the bar's overhang past the face turns lopsided.
const reach = { x: 2.2, y: 1.5 }
const sleepAfter = 120_000
const glanceAfter = 20_000

// Springs, one per part, so the parts don't move as one block: the glasses trail the look with a
// small overshoot, the mouth is quicker, the lens shine lags behind the glasses.
type Spring = { k: number; damp: number }
const springs: Record<'glasses' | 'mouth' | 'shine' | 'doze', Spring> = {
  glasses: { k: 0.09, damp: 0.72 },
  mouth: { k: 0.16, damp: 0.62 },
  shine: { k: 0.06, damp: 0.78 },
  doze: { k: 0.02, damp: 0.8 }, // falling asleep is slow and heavy
}

const reducedMotion = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null
const touchOnly = () => typeof matchMedia === 'function' && matchMedia('(hover: none)').matches

type Face = {
  svg: SVGSVGElement
  glasses: SVGGElement
  shine: SVGPathElement
  mouth: SVGPathElement
  pose: Pose
  speed: Pose
  shineAt: { x: number; y: number; vx: number; vy: number }
  center: { x: number; y: number } | null
  hover: boolean
}

const faces = new Set<Face>()
let uid = 0

const lensPath =
  'M7.6 21.6h48.8v3.6l-1.4.6c-.4 4.6-1.6 8.6-4.8 10.6-3.4 2-8.6 1.8-11.6-.8-1.8-1.6-2.6-4-3.6-6.2-.8-1.6-1.8-2-3-2s-2.2.4-3 2c-1 2.2-1.8 4.6-3.6 6.2-3 2.6-8.2 2.8-11.6.8-3.2-2-4.4-6-4.8-10.6l-1.4-.6z'

export function face(cls = 'brand-mark'): SVGSVGElement {
  const id = `face-${++uid}`
  const shine = s('path', { d: 'M13.4 27.6c.4-1.6 1.6-2.6 3-2.6M43.4 27.6c.4-1.6 1.6-2.6 3-2.6', stroke: '#8a6131', 'stroke-width': 2.4, 'stroke-linecap': 'round', fill: 'none' })
  const glasses = s(
    'g',
    {},
    s('path', { d: lensPath, fill: '#352310' }),
    // The shine stays inside the lenses whatever it does.
    s('g', { 'clip-path': `url(#${id}-lens)` }, shine),
  )
  const mouth = s('path', { d: mouthPath(rest), stroke: '#352310', 'stroke-width': 2.8, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', fill: 'none' })
  const svg = s(
    'svg',
    { class: cls, viewBox: '0 0 64 64', 'aria-hidden': 'true', focusable: 'false' },
    s(
      'defs',
      {},
      s(
        'radialGradient',
        { id, cx: 0.42, cy: 0.35, r: 0.7 },
        s('stop', { offset: 0, 'stop-color': '#ffe74a' }),
        s('stop', { offset: 0.6, 'stop-color': '#fdd225' }),
        s('stop', { offset: 1, 'stop-color': '#f7b51c' }),
      ),
      s('clipPath', { id: `${id}-lens` }, s('path', { d: lensPath })),
    ),
    s('rect', { width: 64, height: 64, rx: 14, fill: '#8b5cf6' }),
    s('circle', { cx: 32.8, cy: 33.6, r: 23.6, fill: '#f29a0c' }),
    s('circle', { cx: 32, cy: 32.8, r: 23.4, fill: `url(#${id})` }),
    glasses,
    mouth,
  )
  const f: Face = { svg, glasses, shine, mouth, pose: { ...rest }, speed: { ...zero }, shineAt: { x: 0, y: 0, vx: 0, vy: 0 }, center: null, hover: false }
  faces.add(f)
  svg.addEventListener('pointerenter', () => setHover(f, true))
  svg.addEventListener('pointerleave', () => setHover(f, false))
  // Keyboard focus on the logo's link smiles like the pointer does.
  queueMicrotask(() => {
    const link = svg.closest('a')
    link?.addEventListener('focusin', () => setHover(f, true))
    link?.addEventListener('focusout', () => setHover(f, false))
  })
  start()
  return svg
}

function setHover(f: Face, on: boolean) {
  f.hover = on
  wake()
}

// The mouth is a closed shape: the icon's curve on top and a second curve below it. With `open`
// at 0 it is the icon's own path, so the resting face is the icon.
function mouthPath(p: Pose) {
  const x0 = 32 - p.mouthW
  const w = p.mouthW * 2
  const top = `c${f2(w * 0.3036)} ${f2(p.smile)} ${f2(w * 0.6964)} ${f2(p.smile)} ${f2(w)} 0`
  if (p.open < 0.05) return `M${f2(x0)} ${f2(p.mouthY)}${top}`
  const d = p.smile + p.open * 1.6
  return `M${f2(x0)} ${f2(p.mouthY)}${top}c${f2(-w * 0.3036)} ${f2(d)} ${f2(-w * 0.6964)} ${f2(d)} ${f2(-w)} 0z`
}
const f2 = (n: number) => (Math.round(n * 100) / 100).toString()

// --- One shared loop for every face on the page (the header and the landing footer). ---

let started = false
let pointer: { x: number; y: number } | null = null
let lastInput = 0
let mood: { name: Mood; at: number } | null = null
let glance: { dir: number; at: number } | null = null
let woke = -1e9 // when the face last woke from a doze, for its little start
let asleep = false
let raf = 0
let timer = 0
let last = 0
let acc = 0

const moodMs: Record<Mood, number> = { happy: 1500, proud: 1400 }

function start() {
  if (started) return
  started = true
  lastInput = performance.now()
  const input = (e?: PointerEvent) => {
    if (e) pointer = { x: e.clientX, y: e.clientY }
    if (asleep) woke = performance.now()
    asleep = false
    lastInput = performance.now()
    glance = null
    wake()
  }
  addEventListener('pointermove', input, { passive: true })
  addEventListener('pointerdown', input, { passive: true })
  addEventListener('keydown', () => input())
  addEventListener('scroll', () => {
    faces.forEach((f) => (f.center = null))
    input()
  }, { passive: true })
  addEventListener('resize', () => faces.forEach((f) => (f.center = null)))
  // The pointer left the window: look ahead again.
  document.addEventListener('pointerout', (e) => {
    if (!e.relatedTarget) {
      pointer = null
      wake()
    }
  })
  addEventListener('blur', () => {
    pointer = null
    wake()
  })
  document.addEventListener('happyx:mood', (e) => {
    const name = (e as CustomEvent<Mood>).detail
    if (!(name in moodMs)) return
    mood = { name, at: performance.now() }
    lastInput = performance.now()
    asleep = false
    wake()
  })
  document.addEventListener('visibilitychange', () => !document.hidden && wake())
  reducedMotion?.addEventListener('change', wake)
  wake()
}

// (Re)starts the frame loop; it stops by itself once every face has settled.
function wake() {
  clearTimeout(timer)
  if (reducedMotion?.matches) return still()
  if (raf) return
  last = performance.now()
  acc = 0
  raf = requestAnimationFrame(frame)
}

// Where each face wants to be right now.
function target(f: Face, now: number): { pose: Pose; doze: boolean; glint: number; shine: number } {
  const p = { ...rest }
  let glint = 0
  let shine = 1
  const quiet = now - lastInput
  // On a phone the face looks at a tap for a few seconds, then ahead again.
  if (pointer && (!touchOnly() || quiet < 3000)) {
    if (!f.center) {
      const r = f.svg.getBoundingClientRect()
      f.center = { x: r.left + r.width / 2, y: r.top + r.height / 2 }
    }
    const dx = pointer.x - f.center.x
    const dy = pointer.y - f.center.y
    // Close by the glasses barely move; far away they reach their limit.
    const dist = Math.hypot(dx, dy) || 1
    const k = Math.min(1, dist / 260)
    p.gx = (dx / dist) * k * reach.x
    p.gy = (dy / dist) * k * reach.y
  }
  // A long pause: the glasses slide straight down the nose and the smile softens. Kept level, as
  // tilted glasses read as a broken icon. Not on phones, where the screen sits still for long.
  const doze = quiet > sleepAfter && !mood && !touchOnly()
  if (doze) {
    p.gx = 0
    p.gy = 2.2
    p.smile = 4
    // On the way down the head drops and catches itself once.
    const t = quiet - sleepAfter
    if (t > 2000 && t < 2600) p.gy += 1.2
  } else if (f.hover) Object.assign(p, { mouthW: 12, mouthY: 40.3, smile: 6.6 })
  // Without a pointer to follow (a phone, or the pointer outside the window), the face glances
  // aside once after a while, then not again until someone does something.
  if (!pointer && !doze && quiet > glanceAfter && !glance) glance = { dir: Math.random() < 0.5 ? -1 : 1, at: now }
  if (glance && now - glance.at < 700) {
    p.gx = glance.dir * 2
    p.gy = 0.6
  }
  // Woken up: a quick start upwards.
  if (now - woke < 120) {
    p.gy = -1.2
    p.tilt = 0
  }
  if (mood) {
    const t = now - mood.at
    if (mood.name === 'happy') {
      // Crouch, hop, land; the mouth opens just after take-off; the shine sweeps across once.
      if (t < 90) p.gy += 0.8
      else if (t < 330) p.gy -= 3 * Math.sin(((t - 90) / 240) * (Math.PI / 2))
      else if (t < 450) p.gy += 0.5
      if (t > 150) Object.assign(p, { mouthW: 12.2, mouthY: 40.2, smile: 6, open: 3.2 })
      // It fades out at the end of its run and comes back in its place, instead of sliding back.
      if (t > 120 && t < 400) glint = 4 * easeInOut((t - 120) / 280)
      if (t > 330 && t < 400) shine = 1 - (t - 330) / 70
      else if (t >= 400 && t < 550) shine = (t - 400) / 150
    } else {
      // Proud: two little nods (down only, tipping one way then the other), then a broad smile.
      if (t < 700) {
        p.gy += (1.8 * (1 - Math.cos((t / 700) * Math.PI * 4))) / 2
        p.tilt += t < 350 ? 2 : -2
      }
      if (t > 600) Object.assign(p, { mouthW: 12.4, mouthY: 40, smile: 7 })
    }
  }
  return { pose: p, doze, glint, shine }
}

// Less motion asked for: the plain icon, drawn once, no frames.
function still() {
  cancelAnimationFrame(raf)
  raf = 0
  for (const f of faces) {
    f.pose = { ...rest }
    f.speed = { ...zero }
    f.shineAt = { x: 0, y: 0, vx: 0, vy: 0 }
    draw(f, 0, 1)
  }
}

const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2)
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))
const step = 1000 / 60

function frame(ts: number) {
  raf = 0
  if (document.hidden) return
  if (reducedMotion?.matches) return still()
  const now = performance.now()
  if (mood && now - mood.at > moodMs[mood.name]) mood = null
  // Fixed 60 Hz steps, so the springs feel the same on a 120 Hz screen.
  acc = Math.min(acc + (ts - last), 100)
  last = ts
  const steps = Math.floor(acc / step)
  acc -= steps * step
  let moving = false
  let dozing = false
  for (const f of faces) {
    if (!f.svg.isConnected) {
      faces.delete(f)
      continue
    }
    const { pose: goal, doze, glint, shine } = target(f, now)
    dozing ||= doze
    for (let i = 0; i < steps; i++) {
      for (const k of keys) {
        const sp = mouthKeys.has(k) ? springs.mouth : doze && (k === 'gy' || k === 'tilt') ? springs.doze : springs.glasses
        f.speed[k] = (f.speed[k] + (goal[k] - f.pose[k]) * sp.k) * sp.damp
        f.pose[k] += f.speed[k]
      }
      // They lean a touch into a sideways move.
      f.pose.tilt = clamp(f.pose.tilt + f.speed.gx * 3, -4, 4)
      // The shine follows the glasses a beat late.
      const sh = f.shineAt
      sh.vx = (sh.vx + (f.pose.gx * 0.35 - sh.x) * springs.shine.k) * springs.shine.damp
      sh.vy = (sh.vy + (f.pose.gy * 0.35 - sh.y) * springs.shine.k) * springs.shine.damp
      sh.x += sh.vx
      sh.y += sh.vy
    }
    for (const k of keys) if (Math.abs(goal[k] - f.pose[k]) > 0.01 || Math.abs(f.speed[k]) > 0.01) moving = true
    if (Math.abs(f.shineAt.vx) > 0.005 || Math.abs(f.shineAt.vy) > 0.005 || glint) moving = true
    draw(f, glint, shine)
  }
  asleep = dozing
  const quiet = now - lastInput
  const timed = mood || now - woke < 200 || (glance && now - glance.at < 800) || (dozing && quiet - sleepAfter < 3000)
  if (moving || timed) {
    raf = requestAnimationFrame(frame)
    return
  }
  // Settled: no frames until something happens or the next timed moment (a glance, a doze, the
  // end of a phone tap's look).
  const next = [glance ? -1 : glanceAfter - quiet, sleepAfter - quiet, pointer && touchOnly() ? 3000 - quiet : -1].filter((n) => n > 0)
  if (next.length) timer = window.setTimeout(wake, Math.min(...next) + 20)
}

function draw(f: Face, glint: number, shine: number) {
  const p = f.pose
  f.glasses.setAttribute('transform', `translate(${f2(p.gx)} ${f2(p.gy)}) rotate(${f2(p.tilt)} 32 29)`)
  f.shine.setAttribute('transform', `translate(${f2(f.shineAt.x + glint)} ${f2(f.shineAt.y)})`)
  f.shine.setAttribute('opacity', f2(clamp(shine, 0, 1)))
  f.mouth.setAttribute('d', mouthPath(p))
  f.mouth.setAttribute('fill', p.open < 0.05 ? 'none' : '#352310')
}
