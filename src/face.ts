// The logo, drawn live: the same face as logo.svg, but its sunglasses follow the pointer and the
// face reacts a little to what happens on the page (a kudo, a saved form, a long pause). At rest it
// is the icon. Nothing moves, and no loop runs, for people who ask the system for less motion.
//
// Styles are set through SVG attributes only: the production CSP blocks style attributes.

import { s } from './dom'
import { confettiFrom, heartsFrom, sparksAt, starsFrom, zzzFrom } from './effects'

export type Mood = 'happy' | 'proud' | 'kiss' | 'tongue' | 'peek' | 'peek-all' | 'starry' | 'night' | 'day' | 'wink'

// What the page tells the face. Anything can send it: react('happy').
export const react = (mood: Mood) => document.dispatchEvent(new CustomEvent<Mood>('happyx:mood', { detail: mood }))

// A click on the logo: it sticks its tongue out. Ten quick clicks in a row (under 0.7 s apart)
// earn a kiss instead, a small secret that nobody comes across by accident.
let pokes = 0
let pokedAt = 0
export function poke(): number {
  const now = performance.now()
  pokes = now - pokedAt < 700 ? pokes + 1 : 1
  pokedAt = now
  const n = pokes
  if (pokes >= 10) {
    pokes = 0
    react('kiss')
  } else react('tongue')
  return n
}

// The pose the face is drawn in, in logo.svg units (a 64 × 64 box; at 28 px one unit is 0.44 px).
type Pose = {
  gx: number // glasses offset
  gy: number
  tilt: number // glasses rotation, degrees
  mouthW: number // half width of the mouth
  mouthY: number // y of the mouth corners
  smile: number // depth of the smile curve
  open: number // extra depth of the lower lip: 0 is the plain line of the icon
  ly: number // the up/down part of the look alone, without hops, nods or the doze
  tongue: number // how far the tongue is out, 0 to 1
  mx: number // sideways shift of the mouth, for a pucker or a «hmm» to one side
  eyes: number // how much the eyes under the glasses show, 0 to 1
  brow: number // how far the eyes lift, for a «well, well»
  dizzy: number // spiral eyes, 0 to 1
  star: number // star eyes under glasses pushed up, 0 to 1
  wink: number // the right eye closed, 0 to 1
  look: number // open eyes instead of smiling ones, 0 to 1
  wave: number // a wavy mouth instead of the smile, 0 to 1
}
const keys: (keyof Pose)[] = ['gx', 'gy', 'tilt', 'mouthW', 'mouthY', 'smile', 'open', 'ly', 'tongue', 'mx', 'eyes', 'brow', 'dizzy', 'wave', 'star', 'wink', 'look']
const rest: Pose = { gx: 0, gy: 0, tilt: 0, mouthW: 11.2, mouthY: 40.8, smile: 5, open: 0, ly: 0, tongue: 0, mx: 0, eyes: 0, brow: 0, dizzy: 0, wave: 0, star: 0, wink: 0, look: 0 }
const zero: Pose = { gx: 0, gy: 0, tilt: 0, mouthW: 0, mouthY: 0, smile: 0, open: 0, ly: 0, tongue: 0, mx: 0, eyes: 0, brow: 0, dizzy: 0, wave: 0, star: 0, wink: 0, look: 0 }
const mouthKeys = new Set<keyof Pose>(['mouthW', 'mouthY', 'smile', 'open', 'tongue', 'mx', 'eyes', 'brow', 'dizzy', 'wave', 'star', 'wink', 'look'])

// How far the glasses may travel towards the pointer: about two pixels at 28 px, enough to read
// where the face looks. Chosen by eye over a smaller travel that nobody noticed.
const reach = { x: 4.2, y: 2.6 }
const sleepAfter = 120_000
const glanceAfter = 20_000
const thinkAfter = 600

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
  shine: SVGPathElement[]
  halves: SVGGElement[] // left and right half of the glasses, warped apart to fake a head turn
  cut: SVGGElement // the left half's cut, lifted while facing front
  cutClip: string
  shade: SVGCircleElement // the orange rim behind the face
  light: SVGRadialGradientElement // the face's highlight
  mouth: SVGPathElement
  tongue: SVGPathElement
  eyes: SVGPathElement
  heart: SVGPathElement
  pose: Pose
  speed: Pose
  shineAt: { x: number; y: number; vx: number; vy: number }
  center: { x: number; y: number } | null
  hover: boolean
  lens: SVGPathElement // the right half's lens, hidden while facing front
  still?: boolean // drawn at rest for reduced motion
  bg: SVGRectElement // the violet square, left behind when the face is taken out
  spirals: SVGGElement[] // the dizzy eyes, one per side, so each can spin
  stars: SVGPathElement[] // the stars that circle a dizzy head
  starEyes: SVGPathElement[] // eyes like stars, for a kudo
  hole: SVGSVGElement // what stays in the header while the face is out: the square and a dent
  free: Free | null // out of its square, held or flying around the screen
  dizzyAt: number // when it last hit an edge hard, or was spun round
  swirl: { sum: number; at: number; a: number } // the pointer circling round it
  lastZ: number // when the last «z» left it while asleep
  eyesD: string // the eyes' path as drawn, to change it only when the wink changes
  hat: SVGGElement[] // a winter hat in winter: its crown under the glasses, its ear flaps over them
}

// A face out of its square. (x, y) is its centre on the screen; speeds are in pixels per step.
type Free = {
  x: number
  y: number
  vx: number
  vy: number
  angle: number
  spin: number
  scale: number
  held: number | null // the pointer holding it
  off: { x: number; y: number } // where it was grabbed, from its centre
  samples: { x: number; y: number; t: number }[] // the last moves, for the speed of a throw
  home: { from: { x: number; y: number; angle: number; scale: number }; at: number } | null // flying back
  bounced: number // when it last hit an edge hard
  restAt: number // when it last moved: left alone long enough, it falls asleep where it is
}

const faces = new Set<Face>()
let uid = 0

const eyesPath = 'M15.2 25.8q4.3-5 8.6 0M40.2 25.8q4.3-5 8.6 0'
const dot = (x: number, y = 27.3) => `M${x - 2.4} ${y}a2.4 3.2 0 1 0 4.8 0a2.4 3.2 0 1 0-4.8 0`
const winkPath = `${dot(19.5, 24.2)}M40.2 24.4q4.3 2.6 8.6 0` // the left eye open, the right one shut
const openPath = `${dot(19.5)}${dot(44.5)}` // plain open eyes
const parkedSleep = 45_000 // a face out of its square, left alone this long, falls asleep there
const zEvery = 1800 // a «z» lasts 2.2 s, so they overlap
const zFor = 60_000 // then it sleeps on without them, and the loop rests

