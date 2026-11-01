// Line icons in the text colour, so they stay black and white in both modes and give the
// interface a quieter look than emoji. Shapes follow the Feather/Lucide set.

import { s } from './dom'

const icon = (...shapes: SVGElement[]) =>
  s('svg', { viewBox: '0 0 24 24', class: 'icon', 'aria-hidden': 'true', fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, ...shapes)

const path = (d: string) => s('path', { d })

export type Icon = () => SVGSVGElement

export const sun: Icon = () =>
  icon(s('circle', { cx: 12, cy: 12, r: 4 }), path('M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41'))

export const moon: Icon = () => icon(path('M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z'))

export const gear: Icon = () =>
  icon(
    s('circle', { cx: 12, cy: 12, r: 3 }),
    path('M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z'),
  )

export const alert: Icon = () => icon(path('M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01'))
export const info: Icon = () => icon(s('circle', { cx: 12, cy: 12, r: 10 }), path('M12 16v-4M12 8h.01'))
export const lock: Icon = () => icon(s('rect', { x: 3, y: 11, width: 18, height: 11, rx: 2 }), path('M7 11V7a5 5 0 0 1 10 0v4'))
export const eye: Icon = () => icon(path('M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z'), s('circle', { cx: 12, cy: 12, r: 3 }))
export const logOut: Icon = () => icon(path('M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9'))
export const check: Icon = () => icon(path('M20 6 9 17l-5-5'))
export const x: Icon = () => icon(path('M18 6 6 18M6 6l12 12'))
export const download: Icon = () => icon(path('M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3'))
export const undo: Icon = () => icon(path('M1 4v6h6M3.51 15a9 9 0 1 0 2.13-9.36L1 10'))
export const chart: Icon = () => icon(path('M3 3v18h18M7 15l4-4 3 3 6-6'))

// inline sizes an icon to sit before a line of text, like the emoji it replaces.
export const inline = (i: Icon) => {
  const el = i()
  el.classList.add('icon-inline')
  return el
}
