// Hand-drawn SVG/HTML charts. One measure per chart in a single hue, so no legend is needed;
// thin 2px lines, 8px markers, recessive grid, hover tooltip and a table view for each.

import type { DayStat, Report } from './api'
import { h, s } from './dom'
import { formatDay, formatNumber, moodEmoji, moodLabel, t } from './i18n'

// Average mood per day, 1-5, with gaps on days without answers.
export function trendChart(days: DayStat[]): HTMLElement {
  const wrap = h('div', { class: 'trend' })
  const tooltip = h('div', { class: 'tooltip', role: 'status', hidden: true })
  let drawnWidth = 0
  new ResizeObserver(() => {
    const width = Math.round(wrap.clientWidth)
    if (width === 0 || width === drawnWidth) return
    drawnWidth = width
    wrap.replaceChildren(drawTrend(days, Math.max(280, width), tooltip), tooltip)
  }).observe(wrap)
  return wrap
}

function answers(n: number): string {
  return n === 1 ? t('chart.answer') : t('chart.answers', { n: formatNumber(n) })
}

function drawTrend(days: DayStat[], width: number, tooltip: HTMLElement): SVGSVGElement {
  const height = 260
  const m = { top: 12, right: 12, bottom: 28, left: 34 }
  const iw = width - m.left - m.right
  const ih = height - m.top - m.bottom
  const step = days.length > 1 ? iw / (days.length - 1) : 0
  const x = (i: number) => m.left + (days.length > 1 ? i * step : iw / 2)
  const y = (v: number) => m.top + ((5 - v) / 4) * ih

  const svg = s('svg', {
    width, height, viewBox: `0 0 ${width} ${height}`, class: 'chart', role: 'img',
    'aria-label': t('chart.trend'),
  })

  // Grid: one hairline per mood, with the emoji as the tick label.
  for (let v = 1; v <= 5; v++) {
    svg.append(
      s('line', { x1: m.left, x2: width - m.right, y1: y(v), y2: y(v), class: v === 1 ? 'axis' : 'grid' }),
      s('text', { x: m.left - 10, y: y(v), class: 'tick tick-y', 'text-anchor': 'end', 'dominant-baseline': 'central' }, moodEmoji(v)),
    )
  }

  // X ticks: about one every 80px, always including the last day.
  const every = Math.max(1, Math.ceil(days.length / Math.max(1, Math.floor(iw / 80))))
  days.forEach((d, i) => {
    if (i % every !== 0 && i !== days.length - 1) return
    if (i !== days.length - 1 && days.length - 1 - i < every * 0.75) return // keep the last label clear
    const anchor = days.length === 1 ? 'middle' : i === 0 ? 'start' : i === days.length - 1 ? 'end' : 'middle'
    svg.append(s('text', { x: x(i), y: height - 8, class: 'tick', 'text-anchor': anchor }, formatDay(d.day)))
  })

  // Line segments between consecutive days with answers.
  let path = ''
  days.forEach((d, i) => {
    if (d.responses === 0) return
    path += `${i > 0 && days[i - 1].responses > 0 ? 'L' : 'M'}${x(i).toFixed(1)},${y(d.average).toFixed(1)}`
  })
  svg.append(s('path', { d: path, class: 'line' }))
  days.forEach((d, i) => {
    if (d.responses > 0) svg.append(s('circle', { cx: x(i), cy: y(d.average), r: 4, class: 'dot' }))
  })

  // Hover: crosshair on the nearest day + tooltip.
  const cross = s('line', { y1: m.top, y2: m.top + ih, class: 'crosshair', visibility: 'hidden' })
  const focus = s('circle', { r: 6, class: 'focus', visibility: 'hidden' })
  svg.append(cross, focus)
  const hit = s('rect', { x: m.left - step / 2, y: 0, width: iw + step, height, fill: 'transparent' })
  const show = (clientX: number) => {
    const box = svg.getBoundingClientRect()
    const i = Math.max(0, Math.min(days.length - 1, Math.round((clientX - box.left - m.left) / (step || 1))))
    const d = days[i]
    cross.setAttribute('x1', String(x(i)))
    cross.setAttribute('x2', String(x(i)))
    cross.setAttribute('visibility', 'visible')
    if (d.responses > 0) {
      focus.setAttribute('cx', String(x(i)))
      focus.setAttribute('cy', String(y(d.average)))
      focus.setAttribute('visibility', 'visible')
    } else focus.setAttribute('visibility', 'hidden')
    tooltip.replaceChildren(
      h('div', { class: 'tooltip-title' }, formatDay(d.day, { weekday: 'short', day: 'numeric', month: 'short' })),
      d.responses > 0
        ? h('div', {}, h('strong', {}, `${moodEmoji(d.average)} ${formatNumber(d.average, 1)}`), ` · ${answers(d.responses)}`)
        : h('div', { class: 'muted' }, t('chart.noAnswers')),
    )
    tooltip.hidden = false
    const left = Math.min(Math.max(x(i) - tooltip.offsetWidth / 2, 0), width - tooltip.offsetWidth)
    tooltip.style.left = `${left}px`
    tooltip.style.top = `${(d.responses > 0 ? y(d.average) : m.top + ih / 2) - tooltip.offsetHeight - 14}px`
  }
  const hide = () => {
    cross.setAttribute('visibility', 'hidden')
    focus.setAttribute('visibility', 'hidden')
    tooltip.hidden = true
  }
  hit.addEventListener('pointermove', (e) => show(e.clientX))
  hit.addEventListener('pointerdown', (e) => show(e.clientX))
  hit.addEventListener('pointerleave', hide)
  svg.append(hit)
  return svg
}