const lensPath =
  'M7.6 21.6h48.8v3.6l-1.4.6c-.4 4.6-1.6 8.6-4.8 10.6-3.4 2-8.6 1.8-11.6-.8-1.8-1.6-2.6-4-3.6-6.2-.8-1.6-1.8-2-3-2s-2.2.4-3 2c-1 2.2-1.8 4.6-3.6 6.2-3 2.6-8.2 2.8-11.6.8-3.2-2-4.4-6-4.8-10.6l-1.4-.6z'

// Each page render builds a new header. Passing a slot ('header', 'footer') hands back the same
// face as last time, so an animation that started on a click (the tongue on the way to the home
// page) carries on in the new header instead of restarting from the icon.
const kept = new Map<string, Face>()

export function face(cls = 'brand-mark', slot?: string): SVGSVGElement {
  const old = slot ? kept.get(slot) : undefined
  if (old) {
    old.center = null
    old.hover = false
    faces.add(old)
    wake()
    // Out of its square: the new header gets the empty square, and the face stays where it is.
    return old.free ? old.hole : old.svg
  }
  const id = `face-${++uid}`
  const shineOf = (d: string) => s('path', { d, stroke: '#8a6131', 'stroke-width': 2.4, 'stroke-linecap': 'round', fill: 'none' })
  const shine = [shineOf('M13.4 27.6c.4-1.6 1.6-2.6 3-2.6'), shineOf('M43.4 27.6c.4-1.6 1.6-2.6 3-2.6')]
  // The glasses are drawn twice, each copy cut at the bridge, so each lens can be squeezed on its
  // own while they still meet at the bridge. The shine stays inside the lenses whatever it does.
  const halves = [0, 1].map((i) =>
    s('g', {}, s('g', { 'clip-path': `url(#${id}-${i ? 'r' : 'l'})` }, s('path', { d: lensPath, fill: '#352310' }), s('g', { 'clip-path': `url(#${id}-lens)` }, shine[i]))),
  )
  const glasses = s('g', {}, ...halves)
  // Smiling eyes, «^ ^», in the mouth's stroke, drawn under the lenses. They show only while the
  // glasses are down the nose in the game's gesture; the rest of the time they are transparent.
  const eyes = s('path', { d: eyesPath, stroke: '#352310', 'stroke-width': 2.8, 'stroke-linecap': 'round', fill: 'none', opacity: 0 })
  const shade = s('circle', { cx: 32.8, cy: 33.6, r: 23.6, fill: '#f29a0c' })
  const light = s(
    'radialGradient',
    { id, cx: 0.42, cy: 0.35, r: 0.7 },
    s('stop', { offset: 0, 'stop-color': '#ffe74a' }),
    s('stop', { offset: 0.6, 'stop-color': '#fdd225' }),
    s('stop', { offset: 1, 'stop-color': '#f7b51c' }),
  )
  const mouth = s('path', { d: mouthPath(rest), stroke: '#352310', 'stroke-width': 2.8, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', fill: 'none' })
  // Drawn in the icon's own manner: a flat fill with the same dark outline.
  const tongue = s('path', { d: '', fill: '#f2577a', stroke: '#352310', 'stroke-width': 2, 'stroke-linejoin': 'round', visibility: 'hidden' })
  const heart = s('path', {
    d: 'M0 3.2C-1.2 2.2-4.4 0-4.4-2c0-1.6 1.2-2.4 2.3-2.4 1 0 1.7.6 2.1 1.3.4-.7 1.1-1.3 2.1-1.3 1.1 0 2.3.8 2.3 2.4 0 2-3.2 4.2-4.4 5.2z',
    fill: '#f43f5e',
    // Outlined like the rest of the icon, or it melts into the violet.
    stroke: '#352310',
    'stroke-width': 1.2,
    'stroke-linejoin': 'round',
    'paint-order': 'stroke',
    visibility: 'hidden',
  })
  // Dizzy eyes: two little spirals, under the lenses like the smiling ones.
  const spirals = [19.5, 44.5].map((x) =>
    s('g', { opacity: 0 }, s('path', { d: 'M1.5 0a1.5 1.5 0 0 1-3 0a2.25 2.25 0 0 1 4.5 0a3 3 0 0 1-6 0', transform: `translate(${x} 21.6) scale(1.6)`, stroke: '#352310', 'stroke-width': 1.5, 'stroke-linecap': 'round', fill: 'none' })),
  )
  const stars = [0, 1].map(() => s('path', { d: 'M0-3.4L.9-.9 3.4 0 .9.9 0 3.4-.9.9-3.4 0-.9-.9z', fill: '#facc15', stroke: '#352310', 'stroke-width': 1.2, 'stroke-linejoin': 'round', 'paint-order': 'stroke', visibility: 'hidden' }))
  // Star eyes: five-pointed, orange so they show on the yellow face, outlined like the icon.
  const starPath = 'M0-5.6L1.6-1.9 5.4-1.7 2.5.8 3.4 4.6 0 2.5-3.4 4.6-2.5.8-5.4-1.7-1.6-1.9z'
  const starEyes = [0, 1].map(() => s('path', { d: starPath, fill: '#f97316', stroke: '#352310', 'stroke-width': 2.2, 'stroke-linejoin': 'round', 'paint-order': 'stroke', visibility: 'hidden' }))
  const bg = s('rect', { width: 64, height: 64, rx: 14, fill: '#8b5cf6' })
  const hat = [11, 0, 1].includes(new Date().getMonth()) ? winterHat() : []
  const svg = s(
    'svg',
    { class: cls, viewBox: '0 0 64 64', 'aria-hidden': 'true', focusable: 'false' },
    s(
      'defs',
      {},
      light,
      s('clipPath', { id: `${id}-lens` }, s('path', { d: lensPath })),
      // The two cuts overlap by 3 units at the bridge: less and their soft edges leave a light seam.
      s('clipPath', { id: `${id}-l` }, s('rect', { x: 0, y: 0, width: 33.5, height: 64 })),
      s('clipPath', { id: `${id}-r` }, s('rect', { x: 30.5, y: 0, width: 33.5, height: 64 })),
    ),
    bg,
    shade,
    s('circle', { cx: 32, cy: 32.8, r: 23.4, fill: `url(#${id})` }),
    // Under the glasses, so glasses pushed up rest on its brim.
    ...hat.slice(0, 1),
    eyes,
    ...spirals,
    ...starEyes,
    glasses,
    ...hat.slice(1),
    mouth,
    tongue,
    heart,
    ...stars,
  )
  // The square the face leaves behind: the same violet, with the round dent where the face sat.
  const hole = s(
    'svg',
    { class: `${cls} brand-hole`, viewBox: '0 0 64 64', 'aria-hidden': 'true', focusable: 'false' },
    s('rect', { width: 64, height: 64, rx: 14, fill: '#8b5cf6' }),
    s('circle', { cx: 32, cy: 32.8, r: 23.4, fill: '#4c1d95' }),
    s('circle', { cx: 32, cy: 35.4, r: 21.6, fill: '#6d3fd6' }),
  )
  const f: Face = { svg, glasses, shine, halves, cut: halves[0].firstElementChild as SVGGElement, cutClip: `url(#${id}-l)`, shade, light, mouth, tongue, eyes, heart, pose: { ...rest }, speed: { ...zero }, shineAt: { x: 0, y: 0, vx: 0, vy: 0 }, center: null, hover: false, lens: halves[1].querySelector('path')!, bg, spirals, stars, starEyes, hole, free: null, dizzyAt: -1e9, swirl: { sum: 0, at: 0, a: 0 }, lastZ: 0, eyesD: eyesPath, hat }
  faces.add(f)
  if (slot) kept.set(slot, f)
  svg.addEventListener('pointerenter', () => setHover(f, true))
  svg.addEventListener('pointerleave', () => setHover(f, false))
  grabbable(f)
  start()
  return svg
}

// December to February: a knitted winter hat with ear flaps, for every team whatever it celebrates.
// Drawn like the icon (flat colours, dark outline). The crown sits on top of the head, so glasses
// pushed up rest on its band; the ear flaps hang over the ends of the glasses, as on a real head.
// It does not move on its own, so it shows with less motion too.
export function winterHat(): SVGGElement[] {
  const line = { stroke: '#352310', 'stroke-width': 1.8, 'stroke-linejoin': 'round' as const }
  const knit = '#14a39a'
  const wool = '#fbf7ee'
  const ribs = Array.from({ length: 10 }, (_, i) => `M${12 + i * 4.5} 14.2v4.2`).join('')
  const crown = s(
    'g',
    {},
    s('path', { d: 'M9.8 15.8C9.8 6.4 19.6 2.6 32 2.6s22.2 3.8 22.2 13.2z', fill: knit, ...line }),
    s('rect', { x: 7.4, y: 13, width: 49.2, height: 6.6, rx: 3.3, fill: wool, ...line }),
    s('path', { d: ribs, stroke: '#352310', 'stroke-width': 0.9, 'stroke-linecap': 'round', opacity: 0.35 }),
    s('circle', { cx: 32, cy: 4.4, r: 3.4, fill: wool, ...line }),
  )
  const flaps = s(
    'g',
    {},
    s('path', { d: 'M7.8 19.4 4 31q-1 5.6 3.4 5.6 2.2 0 2.6-3.2L9.6 26 15 19.6z', fill: knit, ...line }),
    s('path', { d: 'M56.2 19.4 60 31q1 5.6-3.4 5.6-2.2 0-2.6-3.2L54.4 26 49 19.6z', fill: knit, ...line }),
  )
  return [crown, flaps]
}

function setHover(f: Face, on: boolean) {
  f.hover = on
  wake()
}

// --- Taking the face out of its square: drag it, throw it, put it back. ---

const freeSize = 44 // px on screen while it is out, so it reads as a thing you hold
const dragAfter = 6 // px the mouse must move before a press becomes a drag (a plain click is a link)
const pressMs = 450 // a long press picks it up on a touch screen, where dragging would scroll
const friction = 0.975
const bounce = 0.62
const hardHit = 9 // px per step against an edge: sparks and a dizzy face
const homeMs = 380
const maxThrow = 32 // px per step: faster and the eye loses it
const dizzyMs = 2600
const snapAt = 32 // px from the square: let go there and it goes back in

let dragged = false // the last press became a drag, so its click is not a link click

function grabbable(f: Face) {
  const svg = f.svg
  // Grabbing the face never drags the link, selects text or opens the touch menu.
  svg.addEventListener('dragstart', (e) => e.preventDefault())
  svg.addEventListener('contextmenu', (e) => f.free && e.preventDefault())
  svg.addEventListener('click', (e) => {
    if (!dragged) return
    dragged = false
    e.preventDefault()
    e.stopImmediatePropagation()
  }, true)
  svg.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || reducedMotion?.matches) return
    if (f.free?.held != null || f.free?.home) return // a second finger, or on its way home
    dragged = false
    if (f.free) {
      // Caught again, in flight or at rest. A tap without a drag sends it home.
      e.preventDefault()
      hold(f, e)
      return
    }
    const x0 = e.clientX
    const y0 = e.clientY
    const id = e.pointerId
    const touch = e.pointerType === 'touch'
    if (!touch) e.preventDefault()
    let press = 0
    const done = (ev?: PointerEvent) => {
      if (ev && ev.pointerId !== id) return
      clearTimeout(press)
      removeEventListener('pointermove', move)
      removeEventListener('pointerup', done)
      removeEventListener('pointercancel', done)
    }
    const go = (ev: PointerEvent) => {
      done()
      dragged = true
      // On a phone a little buzz says it came loose.
      if (touch) navigator.vibrate?.(10)
      takeOut(f)
      hold(f, ev)
    }
    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== id) return
      const far = Math.hypot(ev.clientX - x0, ev.clientY - y0)
      if (touch) {
        if (far > 12) done() // a swipe, not a long press: the page scrolls
      } else if (far > dragAfter) go(ev)
    }
    if (touch) press = window.setTimeout(() => go(e), pressMs)
    addEventListener('pointermove', move)
    addEventListener('pointerup', done)
    addEventListener('pointercancel', done)
  })
  // Once it is held, a finger moving no longer scrolls the page.
  svg.addEventListener('touchmove', (e) => f.free?.held != null && e.cancelable && e.preventDefault(), { passive: false })
  f.hole.addEventListener('click', (e) => {
    // The empty square is inside the logo's link: a click on it brings the face home instead.
    e.preventDefault()
    e.stopPropagation()
    sendHome(f)
  })
}

