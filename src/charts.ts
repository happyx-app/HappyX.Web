// Hand-drawn SVG/HTML charts: thin 2px lines, 8px markers, recessive grid, a crosshair
// tooltip and a table view. Mood is always on a 1-5 axis labelled with the survey's emojis.

import type { DayStat, Report } from './api'
import { h, s } from './dom'
import { formatDay, formatNumber, moodEmoji, moodLabel, t } from './i18n'

export interface Series {
  name: string
  color: string // a CSS colour, e.g. var(--cat-1)
  values: (number | null)[] // one per x point; null leaves a gap
  dashed?: boolean // a reference line, e.g. the period before: no dots, drawn under the rest
}

interface LineChartOptions {
  label: string
  // Builds the tooltip for x point i.
  tooltip: (i: number) => Node[]
  // Formats an x label; labels are thinned to fit.
  tick?: (x: string) => string
  // Which points may get a label (default: all, thinned evenly).
  tickAt?: (i: number) => boolean
}

// Mood over time, one line per series, redrawn to fit its container.
export function lineChart(xs: string[], series: Series[], opts: LineChartOptions): HTMLElement {
  const wrap = h('div', { class: 'trend' })
  const tooltip = h('div', { class: 'tooltip', role: 'status', hidden: true })
  let drawnWidth = 0
  new ResizeObserver(() => {
    const width = Math.round(wrap.clientWidth)
    if (width === 0 || width === drawnWidth) return
    drawnWidth = width
    wrap.replaceChildren(drawLines(xs, series, opts, Math.max(280, width), tooltip), tooltip)
  }).observe(wrap)
  return wrap
}

// Average mood per day of a server, with gaps on days without answers. With previous (the
// days of the period before), the n-th day of that period is drawn under the n-th day of this
// one as a dashed line: matching by position keeps both lines on working days.
export function trendChart(days: DayStat[], previous: DayStat[] = []): HTMLElement {
  const prevOf = (i: number) => (previous[i]?.responses ? previous[i] : undefined)
  const series: Series[] = []
  if (days.some((_, i) => prevOf(i))) {
    series.push({ name: t('chart.previous'), color: 'var(--axis)', dashed: true, values: days.map((_, i) => prevOf(i)?.average ?? null) })
  }
  series.push({ name: t('stat.average'), color: 'var(--series)', values: days.map((d) => (d.responses > 0 ? d.average : null)) })
  return lineChart(
    days.map((d) => d.day),
    series,
    {
      label: t('chart.trend'),
      tooltip: (i) => {
        const d = days[i]
        const p = prevOf(i)
        return [
          h('div', { class: 'tooltip-title' }, formatDay(d.day, { weekday: 'short', day: 'numeric', month: 'short' })),
          d.responses > 0
            ? h('div', {}, h('strong', {}, `${moodEmoji(d.average)} ${formatNumber(d.average, 1)}`), ` · ${answers(d.responses)}`)
            : h('div', { class: 'muted' }, t('chart.noAnswers')),
          p ? h('div', { class: 'muted' }, t('chart.previous.value', { day: formatDay(p.day, { day: 'numeric', month: 'short' }), value: formatNumber(p.average, 1) })) : null,
        ].filter((n): n is HTMLDivElement => n !== null)
      },
    },
  )
}

export function answers(n: number): string {
  return n === 1 ? t('chart.answer') : t('chart.answers', { n: formatNumber(n) })
}

