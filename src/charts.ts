// Hand-drawn SVG/HTML charts: thin 2px lines, 8px markers, recessive grid, a crosshair
// tooltip and a table view. Mood is always on a 1-5 axis labelled with the survey's emojis.

import { counted, countedAnswers, hasAverage, type DayStat, type Report } from './api'
import { h, s } from './dom'
import { monday } from './evolution'
import { addDays } from './periods'
import { formatDay, formatNumber, formatRange, moodEmoji, moodLabel, t } from './i18n'
import * as icons from './icons'

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
  // Short notes on single points of the last series, e.g. «Highest: 4.4», each with a dot.
  // Left out on narrow charts.
  notes?: { index: number; text: string; below?: boolean }[]
  // A dot on every point (default). Without, only lone points get one.
  dots?: boolean
  marked?: (i: number) => boolean // with dots off, these points still get one (e.g. days with comments)
  // Points with answers but no value to show (withheld days): a hollow ring on the baseline,
  // titled with this text, so they don't look like days nobody answered.
  hollow?: { at: (i: number) => boolean; title: string }
  // A faint vertical line where a new week starts (xs are days).
  weekLines?: boolean
  // Whether point i can be picked, and what picking it does (a click or tap on the chart).
  pickable?: (i: number) => boolean
  pick?: (i: number) => void
  // Events of the team: a bookmark above the chart at their first day and, over several days, a
  // faint band behind the lines. Hovering, focusing or tapping a bookmark shows what happened.
  events?: ChartEvent[]
  // The days point i stands for (default: its own day; a week by week).
  span?: (i: number) => { from: string; to: string }
  // While on() says so, a click on a day or a drag over several marks them: done gets their days.
  mark?: { on: () => boolean; done: (from: string, to: string) => void }
}

export interface ChartEvent {
  id: string
  from: string
  to: string
  title: string
  description?: string
  where?: string // the server's name, when the chart shows more than one
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
    wrap.replaceChildren(...drawLines(xs, series, opts, Math.max(280, width), tooltip), tooltip)
  }).observe(wrap)
  return wrap
}

// Where each event sits: the first and last point it covers (lo > hi when it falls between two
// points, e.g. on a weekend without a survey) and its row above the chart, so overlapping
// events never hide each other. Events outside the points are left out.
export function placeEvents(xs: string[], events: ChartEvent[], span: (i: number) => { from: string; to: string }) {
  const n = xs.length
  if (n === 0) return []
  const placed: { e: ChartEvent; lo: number; hi: number; row: number }[] = []
  const rowsEnd: number[] = []
  for (const e of [...events].sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to))) {
    if (e.to < span(0).from || e.from > span(n - 1).to) continue
    let lo = 0
    while (lo < n && span(lo).to < e.from) lo++
    let hi = n - 1
    while (hi >= 0 && span(hi).from > e.to) hi--
    const start = Math.min(lo, hi + 0.5)
    let row = rowsEnd.findIndex((end) => end < start)
    if (row === -1) row = rowsEnd.push(0) - 1
    rowsEnd[row] = Math.max(lo, hi)
    placed.push({ e, lo, hi, row })
  }
  return placed
}

let eventTips = 0

// «Hackeo · 3–5 nov», as a screen reader hears a bookmark.
const eventDates = (e: ChartEvent) => formatRange(e.from, e.to, false)