// Circling the pointer fast round the face, close by (within about twice its size), makes it
// dizzy too: three turns without stopping.
function swirl(f: Face, x: number, y: number) {
  const c = f.center
  const sw = f.swirl
  const now = performance.now()
  if (!c || !f.svg.isConnected || f.free?.held != null || reducedMotion?.matches) return
  const d = Math.hypot(x - c.x, y - c.y)
  const a = Math.atan2(y - c.y, x - c.x)
  if (d > 60 || d < 15 || now - sw.at > 250) sw.sum = 0
  else {
    let da = a - sw.a
    if (da > Math.PI) da -= 2 * Math.PI
    if (da < -Math.PI) da += 2 * Math.PI
    // A clear change of direction starts the count again; a jitter does not.
    if (Math.abs(da) > 0.05) sw.sum = Math.sign(da) === Math.sign(sw.sum) || !sw.sum ? sw.sum + da : da
  }
  sw.a = a
  sw.at = now
  if (Math.abs(sw.sum) > 6 * Math.PI && now - f.dizzyAt > dizzyMs) {
    sw.sum = 0
    f.dizzyAt = now
    dizzyUntil = Math.max(dizzyUntil, now + dizzyMs)
  }
}

// Out of the square: the face moves to the top of the page, the empty square stays in the header.
function takeOut(f: Face) {
  const r = f.svg.getBoundingClientRect()
  f.free = { x: r.left + r.width / 2, y: r.top + r.height / 2, vx: 0, vy: 0, angle: 0, spin: 0, scale: r.width / freeSize, held: null, off: { x: 0, y: 0 }, samples: [], home: null, bounced: -1e9, restAt: performance.now() }
  f.svg.replaceWith(f.hole)
  document.body.append(f.svg)
  f.svg.classList.add('face-free')
  f.bg.setAttribute('visibility', 'hidden')
  f.center = null
  f.dizzyAt = -1e9
  place(f)
  // A while later the empty square pulses once, to show where the face goes back.
  window.setTimeout(() => {
    if (f.free && f.hole.isConnected && f.free.held === null) f.hole.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.18)' }, { transform: 'scale(1)' }], { duration: 600, easing: 'ease-in-out' })
  }, 2500)
}

