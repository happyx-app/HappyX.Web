// Light or dark. With no saved choice the page follows the system (the CSS media query);
// a saved choice sets data-theme on <html>, which the CSS checks before the media query.

export type Theme = 'light' | 'dark'

const storageKey = 'happyx.theme'

export const isTheme = (v: unknown): v is Theme => v === 'light' || v === 'dark'

function saved(): Theme | null {
  try {
    const v = localStorage.getItem(storageKey)
    return isTheme(v) ? v : null
  } catch {
    return null
  }
}

export function currentTheme(): Theme {
  const t = document.documentElement.dataset.theme
  if (isTheme(t)) return t
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function applySavedTheme() {
  const t = saved()
  if (t) document.documentElement.dataset.theme = t
}

export function setTheme(t: Theme) {
  document.documentElement.dataset.theme = t
  try {
    localStorage.setItem(storageKey, t)
  } catch {
    // Private mode: it lasts for this page only.
  }
}
