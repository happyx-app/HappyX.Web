// Little effects that fly out of the live logo onto the page: confetti, hearts, stars and sparks.
// Each piece is a short-lived fixed element, positioned through CSSOM (the CSP blocks style
// attributes) and removed when its animation ends. Nothing plays for people who ask for less motion.

import { s } from './dom'

const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

const ink = '#352310'

// A piece: a tiny SVG at (x, y) on the screen, animated with the Web Animations API.
function piece(x: number, y: number, size: number, child: SVGElement, frames: Keyframe[], ms: number, easing = 'cubic-bezier(.2,.7,.4,1)', delay = 0) {
  const svg = s('svg', { class: 'fx', viewBox: '-6 -6 12 12', width: size, height: size, 'aria-hidden': 'true' }, child)
  svg.style.left = `${x - size / 2}px`
  svg.style.top = `${y - size / 2}px`
  document.body.append(svg)
  const a = svg.animate(frames, { duration: ms, easing, delay, fill: 'both' })
  a.onfinish = () => svg.remove()
  return svg
}

const confettiColors = ['#fbbf24', '#8b5cf6', '#ff9ecf', '#60a5fa']

// A burst of confetti from (x, y), thrown down and to the right: the logo lives in the top left.
export function confettiFrom(x: number, y: number, pieces = 30) {
  if (reduced()) return
  for (let i = 0; i < pieces; i++) {
    const angle = (-10 + Math.random() * 110) * (Math.PI / 180)
    const dist = 70 + Math.random() * 140
    const dx = Math.cos(angle) * dist
    const dy = Math.sin(angle) * dist + 90
    const rect = s('rect', { x: -3, y: -4, width: 6, height: 8, rx: 1.2, fill: confettiColors[i % confettiColors.length] })
    piece(x, y, 10, rect, [
      { transform: 'translate(0, 0) rotate(0deg)', opacity: 1 },
      { transform: `translate(${dx}px, ${dy}px) rotate(${Math.random() * 720 - 360}deg)`, opacity: 0 },
    ], 1000 + Math.random() * 500)
  }
}

const heartPath = 'M0 3.2C-1.2 2.2-4.4 0-4.4-2c0-1.6 1.2-2.4 2.3-2.4 1 0 1.7.6 2.1 1.3.4-.7 1.1-1.3 2.1-1.3 1.1 0 2.3.8 2.3 2.4 0 2-3.2 4.2-4.4 5.2z'

// A few hearts that leave the logo and drift up and outwards, as the kiss's heart does inside.
export function heartsFrom(x: number, y: number, count = 4) {
  if (reduced()) return
  for (let i = 0; i < count; i++) {
    const dx = 18 + i * 14 + Math.random() * 10
    const dy = -(10 + Math.random() * 26)
    const sway = (Math.random() < 0.5 ? -1 : 1) * 6
    const heart = s('path', { d: heartPath, fill: '#f43f5e', stroke: ink, 'stroke-width': 1.1, 'stroke-linejoin': 'round', 'paint-order': 'stroke' })
    piece(x, y, 14, heart, [
      { transform: 'translate(0, 0) scale(.4)', opacity: 0 },
      { transform: `translate(${dx * 0.5 + sway}px, ${dy * 0.5}px) scale(1)`, opacity: 1, offset: 0.35 },
      { transform: `translate(${dx}px, ${dy}px) scale(.9)`, opacity: 0 },
    ], 1100 + i * 120, 'ease-out', i * 90)
  }
}

const starPath = 'M0-5L1.3-1.3 5 0 1.3 1.3 0 5-1.3 1.3-5 0-1.3-1.3z'

// Small four-pointed stars trailing to the right of (x, y), after the glint on the glasses.
export function starsFrom(x: number, y: number, count = 3) {
  if (reduced()) return
  for (let i = 0; i < count; i++) {
    const star = s('path', { d: starPath, fill: '#fde68a', stroke: ink, 'stroke-width': 0.8, 'stroke-linejoin': 'round', 'paint-order': 'stroke' })
    piece(x + 4 + i * 9, y - 6 + (i % 2) * 8, 10 - i * 2, star, [
      { transform: 'scale(0) rotate(0deg)', opacity: 1 },
      { transform: 'scale(1) rotate(45deg)', opacity: 1, offset: 0.4 },
      { transform: 'scale(0) rotate(90deg)', opacity: 0 },
    ], 520 + i * 90, 'ease-out')
  }
}

// Electric sparks where the thrown logo hits an edge: short yellow zigzags flicking outwards.
// (nx, ny) points away from the wall it hit.
export function sparksAt(x: number, y: number, nx: number, ny: number, count = 5) {
  if (reduced()) return
  const base = Math.atan2(ny, nx)
  for (let i = 0; i < count; i++) {
    const a = base + ((i / (count - 1)) - 0.5) * 2.2
    const zig = s('path', { d: 'M-5 0l2.5-2 2 3 2-3 2.5 2', stroke: '#facc15', 'stroke-width': 1.6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', fill: 'none' })
    const el = piece(x, y, 16, zig, [
      { transform: `rotate(${a}rad) translateX(6px) scaleX(.4)`, opacity: 1 },
      { transform: `rotate(${a}rad) translateX(22px) scaleX(1)`, opacity: 1, offset: 0.5 },
      { transform: `rotate(${a}rad) translateX(30px) scaleX(.6)`, opacity: 0 },
    ], 260 + Math.random() * 120, 'steps(4, end)')
    el.style.filter = 'drop-shadow(0 0 2px #fde047)'
  }
}
