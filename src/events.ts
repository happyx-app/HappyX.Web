// Team events on the chart: the dialog that creates, edits and deletes one, and the list under
// the chart that says the same as the bookmarks for whoever doesn't hover them.

import * as api from './api'
import type { ChartEvent } from './charts'
import { h } from './dom'
import { showSaveError } from './errors'
import { formatRange, t } from './i18n'
import * as icons from './icons'

export const titleMax = 60
export const descriptionMax = 280

let dialogs = 0

// eventDialog opens a modal to create an event over from..to, or to change or delete one. done
// gets the saved event, or null with the id when it was deleted.
export function eventDialog(guildID: string, start: { from: string; to: string }, existing: api.TeamEvent | null, done: (saved: api.TeamEvent | null, id?: string) => void) {
  const n = ++dialogs
  const ids = { title: `ev-title-${n}`, text: `ev-text-${n}`, from: `ev-from-${n}`, to: `ev-to-${n}`, head: `ev-head-${n}`, del: `ev-del-${n}` }
  const title = h('input', { id: ids.title, required: true, maxlength: titleMax, autocomplete: 'off', value: existing?.title ?? '', autofocus: true })
  const text = h('textarea', { id: ids.text, rows: 3, maxlength: descriptionMax }, existing?.description ?? '')
  const from = h('input', { id: ids.from, type: 'date', required: true, value: existing?.from ?? start.from })
  const to = h('input', { id: ids.to, type: 'date', required: true, value: existing?.to ?? start.to })
  const error = h('p', { class: 'small error', role: 'alert', hidden: true })
  const save = h('button', { type: 'submit', class: 'btn btn-primary' }, t('event.save'))
  const cancel = h('button', { type: 'button', class: 'btn btn-ghost' }, t('event.cancel'))

  // Deleting asks once more on the same button, with the reason next to it; the space for it is
  // kept so nothing moves under the pointer.
  const delNote = h('span', { id: ids.del, class: 'muted small event-del-note' }, t('event.delete.note'))
  const del = existing ? h('button', { type: 'button', class: 'btn btn-ghost event-del', 'aria-describedby': ids.del }, t('event.delete')) : null

  const form = h(
    'form',
    { class: 'event-form', novalidate: true },
    h('h2', { id: ids.head }, t(existing ? 'event.edit.title' : 'event.new.title')),
    h('div', { class: 'field' }, h('label', { for: ids.title }, t('event.field.title')), title),
    h('div', { class: 'field' }, h('label', { for: ids.text }, t('event.field.text')), text),
    h(
      'div',
      { class: 'event-dates' },
      h('div', { class: 'field' }, h('label', { for: ids.from }, t('event.field.from')), from),
      h('div', { class: 'field' }, h('label', { for: ids.to }, t('event.field.to')), to),
    ),
    error,
    h('div', { class: 'event-actions' }, del ? h('div', { class: 'event-del-wrap' }, del, delNote) : null, h('div', { class: 'event-main' }, cancel, save)),
  )
  const dialog = h('dialog', { class: 'event-dialog', 'aria-labelledby': ids.head }, form)
  cancel.addEventListener('click', () => dialog.close())
  dialog.addEventListener('close', () => dialog.remove())

  const fail = (msg: string, field?: HTMLInputElement) => {
    error.className = 'small error'
    error.textContent = msg
    error.hidden = false
    field?.setAttribute('aria-invalid', 'true')
    field?.focus()
  }
  for (const f of [title, from, to]) f.addEventListener('input', () => f.removeAttribute('aria-invalid'))

  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    error.hidden = true
    const input = { title: title.value.trim(), description: text.value.trim(), from: from.value, to: to.value }
    if (!input.title) return fail(t('event.error.title'), title)
    if (!input.from) return fail(t('event.error.dates'), from)
    if (!input.to) return fail(t('event.error.dates'), to)
    if (input.to < input.from) return fail(t('event.error.order'), to)
    save.disabled = true
    try {
      const saved = existing ? await api.updateEvent(guildID, existing.id, input) : await api.createEvent(guildID, input)
      dialog.close()
      done(saved)
    } catch (err) {
      showSaveError(error, err)
      error.hidden = false
    } finally {
      save.disabled = false
    }
  })

  if (del && existing) {
    let asked = false
    del.addEventListener('click', async () => {
      if (!asked) {
        asked = true
        del.textContent = t('event.delete.confirm')
        form.classList.add('confirm-delete')
        return
      }
      del.disabled = true
      try {
        await api.deleteEvent(guildID, existing.id)
        dialog.close()
        done(null, existing.id)
      } catch (err) {
        showSaveError(error, err)
        error.hidden = false
        del.disabled = false
      }
    })
  }

  document.body.append(dialog)
  dialog.showModal()
}

// The events of the period under the chart: what each bookmark says, and, for whoever can edit,
// a way to change it. Empty when the period has none.
export function eventList(events: ChartEvent[], edit?: (id: string) => void): HTMLElement | null {
  if (events.length === 0) return null
  const sorted = [...events].sort((a, b) => a.from.localeCompare(b.from))
  return h(
    'ul',
    { class: 'event-list', 'aria-label': t('event.list') },
    ...sorted.map((e) => {
      const button = edit ? h('button', { type: 'button', class: 'link-btn small', 'aria-label': t('event.edit.named', { title: e.title }) }, t('event.edit')) : null
      button?.addEventListener('click', () => edit!(e.id))
      return h(
        'li',
        {},
        icons.inline(icons.bookmark),
        h(
          'div',
          { class: 'event-text' },
          h('div', {}, h('strong', {}, e.title), h('span', { class: 'muted' }, ` · ${formatRange(e.from, e.to, false)}${e.where ? ` · ${e.where}` : ''}`)),
          e.description ? h('p', { class: 'secondary small' }, e.description) : null,
        ),
        button,
      )
    }),
  )
}