export function trendTable(days: DayStat[]): HTMLTableElement {
  return h(
    'table',
    { class: 'table' },
    h('thead', {}, h('tr', {}, h('th', {}, t('chart.day')), h('th', { class: 'num' }, t('stat.average')), h('th', { class: 'num' }, t('stat.responses')))),
    h(
      'tbody',
      {},
      ...days.map((d) =>
        h(
          'tr',
          {},
          h('td', {}, formatDay(d.day, { weekday: 'short', day: 'numeric', month: 'short' })),
          h('td', { class: 'num' }, d.responses > 0 ? `${moodEmoji(d.average)} ${formatNumber(d.average, 2)}` : '–'),
          h('td', { class: 'num' }, formatNumber(d.responses)),
        ),
      ),
    ),
  )
}

// Widths go through CSSOM: the CSP forbids inline style attributes.
function bar(pct: number): HTMLElement {
  const el = h('span', { class: 'bar' })
  el.style.width = `${pct}%`
  return el
}

// How many answers each mood got, best first, as horizontal bars.
export function distributionChart(r: Report): HTMLElement {
  const max = Math.max(1, ...Object.values(r.distribution))
  const rows = [5, 4, 3, 2, 1].map((mood) => {
    const n = r.distribution[String(mood)] ?? 0
    const pct = r.responses > 0 ? Math.round((n / r.responses) * 100) : 0
    return h(
      'div',
      { class: 'bar-row', title: `${moodLabel(mood)}: ${answers(n)} (${pct}%)` },
      h('span', { class: 'bar-label' }, h('span', { class: 'emoji', 'aria-hidden': 'true' }, moodEmoji(mood)), moodLabel(mood)),
      h('span', { class: 'bar-track' }, n > 0 ? bar((n / max) * 100) : null),
      h('span', { class: 'bar-value' }, formatNumber(n), h('span', { class: 'muted' }, ` · ${pct}%`)),
    )
  })
  return h('div', { class: 'bars', role: 'list' }, ...rows.map((r) => (r.setAttribute('role', 'listitem'), r)))
}
