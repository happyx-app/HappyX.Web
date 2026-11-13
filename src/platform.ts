// Web-platform pieces from modern-web-guidance (https://github.com/GoogleChrome/modern-web-guidance):
// polyfills loaded only when missing, toggletips, the top bar that hides while scrolling down,
// view transitions between pages, and page titles.

import { h } from './dom'

// «declarative-dialog-popover-control» / «interest-triggered-tooltips»: feature-detect, then load
// only what is missing. Listeners that must see every toggle are in place before any import.
export function loadPolyfills() {
  // Toggletip buttons own aria-expanded: keep it in sync from the popover (toggle doesn't bubble).
  document.addEventListener('toggle', (e) => {
    const target = e.target as HTMLElement
    if (!target.id) return
    for (const b of document.querySelectorAll<HTMLElement>(`[data-toggletip="${CSS.escape(target.id)}"]`)) {
      b.setAttribute('aria-expanded', String((e as ToggleEvent).newState === 'open'))
    }
  }, true)
  // popover="hint" falls back to "manual" where it isn't supported: a toggletip opened by a click
  // would never close, so it becomes "auto" as it opens (in beforetoggle, which doesn't bubble).
  const probe = document.createElement('div')
  probe.setAttribute('popover', 'hint')
  if ((probe as HTMLElement & { popover: string | null }).popover !== 'hint') {
    document.addEventListener('beforetoggle', (e) => {
      const target = e.target as HTMLElement
      if ((e as ToggleEvent).newState === 'open' && target.getAttribute('popover') === 'hint' && document.querySelector(`[popovertarget="${CSS.escape(target.id)}"]`)) {
        target.setAttribute('popover', 'auto')
      }
    }, true)
  }
  const missing: Promise<unknown>[] = []
  if (!Object.hasOwn(HTMLElement.prototype, 'popover')) missing.push(import('@oddbird/popover-polyfill'))
  if (!('interestForElement' in HTMLButtonElement.prototype)) missing.push(import('interestfor'))
  // Without them the page still works: the «?» and the account menu just don't open.
  Promise.all(missing).catch((err: unknown) => console.error('HappyX: a polyfill failed to load', err))
}

let tipCount = 0

// A "?" toggletip: hover/focus (interestfor) or click/Enter (popovertarget) shows a short
// explanation of how a figure is worked out. The button's name says what it reveals.
export function toggletip(name: string, text: string) {
  const id = `tip-${++tipCount}`
  const button = h('button', {
    type: 'button', class: 'tip-btn', 'aria-label': name, 'aria-expanded': 'false',
    interestfor: id, popovertarget: id, popovertargetaction: 'show', 'data-toggletip': id,
  }, '?')
  // Right after the trigger, so reading keys reach it once open.
  const tip = h('div', { id, popover: 'hint', role: 'tooltip', class: 'tip' }, text)
  return [button, tip] as const
}

// «content-first-noise-reduction»: the top bar slides away while scrolling down and comes back on
// the first scroll up. CSS does it with a scroll-state container query; this script is only for
// browsers without one.
export function hideBarOnScroll() {
  if (CSS.supports('container-type', 'scroll-state')) return
  let lastY = scrollY
  addEventListener('scroll', () => {
    const bar = document.querySelector<HTMLElement>('.topbar')
    if (!bar) return
    const y = Math.max(0, Math.min(scrollY, document.documentElement.scrollHeight - innerHeight))
    if (y === lastY) return
    bar.classList.toggle('is-hidden', y > lastY && y > bar.offsetHeight)
    lastY = y
  }, { passive: true })
}

// «same-document-transitions»: a soft cross-fade from what is on screen to what update() draws
// (a new page, new figures on the same page, another theme). The CSS keeps it to a short fade,
// and it is off with reduced motion. Settles once the new content is in the document.
//
// One fade at a time: one asked for while another runs starts when that one ends, so none is cut
// short and updates land in the order they were asked for.
let fading: Promise<unknown> = Promise.resolve()
export function crossFade(update: () => void): Promise<void> {
  if (!document.startViewTransition || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    update()
    return Promise.resolve()
  }
  const started = fading.then(() => {
    const vt = document.startViewTransition(update)
    vt.ready.catch(() => {}) // skipped (the page was hidden, say): the update still runs
    return vt
  })
  // The next fade starts only once this one has finished, whatever happened to it.
  fading = started.then((vt) => vt.finished).catch(() => {})
  return started.then((vt) => vt.updateCallbackDone)
}

// «accessibility»: every page its own title, front-loaded.
export function setTitle(...parts: (string | null | undefined)[]) {
  document.title = [...parts.filter(Boolean), 'HappyX'].join(' · ')
}