function hold(f: Face, e: PointerEvent) {
  const fr = f.free!
  fr.held = e.pointerId
  fr.home = null
  fr.vx = fr.vy = 0
  fr.off = { x: e.clientX - fr.x, y: e.clientY - fr.y }
  fr.samples = [{ x: fr.x, y: fr.y, t: performance.now() }]
  const at = { x: e.clientX, y: e.clientY, t: performance.now(), wasOut: !dragged }
  f.svg.classList.add('face-held')
  const move = (ev: PointerEvent) => {
    if (ev.pointerId !== fr.held) return
    fr.x = ev.clientX - fr.off.x
    fr.y = ev.clientY - fr.off.y
    const now = performance.now()
    fr.samples.push({ x: fr.x, y: fr.y, t: now })
    while (fr.samples.length > 2 && now - fr.samples[0].t > 90) fr.samples.shift()
    wake()
  }
  const up = (ev: PointerEvent) => {
    if (ev.pointerId !== fr.held) return
    removeEventListener('pointermove', move)
    removeEventListener('pointerup', up)
    removeEventListener('pointercancel', up)
    fr.held = null
    f.svg.classList.remove('face-held')
    const tap = at.wasOut && Math.hypot(ev.clientX - at.x, ev.clientY - at.y) < dragAfter && performance.now() - at.t < 400
    if (tap || Math.hypot(fr.x - homeAt(f).x, fr.y - homeAt(f).y) < snapAt) return sendHome(f)
    // Thrown with the speed of its last moves, capped so it stays on screen long enough to see.
    const first = fr.samples[0]
    const dt = performance.now() - first.t
    if (dt > 0 && dt < 200) {
      const k = step / dt
      fr.vx = clamp((fr.x - first.x) * k, -maxThrow, maxThrow)
      fr.vy = clamp((fr.y - first.y) * k, -maxThrow, maxThrow)
    }
    wake()
  }
  addEventListener('pointermove', move)
  addEventListener('pointerup', up)
  addEventListener('pointercancel', up)
  wake()
}

function homeAt(f: Face) {
  const r = f.hole.getBoundingClientRect()
  return { x: r.left + r.width / 2, y: r.top + r.height / 2, size: r.width }
}

function sendHome(f: Face) {
  const fr = f.free
  if (!fr || !f.hole.isConnected) return
  fr.held = null
  fr.home = { from: { x: fr.x, y: fr.y, angle: ((fr.angle % 360) + 540) % 360 - 180, scale: fr.scale }, at: performance.now() }
  wake()
}

// Back in: the face takes the empty square's place again.
function landHome(f: Face) {
  f.hole.replaceWith(f.svg)
  f.svg.classList.remove('face-free', 'face-held')
  f.svg.style.left = f.svg.style.top = f.svg.style.transform = ''
  f.bg.setAttribute('visibility', 'visible')
  f.free = null
  f.center = null
  // It drops into place with a little squash, pleased to be back.
  f.svg.animate([{ transform: 'scale(1.12)' }, { transform: 'scale(.94)' }, { transform: 'scale(1)' }], { duration: 220, easing: 'ease-out' })
  react('happy')
}

// Its square left the page (a page without it): the face leaves the screen too, and the next
// header gets it back in place.
function drop(f: Face) {
  f.svg.remove()
  f.svg.classList.remove('face-free', 'face-held')
  f.svg.style.left = f.svg.style.top = f.svg.style.transform = ''
  f.bg.setAttribute('visibility', 'visible')
  f.free = null
  f.center = null
}

// One physics step of a face that is out: it flies, slows down, bounces off the edges of the
// window, and spins a little with its speed.
function fly(f: Face, now: number) {
  const fr = f.free!
  if (fr.home || fr.held !== null || Math.hypot(fr.vx, fr.vy) > 0.05) fr.restAt = now
  if (fr.home) {
    const t = Math.min(1, (now - fr.home.at) / homeMs)
    const e = 1 + 2.4 * (t - 1) ** 3 + 1.4 * (t - 1) ** 2 // ease out with a small overshoot
    const to = homeAt(f)
    const a = fr.home.from
    fr.x = a.x + (to.x - a.x) * e
    fr.y = a.y + (to.y - a.y) * e
    fr.angle = a.angle * (1 - e)
    fr.scale = a.scale + (to.size / freeSize - a.scale) * e
    if (t >= 1) landHome(f)
    return
  }
  fr.scale += ((fr.held !== null ? 1.08 : 1) - fr.scale) * 0.25
  if (fr.held !== null) {
    fr.spin *= 0.8
    fr.angle += fr.spin
    fr.angle *= 0.9
    return
  }
  fr.x += fr.vx
  fr.y += fr.vy
  fr.vx *= friction
  fr.vy *= friction
  // A wobble rather than a wheel, so the face can still be read while it flies.
  fr.spin += (clamp(fr.vx * 0.12, -5, 5) - fr.spin) * 0.2
  fr.angle += fr.spin
  const half = freeSize / 2
  const W = innerWidth
  const H = innerHeight
  const hit = (speed: number, x: number, y: number, nx: number, ny: number) => {
    if (Math.abs(speed) < hardHit) return
    sparksAt(x, y, nx, ny)
    if (now - fr.bounced > 300 && now - f.dizzyAt > dizzyMs - 500) f.dizzyAt = now
    fr.bounced = now
    dizzyUntil = Math.max(dizzyUntil, f.dizzyAt + dizzyMs)
  }
  if (fr.x < half) {
    hit(fr.vx, 0, fr.y, 1, 0)
    fr.x = half
    fr.vx = -fr.vx * bounce
  } else if (fr.x > W - half) {
    hit(fr.vx, W, fr.y, -1, 0)
    fr.x = W - half
    fr.vx = -fr.vx * bounce
  }
  if (fr.y < half) {
    hit(fr.vy, fr.x, 0, 0, 1)
    fr.y = half
    fr.vy = -fr.vy * bounce
  } else if (fr.y > H - half) {
    hit(fr.vy, fr.x, H, 0, -1)
    fr.y = H - half
    fr.vy = -fr.vy * 0.5 // the floor takes more out of it
  }
  // Once it has nearly stopped it settles straight, the way it is drawn.
  const speed = Math.hypot(fr.vx, fr.vy)
  if (speed < 2) fr.angle *= 0.85
  if (speed < 0.05) fr.vx = fr.vy = 0
}

