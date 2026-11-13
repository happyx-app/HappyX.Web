// modern-web-guidance «dark-mode-toggle»: three states. «system» stores nothing and leaves
// <meta name="color-scheme" content="light dark">; «light» / «dark» are stored and pin the meta.
// The CSS maps the meta back to `color-scheme`, so colours (light-dark()) follow it with no class.
// public/theme-boot.js applies the stored value before the first paint (the CSP forbids inline scripts).

export type Theme = 'light' | 'dark'
export type ThemeChoice = Theme | 'system'

const storageKey = 'happyx.theme'

export const isTheme = (v: unknown): v is Theme => v === 'light' || v === 'dark'

const meta = () => document.querySelector<HTMLMetaElement>('meta[name="color-scheme"]')

// theme-color only takes media queries: a pinned choice turns its own on and the other off.
function themeColor(t: ThemeChoice) {
  for (const m of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    const own = m.content === '#ffffff' ? 'light' : 'dark'
    m.media = t === 'system' ? `(prefers-color-scheme: ${own})` : t === own ? 'all' : 'not all'
  }
}

export function savedTheme(): ThemeChoice {
  try {
    const v = localStorage.getItem(storageKey)
    return isTheme(v) ? v : 'system'
  } catch {
    return 'system'
  }
}

// The scheme the page is drawn in right now.
export function currentTheme(): Theme {
  const v = meta()?.content
  if (isTheme(v)) return v
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function applySavedTheme() {
  const m = meta()
  const t = savedTheme()
  if (m) m.content = t === 'system' ? 'light dark' : t
  themeColor(t)
  // Another tab changed it: follow.
  addEventListener('storage', (e) => {
    if (e.key !== storageKey) return
    const v: ThemeChoice = isTheme(e.newValue) ? e.newValue : 'system'
    if (m) m.content = v === 'system' ? 'light dark' : v
    themeColor(v)
  })
}

export function setTheme(t: ThemeChoice) {
  const m = meta()
  if (m) m.content = t === 'system' ? 'light dark' : t
  themeColor(t)
  try {
    if (t === 'system') localStorage.removeItem(storageKey)
    else localStorage.setItem(storageKey, t)
  } catch {
    // Site data blocked: it lasts for this page only.
  }
}