// Average mood per day of a server, with gaps on days without answers. With previous (the
// days of the period before), the n-th day of that period is drawn under the n-th day of this
// one as a dashed line: matching by position keeps both lines on working days.
// With byWeek, days are weeks (see weeklyStats), each with a dot. With comments(i) > 0, the
// tooltip says point i has comments and a click shows them (pick).
export function trendChart(days: DayStat[], previous: DayStat[] = [], notes: LineChartOptions['notes'] = [], byWeek = false, comments?: (i: number) => number, pick?: (i: number) => void, more: Pick<LineChartOptions, 'events' | 'span' | 'mark'> = {}): HTMLElement {
  const title = (d: DayStat) => weekOrDay(d, byWeek)
  const prevOf = (i: number) => (previous[i] && hasAverage(previous[i]) ? previous[i] : undefined)
  const series: Series[] = []
  if (days.some((_, i) => prevOf(i))) {
    series.push({ name: t('chart.previous'), color: 'var(--prev)', dashed: true, values: days.map((_, i) => prevOf(i)?.average ?? null) })
  }
  series.push({ name: t('stat.average'), color: 'var(--series)', values: days.map((d) => (hasAverage(d) ? d.average : null)) })
  return lineChart(
    days.map((d) => d.day),
    series,
    {
      label: trendSummary(days, byWeek),
      notes,
      dots: byWeek,
      weekLines: !byWeek,
      pickable: (i) => !!comments && comments(i) > 0,
      marked: (i) => !!comments && comments(i) > 0,
      hollow: { at: (i) => days[i].responses > 0 && !hasAverage(days[i]), title: t('chart.withheld') },
      pick,
      ...more,
      tooltip: (i) => {
        const d = days[i]
        const p = prevOf(i)
        return [
          h('div', { class: 'tooltip-title' }, title(d)),
          hasAverage(d)
            ? h('div', {}, h('strong', {}, `${moodEmoji(d.average)} ${formatNumber(d.average, 1)}`), d.recipients ? null : ` · ${answers(d.responses)}`)
            : d.responses > 0
              ? h('div', { class: 'muted' }, t('chart.withheld'), d.recipients ? null : ` · ${answers(d.responses)}`)
              : h('div', { class: 'muted' }, t('chart.noAnswers')),
          d.recipients ? h('div', { class: 'muted' }, t(byWeek ? 'chart.participation.week' : 'chart.participation', { n: formatNumber(Math.min(d.responses, d.recipients)), of: formatNumber(d.recipients) })) : null,
          p ? h('div', { class: 'muted' }, t('chart.previous.value', { day: title(p), value: formatNumber(p.average, 1) })) : null,
          comments && comments(i) > 0 ? h('div', { class: 'tooltip-action' }, comments(i) === 1 ? t('chart.comments.one') : t('chart.comments', { n: formatNumber(comments(i)) })) : null,
        ].filter((n): n is HTMLDivElement => n !== null)
      },
    },
  )
}

// What a screen reader hears for the trend chart: the range of days, the lowest and highest daily
// average, and the average over the period.
export function trendSummary(days: DayStat[], byWeek = false): string {
  const answered = days.filter(hasAverage)
  if (answered.length === 0 || days.length === 0) return t(byWeek ? 'chart.trend.week' : 'chart.trend')
  const avgs = answered.map((d) => d.average)
  const total = answered.reduce((n, d) => n + counted(d), 0)
  const avg = answered.reduce((sum, d) => sum + d.average * counted(d), 0) / total
  const long: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long' }
  return t(byWeek ? 'chart.trend.week.summary' : 'chart.trend.summary', {
    from: formatDay(days[0].day, long),
    to: formatDay(days[days.length - 1].day, long),
    min: formatNumber(Math.min(...avgs), 1),
    max: formatNumber(Math.max(...avgs), 1),
    avg: formatNumber(avg, 1),
  })
}

export function answers(n: number): string {
  return n === 1 ? t('chart.answer') : t('chart.answers', { n: formatNumber(n) })
}


// A smooth line through the points that never bulges past them (monotone cubic, like
// d3.curveMonotoneX), so the curve between two days never shows a value nobody gave.
// Returns the segments after the first point: «C…C…».
function monotone(pts: [number, number][]): string {
  const n = pts.length
  if (n < 2) return ''
  const dx = pts.slice(1).map((p, i) => p[0] - pts[i][0])
  const slope = pts.slice(1).map((p, i) => (p[1] - pts[i][1]) / dx[i])
  const m = pts.map((_, i) => {
    if (i === 0) return slope[0]
    if (i === n - 1) return slope[n - 2]
    const a = slope[i - 1]
    const b = slope[i]
    return a * b <= 0 ? 0 : (3 * (dx[i - 1] + dx[i])) / ((2 * dx[i] + dx[i - 1]) / a + (dx[i] + 2 * dx[i - 1]) / b)
  })
  let d = ''
  for (let i = 0; i < n - 1; i++) {
    const h3 = dx[i] / 3
    const c1 = [pts[i][0] + h3, pts[i][1] + m[i] * h3]
    const c2 = [pts[i + 1][0] - h3, pts[i + 1][1] - m[i + 1] * h3]
    d += `C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${pts[i + 1][0].toFixed(1)},${pts[i + 1][1].toFixed(1)}`
  }
  return d
}

