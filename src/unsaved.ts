import { h } from './dom'
import { t } from './i18n'

// «No changes» / «Unsaved changes» beside a card's Save button. It follows the button's
// data-dirty, which each form already keeps up to date for the «leave the page?» check.
export function unsavedNote(save: HTMLElement): HTMLElement {
  const note = h('span', { class: 'unsaved' })
  const paint = () => {
    const dirty = save.dataset.dirty === 'true'
    note.textContent = t(dirty ? 'settings.unsaved' : 'settings.saved.none')
    note.className = dirty ? 'unsaved on' : 'unsaved'
  }
  new MutationObserver(paint).observe(save, { attributes: true, attributeFilter: ['data-dirty'] })
  paint()
  return note
}