function drawLines(xs: string[], series: Series[], opts: LineChartOptions, width: number, tooltip: HTMLElement): SVGSVGElement {
  const height = 260
  const m = { top: 12, right: 12, bottom: 28, left: 34 }
  const iw = width - m.left - m.right
  const ih = height - m.top - m.bottom
  const n = xs.length
  const step = n > 1 ? iw / (n - 1) : 0
  const x = (i: number) => m.left + (n > 1 ? i * step : iw / 2)
  const y = (v: number) => m.top + ((5 - v) / 4) * ih
  const tick = opts.tick ?? ((d: string) => formatDay(d))

  const svg = s('svg', { width, height, viewBox: `0 0 ${width} ${height}`, class: 'chart', role: 'img', 'aria-label': opts.label })

  // Grid: one hairline per mood, with the emoji as the tick label.
  for (let v = 1; v <= 5; v++) {
    svg.append(
      s('line', { x1: m.left, x2: width - m.right, y1: y(v), y2: y(v), class: v === 1 ? 'axis' : 'grid' }),
      s('text', { x: m.left - 10, y: y(v), class: 'tick tick-y', 'text-anchor': 'end', 'dominant-baseline': 'central' }, moodEmoji(v)),
    )
  }

  // X ticks: about one every 80px. Evenly spaced (always including the last point), or
  // only at the points tickAt allows (at least 56px apart).
  if (opts.tickAt) {
    let last = -Infinity
    xs.forEach((d, i) => {
      if (!opts.tickAt!(i) || x(i) - last < 56 || x(i) > width - m.right - 16) return
      last = x(i)
      svg.append(s('text', { x: x(i), y: height - 8, class: 'tick', 'text-anchor': i === 0 ? 'start' : 'middle' }, tick(d)))
    })
  } else {
    const every = Math.max(1, Math.ceil(n / Math.max(1, Math.floor(iw / 80))))
    xs.forEach((d, i) => {
      if (i % every !== 0 && i !== n - 1) return
      if (i !== n - 1 && n - 1 - i < every * 0.75) return // keep the last label clear
      const anchor = n === 1 ? 'middle' : i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'
      svg.append(s('text', { x: x(i), y: height - 8, class: 'tick', 'text-anchor': anchor }, tick(d)))
    })
  }

  // Lines are joined only between consecutive points that both have a value.
  for (const se of series) {
    let path = ''
    se.values.forEach((v, i) => {
      if (v === null) return
      path += `${i > 0 && se.values[i - 1] !== null ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`
    })
    const line = s('path', { d: path, class: se.dashed ? 'line line-dashed' : 'line' })
    line.style.stroke = se.color
    svg.append(line)
    if (se.dashed) continue
    se.values.forEach((v, i) => {
      if (v === null) return
      const dot = s('circle', { cx: x(i), cy: y(v), r: 4, class: 'dot' })
      dot.style.fill = se.color
      svg.append(dot)
    })
  }

  // Hover: crosshair on the nearest point + tooltip.
  const cross = s('line', { y1: m.top, y2: m.top + ih, class: 'crosshair', visibility: 'hidden' })
  const focus = series.map((se) => {
    const c = s('circle', { r: 6, class: 'focus', visibility: 'hidden' })
    c.style.fill = se.color
    return c
  })
  svg.append(cross, ...focus)
  const hit = s('rect', { x: m.left - step / 2, y: 0, width: iw + step, height, fill: 'transparent' })
  const show = (clientX: number) => {
    const box = svg.getBoundingClientRect()
    const i = Math.max(0, Math.min(n - 1, Math.round((clientX - box.left - m.left) / (step || 1))))
    cross.setAttribute('x1', String(x(i)))
    cross.setAttribute('x2', String(x(i)))
    cross.setAttribute('visibility', 'visible')
    let top = m.top + ih / 2
    series.forEach((se, k) => {
      const v = se.values[i]
      if (v === null) {
        focus[k].setAttribute('visibility', 'hidden')
        return
      }
      focus[k].setAttribute('cx', String(x(i)))
      focus[k].setAttribute('cy', String(y(v)))
      focus[k].setAttribute('visibility', 'visible')
      top = Math.min(top, y(v))
    })
    tooltip.replaceChildren(...opts.tooltip(i))
    tooltip.hidden = false
    const left = Math.min(Math.max(x(i) - tooltip.offsetWidth / 2, 0), width - tooltip.offsetWidth)
    tooltip.style.left = `${left}px`
    tooltip.style.top = `${Math.max(0, top - tooltip.offsetHeight - 14)}px`
  }
  const hide = () => {
    cross.setAttribute('visibility', 'hidden')
    focus.forEach((f) => f.setAttribute('visibility', 'hidden'))
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