function place(f: Face) {
  const fr = f.free!
  const st = f.svg.style
  st.left = `${fr.x - freeSize / 2}px`
  st.top = `${fr.y - freeSize / 2}px`
  st.transform = `rotate(${f2(fr.angle)}deg) scale(${f2(fr.scale)})`
}

// The mouth is a closed shape: the icon's curve on top and a second curve below it. With `open`
// at 0 it is the icon's own path, so the resting face is the icon.
function mouthPath(p: Pose) {
  const x0 = 32 - p.mouthW
  const w = p.mouthW * 2
  // Dizzy: a wobbly line, its waves growing in as the smile goes.
  if (p.wave > 0.5) {
    const a = 2.4 * Math.min(1, (p.wave - 0.5) * 2)
    return `M${f2(x0)} ${f2(p.mouthY)}q${f2(w / 8)} ${f2(-a)} ${f2(w / 4)} 0t${f2(w / 4)} 0t${f2(w / 4)} 0t${f2(w / 4)} 0`
  }
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
let busySince = 0 // when the page started loading, 0 when it isn't
let glance: { dir: number; at: number } | null = null
let woke = -1e9 // when the face last woke from a doze, for its little start
let asleep = false
let raf = 0
let timer = 0
let last = 0
let acc = 0

const moodMs: Record<Mood, number> = { happy: 1500, proud: 1400, kiss: 1800, tongue: 1100, peek: 1500, 'peek-all': 2250, starry: 1900, night: 1900, day: 900, wink: 1300 }

// What flies out of the face, and when in its mood: hearts after the kiss's own heart, stars with
// the glint, confetti on the hop of «all right».
const outbursts: Partial<Record<Mood, [number, (r: DOMRect) => void][]>> = {
  kiss: [[900, (r) => heartsFrom(r.left + r.width * 0.8, r.top + r.height * 0.25)]],
  day: [[200, (r) => starsFrom(r.right - r.width * 0.1, r.top + r.height * 0.4, 2)]],
  wink: [[650, (r) => starsFrom(r.right - r.width * 0.1, r.top + r.height * 0.4, 1)]],
  starry: [[500, (r) => starsFrom(r.right - r.width * 0.1, r.top + r.height * 0.45, 3)]],
  happy: [[220, (r) => starsFrom(r.right, r.top + r.height * 0.4)]],
  'peek-all': [
    [1420, (r) => starsFrom(r.right, r.top + r.height * 0.4)],
    [1480, (r) => confettiFrom(r.left + r.width / 2, r.top + r.height / 2)],
  ],
}
let outburstTimers: number[] = []
let dizzyUntil = 0 // the loop runs at least until then

// The face on screen that effects come out of: the one out of its square, else the first in view.
function shownFace(): DOMRect | null {
  let best: DOMRect | null = null
  for (const f of faces) {
    if (!f.svg.isConnected) continue
    const r = f.svg.getBoundingClientRect()
    if (f.free) return r
    if (!best && r.width && r.bottom > 0 && r.top < innerHeight) best = r
  }
  return best
}

function start() {
  if (started) return
  started = true
  lastInput = performance.now()
  const input = (e?: PointerEvent) => {
    if (e) {
      pointer = { x: e.clientX, y: e.clientY }
      if (e.type === 'pointermove') faces.forEach((f) => swirl(f, e.clientX, e.clientY))
    }
    if (asleep) woke = performance.now()
    asleep = false
    lastInput = performance.now()
    glance = null
    wake()
  }
  addEventListener('pointermove', input, { passive: true })
  addEventListener('pointerdown', input, { passive: true })
  addEventListener('keydown', (e) => {
    // Escape puts a face that is out back in its square.
    if (e.key === 'Escape') faces.forEach((f) => f.free && f.free.held === null && sendHome(f))
    input()
  })
  addEventListener('scroll', () => {
    faces.forEach((f) => (f.center = null))
    input()
  }, { passive: true })
  // A face that is out is kept inside the window (the edges are checked as it moves).
  addEventListener('resize', () => {
    faces.forEach((f) => (f.center = null))
    wake()
  })
  // Keyboard focus on the logo's link smiles like the pointer does.
  document.addEventListener('focusin', (e) => faces.forEach((f) => (e.target as Element).contains?.(f.svg) && setHover(f, true)))
  document.addEventListener('focusout', (e) => faces.forEach((f) => (e.target as Element).contains?.(f.svg) && setHover(f, false)))
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
    const at = performance.now()
    mood = { name, at }
    outburstTimers.forEach(clearTimeout)
    outburstTimers = (outbursts[name] ?? []).map(([ms, burst]) =>
      window.setTimeout(() => {
        if (mood?.at !== at) return
        const r = shownFace()
        if (r) burst(r)
      }, ms),
    )
    lastInput = performance.now()
    asleep = false
    wake()
  })
  document.addEventListener('visibilitychange', () => !document.hidden && wake())
  // While a page is loading (it marks itself aria-busy) the face thinks.
  const watchBusy = () => {
    const now = !!document.querySelector('main [aria-busy="true"]')
    if (now === !!busySince) return
    busySince = now ? performance.now() : 0
    wake()
  }
  new MutationObserver(watchBusy).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['aria-busy'] })
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
function target(f: Face, now: number): { pose: Pose; doze: number; idle: boolean; glint: number; shine: number; heart: number } {
  const p = { ...rest }
  let glint = 0
  let shine = 1
  let heart = -1 // where the kiss's heart is on its way up, 0 to 1; -1 none
  const quiet = now - lastInput
  // On a phone the face looks at a tap for a few seconds, then ahead again.
  if (pointer && (!touchOnly() || quiet < 3000)) {
    if (f.free) f.center = { x: f.free.x, y: f.free.y }
    else if (!f.center) {
      const r = f.svg.getBoundingClientRect()
      f.center = r.width ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null
    }
  }
  if (pointer && (!touchOnly() || quiet < 3000) && f.center) {
    const dx = pointer.x - f.center.x
    const dy = pointer.y - f.center.y
    // Close by the glasses barely move; far away they reach their limit.
    const dist = Math.hypot(dx, dy) || 1
    const k = Math.min(1, dist / 260)
    p.gx = (dx / dist) * k * reach.x
    p.gy = (dy / dist) * k * reach.y
    p.ly = p.gy
  }
  // A long pause: the glasses slide straight down the nose and the smile softens. Kept level, as
  // tilted glasses read as a broken icon. Not on phones, where the screen sits still for long.
  // Out of its square and left alone for a while, it falls asleep where it lies, whatever the page
  // does, until someone picks it up.
  const fr0 = f.free
  const parked = !!fr0 && fr0.held === null && !fr0.home && now - fr0.restAt > parkedSleep
  const idle = quiet > sleepAfter && !touchOnly()
  const calm = !mood && now - f.dizzyAt > dizzyMs
  // How long it has been asleep, in ms; -1 awake.
  const doze = !calm ? -1 : parked ? now - fr0!.restAt - parkedSleep : idle ? quiet - sleepAfter : -1
  if (doze >= 0) {
    p.gx = 0
    p.ly = 0
    p.gy = 2.2
    p.smile = 4
    // On the way down the head drops and catches itself once.
    if (doze > 2000 && doze < 2600) p.gy += 1.2
  } else if (f.hover) Object.assign(p, { mouthW: 12, mouthY: 40.3, smile: 6.6 })
  // Without a pointer to follow (a phone, or the pointer outside the window), the face glances
  // aside once after a while, then not again until someone does something.
  if (!pointer && !fr0 && doze < 0 && quiet > glanceAfter && !glance) glance = { dir: Math.random() < 0.5 ? -1 : 1, at: now }
  if (glance && now - glance.at < 700 && doze < 0) {
    p.gx = glance.dir * 2
    p.gy = p.ly = 0.6
  }
  // Thinking while the page loads: after a wait (quick loads show nothing), it looks up to one side,
  // holds, then the other, with a flat «hmm» mouth pulled to the side it looks at.
  const thinking = busySince && now - busySince > thinkAfter && !mood && doze < 0
  if (thinking) {
    const side = Math.floor((now - busySince - thinkAfter) / 1400) % 2 ? -1 : 1
    p.gx = side * 0.7 * reach.x
    p.gy = p.ly = -0.8 * reach.y
    p.tilt = 3 * side
    Object.assign(p, { mouthW: 6, mouthY: 41.4, smile: 0.8, mx: 1.5 * side })
  }
  // Woken up: a quick start upwards.
  if (now - woke < 120 && doze < 0) {
    p.gy = -1.2
    p.tilt = 0
  }
  // Out of its square: a big smile while held, an «oh» while it flies.
  const fr = f.free
  const dizzy = now - f.dizzyAt
  if (fr && !fr.home && dizzy > dizzyMs) {
    if (fr.held !== null) Object.assign(p, { mouthW: 12, mouthY: 40.3, smile: 6.6 })
    else if (Math.hypot(fr.vx, fr.vy) > 3) Object.assign(p, { mouthW: 4.2, mouthY: 41.6, smile: 1.6, open: 2.6 })
  }
  if (dizzy < dizzyMs) {
    const t = dizzy
    {
      // Hit an edge hard: the glasses slip down crooked and wobble over spinning eyes, the mouth
      // goes wavy and two stars circle the head; then it shakes it off.
      if (t < 2100) {
        p.gx = 0
        p.ly = 0
        p.gy = 8
        p.tilt = 7 + 3 * Math.sin(t / 150)
        Object.assign(p, { dizzy: 1, wave: 1, mouthW: 8, mouthY: 48.6, smile: 0, eyes: 0 })
      } else if (t < 2400) p.tilt = 4 * Math.sin(((t - 2100) / 300) * Math.PI * 3) // the shake
    }
  } else if (mood) {
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
    } else if (mood.name === 'peek' || mood.name === 'peek-all') {
      // You got some right in the game: it lowers its glasses to look at you over them with smiling
      // eyes that lift a little, then pushes them back up. All right: then a glint and a hop.
      if (t < 150) p.gy -= 0.6
      else if (t < 1050) {
        p.gy = 5.5
        p.tilt = 0
        Object.assign(p, { eyes: 1, mouthW: 12, mouthY: 44.8, smile: 6.2 })
        if (t > 350) p.brow = -1.5
      }
      if (mood.name === 'peek-all') {
        if (t > 1320 && t < 1600) glint = 4 * easeInOut((t - 1320) / 280)
        if (t > 1530 && t < 1600) shine = 1 - (t - 1530) / 70
        else if (t >= 1600 && t < 1750) shine = (t - 1600) / 150
        if (t > 1370 && t < 1460) p.gy += 0.8
        else if (t >= 1460 && t < 1700) p.gy -= 3 * Math.sin(((t - 1460) / 240) * (Math.PI / 2))
        if (t > 1370 && t < 2020) Object.assign(p, { mouthW: 12.2, mouthY: 40.2, smile: 6, open: 3.2 })
      }
    } else if (mood.name === 'night') {
      // Dark mode: no sun to shade from, so the glasses go up onto the forehead for a while.
      if (t < 120) p.gy += 0.8
      else if (t < 1500) {
        p.gy = -13
        p.gx *= 0.3
        p.tilt = 0
        Object.assign(p, { eyes: 1, look: 1, mouthW: 10.5, mouthY: 41, smile: 5.4 })
      }
    } else if (mood.name === 'day') {
      // Light mode: glasses on, and the light catches them.
      if (t < 100) p.gy -= 0.8
      if (t > 80 && t < 360) glint = 4 * easeInOut((t - 80) / 280)
      if (t > 290 && t < 360) shine = 1 - (t - 290) / 70
      else if (t >= 360 && t < 510) shine = (t - 360) / 150
      if (t > 60 && t < 800) Object.assign(p, { mouthW: 12, mouthY: 40.3, smile: 6.6 })
    } else if (mood.name === 'wink') {
      // A wink over the glasses: they dip, one eye shuts, and back up with a glint.
      if (t > 80 && t < 950) {
        p.gy = 5.5
        p.tilt = -3
        Object.assign(p, { eyes: 1, mouthW: 11.6, mouthY: 44.6, smile: 6, mx: 1 })
        if (t > 250 && t < 900) p.wink = 1
      }
      if (t > 980 && t < 1260) glint = 4 * easeInOut((t - 980) / 280)
    } else if (mood.name === 'starry') {
      // A kudo: «wow». It pushes the glasses up onto its forehead to look with star eyes and a big
      // open smile, then puts them back on.
      if (t < 120) p.gy += 0.8
      else if (t < 1350) {
        p.gy = -13
        p.gx *= 0.3
        p.tilt = 0
        Object.assign(p, { star: 1, mouthW: 12.4, mouthY: 41.4, smile: 7, open: 3.4 })
      }
    } else if (mood.name === 'kiss') {
      // A kiss: it leans in, puckers to one side, and lets go of a little heart with a «muac»,
      // back to its smile as the heart floats up.
      if (t > 120 && t < 500) Object.assign(p, { mouthW: 2.2, mouthY: 41.6, smile: -0.4, open: 2.2, mx: 1.5 })
      if (t > 120 && t < 900) {
        p.tilt -= 4
        p.gy -= 0.6
      }
      if (t > 450 && t < 1650) heart = (t - 450) / 1200
    } else if (mood.name === 'tongue') {
      // Cheeky: the mouth closes up for a beat, then opens and the tongue pops out to one side with
      // a head tilt, and back in.
      if (t < 90) Object.assign(p, { mouthW: 9, smile: 3 })
      else if (t < 850) Object.assign(p, { mouthW: 10.5, mouthY: 40.6, smile: 4.6, open: 1 })
      if (t > 110 && t < 750) {
        p.tongue = 1
        p.tilt += 5
      }
    } else {
      // Proud: two little nods (down only, tipping one way then the other), then a broad smile.
      if (t < 700) {
        p.gy += (1.8 * (1 - Math.cos((t / 700) * Math.PI * 4))) / 2
        p.tilt += t < 350 ? 2 : -2
      }
      if (t > 600) Object.assign(p, { mouthW: 12.4, mouthY: 40, smile: 7 })
    }
  }
  return { pose: p, doze, idle: idle && calm && !parked, glint, shine, heart }
}

