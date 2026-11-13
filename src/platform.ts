// Web-platform pieces from modern-web-guidance (https://github.com/GoogleChrome/modern-web-guidance):
// polyfills loaded only when missing, toggletips, the top bar that hides while scrolling down,
// view transitions between pages, and page titles.

import { h } from './dom'

// «declarative-dialog-popover-control» / «interest-triggered-tooltips»: feature-detect, then load.
export async function loadPolyfills() {
  if (!Object.hasOwn(HTMLElement.prototype, 'popover')) await import('@oddbird/popover-polyfill')
  if (!('interestForElement' in HTMLButtonElement.prototype)) await import('interestfor')
  // popover="hint" falls back to "manual"; a toggletip opened by a click would never close, so it
  // becomes "auto" as it opens (must happen in beforetoggle, which doesn't bubble: capture).
  const probe = document.createElement('div')
  probe.setAttribute('popover', 'hint')
  if ((probe as HTMLElement & { popover: string | null }).popover !== 'hint') {
    document.addEventListener('beforetoggle', (e) => {
      const target = e.target as HTMLElement
      const ev = e as ToggleEvent
      if (ev.newState === 'open' && target.getAttribute('popover') === 'hint' && document.querySelector(`[popovertarget="${CSS.escape(target.id)}"]`)) {
        target.setAttribute('popover', 'auto')
      }
    }, true)
  }
  // «viewport-aware-dropdowns» fallback: without anchor positioning a popover would sit in the
  // top-left corner; place it under its button from getBoundingClientRect (CSSOM, CSP-safe).
  if (!CSS.supports('position-area: block-end')) {
    document.addEventListener('beforetoggle', (e) => {
      const target = e.target as HTMLElement
      if ((e as ToggleEvent).newState !== 'open' || !target.id) return
      const trigger = document.querySelector<HTMLElement>(`[popovertarget="${CSS.escape(target.id)}"]`)
      if (!trigger) return
      const r = trigger.getBoundingClientRect()
      target.style.position = 'fixed'
      target.style.top = `${r.bottom + 8}px`
      if (target.classList.contains('account-menu')) target.style.right = `${Math.max(16, innerWidth - r.right)}px`
      else target.style.left = `${Math.min(r.left, innerWidth - 16 - 280)}px`
    }, true)
  }
  // Toggletip buttons own aria-expanded: keep it in sync from the popover (toggle doesn't bubble).
  document.addEventListener('toggle', (e) => {
    const target = e.target as HTMLElement
    if (!target.id) return
    for (const b of document.querySelectorAll<HTMLElement>(`[data-toggletip="${CSS.escape(target.id)}"]`)) {
      b.setAttribute('aria-expanded', String((e as ToggleEvent).newState === 'open'))
    }
  }, true)
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

// «same-document-transitions»: a soft cross-fade between pages (the CSS keeps it to a fade and
// turns it off with reduced motion), then focus goes to the new page's heading.
export function swapPage(update: () => void, focusHeading = false) {
  const done = () => {
    if (!focusHeading) return
    const h1 = document.querySelector<HTMLElement>('main h1')
    if (h1) {
      h1.tabIndex = -1
      h1.focus({ preventScroll: true })
    }
  }
  if (!document.startViewTransition || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    update()
    done()
    return
  }
  const vt = document.startViewTransition(update)
  // A newer page skips this one's animation: not an error.
  vt.ready.catch(() => {})
  vt.finished.then(done, done)
}

// «accessibility»: every page its own title, front-loaded.
export function setTitle(...parts: (string | null | undefined)[]) {
  document.title = [...parts.filter(Boolean), 'HappyX'].join(' · ')
}
