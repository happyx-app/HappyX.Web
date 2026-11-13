// modern-web-guidance «dark-mode-toggle»: three states. «system» stores nothing and lets the page
// follow the system; «light» / «dark» are stored and pin it. The CSS maps
// <meta name="color-scheme"> to `color-scheme`, so colours (light-dark()) follow it with no class.
//
// public/theme-boot.js applies the stored choice before the first paint and exposes the function
// that does it as window.happyxTheme; this module uses that same function for later changes.

export type Theme = 'light' | 'dark'
export type ThemeChoice = Theme | 'system'

declare global {
  interface Window {
    happyxTheme?: (choice: ThemeChoice) => void
  }
}

const storageKey = 'happyx.theme'

export const isTheme = (v: unknown): v is Theme => v === 'light' || v === 'dark'
const choiceOf = (v: unknown): ThemeChoice => (isTheme(v) ? v : 'system')

export function savedTheme(): ThemeChoice {
  try {
    return choiceOf(localStorage.getItem(storageKey))
  } catch {
    return 'system'
  }
}

export function setTheme(choice: ThemeChoice) {
  window.happyxTheme?.(choice)
  try {
    if (choice === 'system') localStorage.removeItem(storageKey)
    else localStorage.setItem(storageKey, choice)
  } catch {
    // Site data blocked: it lasts for this page only.
  }
}

// Another tab changed the choice: apply it here too, then tell the caller (to update its radios).
export function onThemeChange(changed: (choice: ThemeChoice) => void) {
  addEventListener('storage', (e) => {
    if (e.key !== storageKey && e.key !== null) return
    const choice = savedTheme()
    window.happyxTheme?.(choice)
    changed(choice)
  })
}