// Less motion asked for: the plain icon, drawn once, no frames.
let drawnStill = false
function still() {
  cancelAnimationFrame(raf)
  raf = 0
  if (drawnStill && ![...faces].some((f) => !f.still)) return
  drawnStill = true
  for (const f of faces) {
    if (f.free) f.hole.isConnected ? landHome(f) : drop(f)
    f.still = true
    f.pose = { ...rest }
    f.speed = { ...zero }
    f.shineAt = { x: 0, y: 0, vx: 0, vy: 0 }
    draw(f, 0, 1, -1)
  }
}

const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2)
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))
const step = 1000 / 60

function frame(ts: number) {
  raf = 0
  if (document.hidden) return
  if (reducedMotion?.matches) return still()
  drawnStill = false
  const now = performance.now()
  if (mood && now - mood.at > moodMs[mood.name]) mood = null
  // Fixed 60 Hz steps, so the springs feel the same on a 120 Hz screen.
  acc = Math.min(acc + (ts - last), 100)
  last = ts
  const steps = Math.floor(acc / step)
  acc -= steps * step
  let moving = false
  let dozing = false
  const sleepers: number[] = [] // when a sleeping face is due its next «z», or a parked one its sleep
  for (const f of faces) {
    if (!f.svg.isConnected) {
      faces.delete(f)
      continue
    }
    f.still = false
    if (f.free && !f.hole.isConnected && f.free.held === null) drop(f)
    if (f.free) {
      for (let i = 0; i < steps && f.free; i++) fly(f, now)
      const fr = f.free as Free | null
      if (fr) place(f)
      if (!fr || fr.held !== null || fr.home || Math.hypot(fr.vx, fr.vy) > 0.05 || Math.abs(fr.spin) > 0.05 || Math.abs(fr.angle) > 0.2 || Math.abs(fr.scale - 1) > 0.005) moving = true
    }
    const { pose: goal, doze: slept, idle, glint, shine, heart } = target(f, now)
    const doze = slept >= 0
    dozing ||= idle
    if (doze) {
      // Asleep: once the glasses have settled, a «z» floats up every few seconds.
      // Only for a minute and only on screen, so a long sleep costs no frames.
      const r = f.svg.getBoundingClientRect()
      const seen = r.width > 0 && r.bottom > 0 && r.top < innerHeight
      if (slept < 3000) moving = true
      else if (seen && slept < zFor) {
        if (now - f.lastZ > zEvery) {
          f.lastZ = now
          zzzFrom(r.right - r.width * 0.15, r.top + r.height * 0.2)
        }
        sleepers.push(Math.max(1, f.lastZ + zEvery - now))
      }
    } else if (f.free && f.free.held === null && !f.free.home) sleepers.push(Math.max(1, f.free.restAt + parkedSleep - now))
    for (let i = 0; i < steps; i++) {
      for (const k of keys) {
        const sp = mouthKeys.has(k) ? springs.mouth : doze && (k === 'gy' || k === 'tilt') ? springs.doze : springs.glasses
        f.speed[k] = (f.speed[k] + (goal[k] - f.pose[k]) * sp.k) * sp.damp
        f.pose[k] += f.speed[k]
      }
      // They lean a touch into a sideways move.
      const lean = goal.dizzy > 0.5 ? 12 : 4
      f.pose.tilt = clamp(f.pose.tilt + f.speed.gx * 3, -lean, lean)
      // The shine follows the glasses a beat late.
      const sh = f.shineAt
      sh.vx = (sh.vx + (f.pose.gx * 0.35 - sh.x) * springs.shine.k) * springs.shine.damp
      sh.vy = (sh.vy + (f.pose.gy * 0.35 - sh.y) * springs.shine.k) * springs.shine.damp
      sh.x += sh.vx
      sh.y += sh.vy
    }
    for (const k of keys) if (Math.abs(goal[k] - f.pose[k]) > 0.01 || Math.abs(f.speed[k]) > 0.01) moving = true
    if (Math.abs(f.shineAt.vx) > 0.005 || Math.abs(f.shineAt.vy) > 0.005 || glint) moving = true
    if (heart >= 0) moving = true
    draw(f, glint, shine, heart)
  }
  asleep = dozing
  const quiet = now - lastInput
  const timed = mood || busySince || now < dizzyUntil || now - woke < 200 || (glance && now - glance.at < 800)
  if (moving || timed) {
    // Something during this frame (a hit that made it dizzy) may already have asked for the next.
    if (!raf) raf = requestAnimationFrame(frame)
    return
  }
  // Settled: no frames until something happens or the next timed moment (a glance, a doze, the
  // end of a phone tap's look).
  const next = [glance ? -1 : glanceAfter - quiet, sleepAfter - quiet, pointer && touchOnly() ? 3000 - quiet : -1, ...sleepers].filter((n) => n > 0)
  if (next.length) timer = window.setTimeout(wake, Math.min(...next) + 20)
}