// The runs of consecutive points that have a value; gaps split them.
function runs(values: (number | null)[]): number[][] {
  const out: number[][] = []
  let run: number[] = []
  values.forEach((v, i) => {
    if (v === null) {
      if (run.length) out.push(run)
      run = []
    } else run.push(i)
  })
  if (run.length) out.push(run)
  return out
}

// The indexes of the days (YYYY-MM-DD) that start a new week: the first day after a Sunday,
// or after a skipped week. Days without a survey are often left out, so this need not be Monday.
export function weekStarts(xs: string[]): number[] {
  const dow = (d: string) => (new Date(d + 'T12:00:00Z').getUTCDay() + 6) % 7
  const days = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5)
  const out: number[] = []
  for (let i = 1; i < xs.length; i++) if (dow(xs[i]) < dow(xs[i - 1]) || days(xs[i - 1], xs[i]) >= 7) out.push(i)
  return out
}

function drawLines(xs: string[], series: Series[], opts: LineChartOptions, width: number, tooltip: HTMLElement): (SVGSVGElement | HTMLElement)[] {
  const span = opts.span ?? ((i: number) => ({ from: xs[i], to: xs[i] }))
  const placed = placeEvents(xs, opts.events ?? [], span)
  const rows = placed.reduce((r, p) => Math.max(r, p.row + 1), 0)
  // One 22px row of bookmarks per overlapping event, above the top line.
  const lane = 22
  const height = 260 + rows * lane
  const m = { top: 12 + rows * lane, right: 12, bottom: 28, left: 34 }
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

  // Week lines: halfway between the last day of a week and the first of the next.
  if (opts.weekLines) {
    for (const i of weekStarts(xs)) {
      const xm = (x(i - 1) + x(i)) / 2
      svg.append(s('line', { x1: xm, x2: xm, y1: m.top, y2: m.top + ih, class: 'week' }))
    }
  }

  // Events: a faint band behind the lines over the days they cover; a lone day gets a narrow one.
  const edge = (lo: number, hi: number) => {
    if (lo > hi) {
      const xm = (x(hi) + x(lo)) / 2
      return [xm - 2, xm + 2]
    }
    const half = Math.max(step / 2, 3)
    return [Math.max(m.left, x(lo) - half), Math.min(width - m.right, x(hi) + half)]
  }
  for (const p of placed) {
    const [a, b] = edge(p.lo, p.hi)
    svg.append(s('rect', { x: a, y: m.top, width: b - a, height: ih, class: 'event-band' }))
  }
  const preview = s('rect', { y: m.top, height: ih, class: 'event-band event-preview', visibility: 'hidden' })
  svg.append(preview)

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

  // A single solid line gets a flat, faint fill under it; each run of consecutive days is
  // its own shape, so gaps stay empty.
  const solid = series.filter((se) => !se.dashed)
  if (solid.length === 1) {
    const se = solid[0]
    const bottom = m.top + ih
    let d = ''
    for (const run of runs(se.values)) {
      if (run.length < 2) continue
      const pts = run.map((i): [number, number] => [x(i), y(se.values[i]!)])
      d += `M${pts[0][0].toFixed(1)},${bottom}L${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}${monotone(pts)}L${pts[pts.length - 1][0].toFixed(1)},${bottom}Z`
    }
    if (d) {
      const area = s('path', { d, class: 'area' })
      area.style.fill = se.color // CSSOM, not a style attribute: the CSP blocks those
      svg.append(area)
    }
  }

  // Lines are joined only between consecutive points that both have a value.
  for (const se of series) {
    let path = ''
    for (const run of runs(se.values)) {
      const pts = run.map((i): [number, number] => [x(i), y(se.values[i]!)])
      path += `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}${monotone(pts)}`
    }
    const line = s('path', { d: path, class: se.dashed ? 'line line-dashed' : 'line' })
    line.style.stroke = se.color
    svg.append(line)
    if (se.dashed) continue
    se.values.forEach((v, i) => {
      // Without a dot on every day, a lone day between gaps still needs one to be seen.
      const lone = (se.values[i - 1] ?? null) === null && (se.values[i + 1] ?? null) === null
      if (v === null || (opts.dots === false && !lone && !opts.marked?.(i))) return
      const dot = s('circle', { cx: x(i), cy: y(v), r: 4, class: 'dot' })
      dot.style.fill = se.color
      svg.append(dot)
    })
  }

  if (opts.hollow) {
    for (let i = 0; i < n; i++) {
      if (!opts.hollow.at(i)) continue
      svg.append(s('circle', { cx: x(i), cy: m.top + ih, r: 4, class: 'dot-hollow' }, s('title', {}, opts.hollow.title)))
    }
  }

  // Notes sit above (or below) their point, kept inside the chart.
  const last = series[series.length - 1]
  if (width >= 560) {
    for (const note of opts.notes ?? []) {
      const v = last?.values[note.index]
      if (v === null || v === undefined) continue
      const dot = s('circle', { cx: x(note.index), cy: y(v), r: 5, class: 'dot' })
      dot.style.fill = last.color
      svg.append(dot)
      const label = s('text', { x: Math.min(Math.max(x(note.index), m.left + 40), width - m.right - 40), y: y(v) + (note.below ? 22 : -14), class: 'note', 'text-anchor': 'middle' }, note.text)
      svg.append(label)
    }
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
  const at = (clientX: number) => {
    const box = svg.getBoundingClientRect()
    return Math.max(0, Math.min(n - 1, Math.round((clientX - box.left - m.left) / (step || 1))))
  }
  const show = (clientX: number) => {
    const i = at(clientX)
    svg.classList.toggle('pickable', !!opts.pickable?.(i))
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
    const covering = placed.filter((p) => p.lo <= i && i <= p.hi)
    tooltip.replaceChildren(
      ...opts.tooltip(i),
      ...covering.map((p) => h('div', { class: 'tooltip-event' }, icons.inline(icons.bookmark), p.e.title)),
    )
    tooltip.hidden = false
    svg.classList.add('hovering')
    const left = Math.min(Math.max(x(i) - tooltip.offsetWidth / 2, 0), width - tooltip.offsetWidth)
    tooltip.style.left = `${left}px`
    tooltip.style.top = `${Math.max(0, top - tooltip.offsetHeight - 14)}px`
  }
  const hide = () => {
    cross.setAttribute('visibility', 'hidden')
    focus.forEach((f) => f.setAttribute('visibility', 'hidden'))
    tooltip.hidden = true
    svg.classList.remove('hovering')
  }
  // Marking: from the day pressed to the day let go, drawn as the band it will become.
  let pressed: number | null = null
  const stretch = (a: number, b: number) => {
    const [l, r] = edge(Math.min(a, b), Math.max(a, b))
    preview.setAttribute('x', String(l))
    preview.setAttribute('width', String(r - l))
    preview.setAttribute('visibility', 'visible')
  }
  hit.addEventListener('pointermove', (e) => {
    if (pressed !== null) stretch(pressed, at(e.clientX))
    show(e.clientX)
  })
  hit.addEventListener('pointerdown', (e) => {
    if (opts.mark?.on()) {
      pressed = at(e.clientX)
      hit.setPointerCapture(e.pointerId)
      stretch(pressed, pressed)
    }
    show(e.clientX)
  })
  hit.addEventListener('pointerup', (e) => {
    if (pressed === null) return
    const a = Math.min(pressed, at(e.clientX))
    const b = Math.max(pressed, at(e.clientX))
    pressed = null
    hide()
    opts.mark!.done(span(a).from, span(b).to)
  })
  hit.addEventListener('pointercancel', () => {
    pressed = null
    preview.setAttribute('visibility', 'hidden')
  })
  hit.addEventListener('pointerleave', () => {
    if (pressed === null) hide()
  })
  hit.addEventListener('click', (e) => {
    if (opts.mark?.on()) return
    const i = at(e.clientX)
    if (opts.pick && opts.pickable?.(i)) opts.pick(i)
  })
  svg.append(hit)
  // The label says what the chart shows; its tick and note texts would only be read as a jumble.
  svg.querySelectorAll('text').forEach((el) => el.setAttribute('aria-hidden', 'true'))
  if (placed.length === 0) return [svg]

  // Bookmarks: buttons over the chart, each a toggletip (hover or focus, click or Enter) with
  // what happened. A line along their row shows how many days an event lasts.
  const layer = h('div', { class: 'event-layer' })
  for (const p of placed) {
    const [a, b] = edge(p.lo, p.hi)
    const top = 6 + p.row * lane
    if (b - a > 12) {
      const run = h('span', { class: 'event-run', 'aria-hidden': 'true' })
      run.style.left = `${a}px`
      run.style.width = `${b - a}px`
      run.style.top = `${top + 9}px`
      layer.append(run)
    }
    const id = `event-tip-${++eventTips}`
    const name = t('event.bookmark', { title: p.e.title, dates: eventDates(p.e) })
    const button = h('button', {
      type: 'button', class: 'event-mark', 'aria-label': name, 'aria-expanded': 'false',
      interestfor: id, popovertarget: id, popovertargetaction: 'show', 'data-toggletip': id,
    }, icons.bookmark())
    button.style.left = `${Math.max(0, a - 2)}px`
    button.style.top = `${top}px`
    const tip = h('div', { id, popover: 'hint', role: 'tooltip', class: 'tip event-tip' },
      h('strong', {}, p.e.title),
      h('div', { class: 'muted' }, p.e.where ? `${eventDates(p.e)} · ${p.e.where}` : eventDates(p.e)),
      p.e.description ? h('p', {}, p.e.description) : null,
    )
    layer.append(button, tip)
  }
  return [svg, layer]
}

// A point's name: its day, or «Week of 2 Nov», with «(in progress)» while that week isn't over.
function weekOrDay(d: DayStat & { partial?: boolean }, byWeek: boolean): string {
  if (!byWeek) return formatDay(d.day, { weekday: 'short', day: 'numeric', month: 'short' })
  const week = t('me.weekOf', { day: formatDay(d.day, { day: 'numeric', month: 'short' }) })
  return d.partial ? t('chart.week.partial', { week }) : week
}

// counted: the week's answers its average covers, those of withheld days left out.
export type WeekStat = DayStat & { partial?: boolean; counted: number }

// Each day's answers added up by week (Monday to Sunday), with the week's Monday as the day. With
// until (the period's last day), a week that ends after it is marked partial. Withheld days only
// add to the week's answers; a week with only withheld days is withheld too.
export function weeklyStats(days: DayStat[], until?: string): WeekStat[] {
  const out: WeekStat[] = []
  for (const d of days) {
    const day = monday(d.day)
    let w = out[out.length - 1]
    if (!w || w.day !== day) {
      w = { day, responses: 0, average: 0, recipients: 0, counted: 0 }
      out.push(w)
    }
    const n = counted(d)
    if (n > 0) w.average = (w.average * w.counted + d.average * n) / (w.counted + n)
    w.counted += n
    w.responses += d.responses
    w.withheld = w.responses > 0 && w.counted === 0
    // Unknown for the week if the bot didn't report it for one of its days.
    w.recipients = w.recipients === undefined || d.recipients === undefined ? undefined : w.recipients + d.recipients
  }
  const last = out[out.length - 1]
  if (last && until && addDays(last.day, 6) > until) last.partial = true
  return out
}

// With comments, a last column gives each row's comments, as a button that shows them (pick).
export function trendTable(days: DayStat[], byWeek = false, comments?: (i: number) => number, pick?: (i: number) => void): HTMLTableElement {
  const commentCell = (i: number) => {
    const n = comments!(i)
    if (n === 0 || !pick) return h('td', { class: 'num' }, '–')
    const b = h('button', { type: 'button', class: 'link-btn' }, formatNumber(n))
    b.addEventListener('click', () => pick(i))
    return h('td', { class: 'num' }, b)
  }
  return h(
    'table',
    { class: 'table' },
    h('thead', {}, h('tr', {}, h('th', {}, t(byWeek ? 'chart.week' : 'chart.day')), h('th', { class: 'num' }, t('stat.average')), h('th', { class: 'num' }, t('stat.responses')), comments ? h('th', { class: 'num' }, t('messages.title')) : null)),
    h(
      'tbody',
      {},
      ...days.map((d, i) =>
        h(
          'tr',
          {},
          h('td', {}, weekOrDay(d, byWeek)),
          h('td', { class: 'num' }, hasAverage(d) ? `${moodEmoji(d.average)} ${formatNumber(d.average, 1)}` : d.responses > 0 ? h('span', { class: 'muted' }, t('chart.withheld')) : '–'),
          h('td', { class: 'num' }, formatNumber(d.responses)),
          comments ? commentCell(i) : null,
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
  const total = countedAnswers(r)
  const rows = [5, 4, 3, 2, 1].map((mood) => {
    const n = r.distribution[String(mood)] ?? 0
    const pct = total > 0 ? Math.round((n / total) * 100) : 0
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