function draw(f: Face, glint: number, shine: number, heart: number) {
  const p = f.pose
  // A head turn, faked. r is how far the face looks sideways (-1 left … 1 right, up to ±1.2 while
  // a spring overshoots), v the same up and down.
  const r = clamp(p.gx / reach.x, -1.2, 1.2)
  const v = clamp(p.ly / reach.y, -1.2, 1.2)
  // Looking up or down the lenses foreshorten a little.
  const sy = 1 - 0.06 * Math.abs(v)
  f.glasses.setAttribute('transform', `translate(${f2(p.gx)} ${f2(p.gy)}) rotate(${f2(p.tilt)} 32 29) translate(0 29) scale(1 ${f2(sy)}) translate(0 -29)`)
  // The bridge moves towards the look; the lens on that side squeezes as it goes round the face,
  // the other stretches a little, and both ends of the bar keep hugging the head.
  const bridge = 32 + 3.4 * r
  for (const [i, half] of f.halves.entries()) {
    const side = i ? 1 : -1 // -1 left half, 1 right half
    const outer = side * r > 0 ? bridge + side * 24.4 * (1 - 0.22 * Math.abs(r)) : 32 + side * 24.4 - 1.6 * r
    const sx = (outer - bridge) / (side * 24.4)
    half.setAttribute('transform', `translate(${f2(bridge)} 0) scale(${(Math.round(sx * 1000) / 1000).toString()} 1) translate(-32 0)`)
  }
  // Facing front, one uncut copy, exactly the icon.
  const front = Math.abs(r) < 0.005
  f.lens.setAttribute('visibility', front ? 'hidden' : 'visible')
  f.cut.setAttribute('clip-path', front ? 'none' : f.cutClip)
  // The lens reflection belongs to the room, so it slides back a little inside the lens.
  for (const sh of f.shine) {
    sh.setAttribute('transform', `translate(${f2(f.shineAt.x + glint - 1.2 * r)} ${f2(f.shineAt.y)})`)
    sh.setAttribute('opacity', f2(clamp(shine, 0, 1)))
  }
  // Depth: the mouth goes round with the head (a bit less than the bridge) and narrows as it turns;
  // the light and the rim shadow stay with the room, so against the face they drift the other way.
  f.mouth.setAttribute('transform', `translate(${f2(0.75 * (p.gx + 2.6 * r) + p.mx)} ${f2(0.6 * p.ly)})`)
  f.eyes.setAttribute('transform', `translate(${f2(0.75 * (p.gx + 2.6 * r))} ${f2(0.6 * p.ly + p.brow)})`)
  // Shown only as far as the glasses are actually down, so no eye floats outside the lenses while
  // they go up or come back.
  f.eyes.setAttribute('opacity', f2(clamp(p.eyes, 0, 1) * Math.max(clamp((p.gy - 1) / 1.5, 0, 1), clamp((-p.gy - 7) / 4, 0, 1))))
  const eyesD = p.wink > 0.5 ? winkPath : p.look > 0.5 ? openPath : eyesPath
  if (eyesD !== f.eyesD) {
    f.eyes.setAttribute('d', (f.eyesD = eyesD))
    // Open eyes are filled dots; the smiling and shut ones are lines.
    f.eyes.setAttribute('fill', eyesD === eyesPath ? 'none' : '#352310')
  }
  f.mouth.setAttribute('d', mouthPath({ ...p, mouthW: p.mouthW * (1 - 0.08 * Math.abs(r)) }))
  f.mouth.setAttribute('fill', p.open < 0.05 ? 'none' : '#352310')
  // The tongue hangs from just inside the lower lip, wherever the mouth is.
  if (p.tongue > 0.05) {
    const y0 = p.mouthY + 0.75 * (p.smile + p.open * 1.6) - 1.4
    const len = Math.max(3.6, 7.5 * p.tongue)
    f.tongue.setAttribute('d', `M29.9 ${f2(y0)}v${f2(len - 3.6)}a3.6 3.6 0 0 0 7.2 0v${f2(3.6 - len)}z`)
    f.tongue.setAttribute('transform', f.mouth.getAttribute('transform')!)
    f.tongue.setAttribute('visibility', 'visible')
  } else f.tongue.setAttribute('visibility', 'hidden')
  // The heart leaves the lips and rises to the top right, swaying, and fades at the end.
  if (heart >= 0) {
    const e = 1 - (1 - heart) ** 2
    const x = 34 + 16 * e + Math.sin(heart * Math.PI * 3) * 1.2
    const y = 40 - 25 * e
    f.heart.setAttribute('transform', `translate(${f2(x)} ${f2(y)}) scale(${f2(0.6 + 0.7 * Math.min(1, heart * 3))})`)
    f.heart.setAttribute('opacity', f2(heart < 0.6 ? 1 : (1 - heart) / 0.4))
    f.heart.setAttribute('visibility', 'visible')
  } else f.heart.setAttribute('visibility', 'hidden')
  // Dizzy eyes spin; like the smiling ones they show only as far as the glasses are down.
  const spin = (performance.now() / 3.5) % 360
  for (const [i, g] of f.spirals.entries()) {
    g.setAttribute('opacity', f2(clamp((p.dizzy - 0.5) * 2, 0, 1) * clamp((p.gy - 1) / 1.5, 0, 1)))
    if (p.dizzy > 0.01) g.setAttribute('transform', `${f.eyes.getAttribute('transform')} rotate(${f2(i ? spin : -spin)} ${i ? 45.1 : 20.1} 21.6)`)
  }
  // Star eyes pop in as the glasses clear them and twinkle while they show.
  const se = clamp(p.star, 0, 1) * clamp((-p.gy - 7) / 4, 0, 1)
  for (const [i, st] of f.starEyes.entries()) {
    if (se > 0.02) {
      const tw = 1 + 0.08 * Math.sin(performance.now() / 110 + i * 1.7)
      st.setAttribute('transform', `${f.eyes.getAttribute('transform')} translate(${i ? 44.6 : 19.4} 29) scale(${f2(1.3 * se * tw)}) rotate(${f2((i ? 1 : -1) * 8 * Math.sin(performance.now() / 260))})`)
      st.setAttribute('visibility', 'visible')
    } else st.setAttribute('visibility', 'hidden')
  }
  // Two stars circle the head, the one behind smaller.
  for (const [i, st] of f.stars.entries()) {
    if (p.dizzy > 0.3) {
      const a = performance.now() / 260 + i * Math.PI
      const z = Math.sin(a)
      st.setAttribute('transform', `translate(${f2(32 + 17 * Math.cos(a))} ${f2(9 + 3.5 * z)}) scale(${f2((1.15 + 0.3 * z) * Math.min(1, (p.dizzy - 0.3) * 2))})`)
      st.setAttribute('visibility', 'visible')
    } else st.setAttribute('visibility', 'hidden')
  }
  // The hat sits on the head, so it turns and nods with it a little.
  for (const h of f.hat) h.setAttribute('transform', `translate(${f2(0.35 * (p.gx + 2.6 * r))} ${f2(0.3 * p.ly)})`)
  f.light.setAttribute('cx', f2(0.42 - 0.05 * r))
  f.light.setAttribute('cy', f2(0.35 - 0.03 * v))
  f.shade.setAttribute('cx', f2(32.8 - 0.3 * r))
}
