// Vacations: days without the survey or the game, which don't count against participation or the
// streak. People set their own on «My evolution», for every server; whoever manages a server can
// set one for a member there, in case they forgot.

import * as api from './api'
import { combobox, optionChip, type Option } from './access'
import { h } from './dom'
import { showSaveError } from './errors'
import * as icons from './icons'
import { addDays, todayIn } from './periods'
import { formatRange, t, type Key } from './i18n'

// The API's limits, checked here first so the message is in the reader's language.
export const maxVacationDays = 90
const maxLeadDays = 365

const localToday = () => todayIn(Intl.DateTimeFormat().resolvedOptions().timeZone)

// vacationProblem says what is wrong with the dates, or null when the API will take them. Days
// are YYYY-MM-DD, so comparing the strings compares the dates.
export function vacationProblem(from: string, to: string, today: string): Key | null {
  if (!from || !to) return 'vacation.error.missing'
  if (to < from) return 'vacation.error.order'
  if (to < today) return 'vacation.error.past'
  if (addDays(from, maxVacationDays - 1) < to) return 'vacation.error.long'
  if (addDays(today, maxLeadDays) < from) return 'vacation.error.far'
  return null
}

// The two dates and their limits. The browser's own date picker, so nothing is typed freely.
function dateFields(prefix: string, today: string, value?: { from: string; to: string }) {
  const from = h('input', { id: `${prefix}-from`, type: 'date', class: 'date-input', value: value?.from ?? '' })
  const to = h('input', { id: `${prefix}-to`, type: 'date', class: 'date-input', min: today, value: value?.to ?? '' })
  from.max = addDays(today, maxLeadDays)
  // The last day follows the first: picking a first day sets the earliest last day.
  from.addEventListener('change', () => {
    to.min = from.value && from.value > today ? from.value : today
    if (from.value && (!to.value || to.value < from.value)) to.value = from.value
  })
  const row = h(
    'div',
    { class: 'field-row vacation-dates' },
    h('div', { class: 'field' }, h('label', { for: from.id }, t('vacation.from')), from),
    h('div', { class: 'field' }, h('label', { for: to.id }, t('vacation.to')), to),
  )
  return { from, to, row }
}

const range = (v: { from: string; to: string }) => formatRange(v.from, v.to)

// --- «My evolution» ---

// myVacationCard shows the user's own vacation and the ones admins set for them, and lets them
// set, change or remove theirs.
export function myVacationCard(onLoggedOut: () => void): HTMLElement {
  const card = h('section', { class: 'card settings vacation', 'aria-labelledby': 'vacation-title', 'aria-busy': 'true' },
    h('h2', { id: 'vacation-title' }, t('vacation.title')),
    h('p', { class: 'muted small' }, t('access.loading')),
  )
  const load = () =>
    api.myVacations().then(
      (v) => {
        card.removeAttribute('aria-busy')
        card.replaceChildren(...myVacationForm(v, load, onLoggedOut))
      },
      (err) => {
        if (err instanceof api.Unauthorized) return onLoggedOut()
        card.removeAttribute('aria-busy')
        card.replaceChildren(h('h2', { id: 'vacation-title' }, t('vacation.title')), h('p', { class: 'error small' }, t('error.generic')))
      },
    )
  load()
  return card
}

function myVacationForm(v: api.MyVacations, reload: () => void, onLoggedOut: () => void): HTMLElement[] {
  const today = localToday()
  const own = v.own
  const fields = dateFields('my-vacation', today, own ?? undefined)
  const status = h('p', { class: 'small', role: 'status' })
  const save = h('button', { class: 'btn btn-primary', type: 'submit', disabled: true }, t(own ? 'settings.save' : 'vacation.save'))
  const dirty = () => fields.from.value !== (own?.from ?? '') || fields.to.value !== (own?.to ?? '')
  const refresh = () => {
    save.disabled = !dirty()
    save.dataset.dirty = String(dirty())
    if (dirty()) status.textContent = ''
  }
  for (const el of [fields.from, fields.to]) {
    el.addEventListener('change', refresh)
    el.addEventListener('input', refresh)
  }

  const failed = (err: unknown) => {
    if (err instanceof api.Unauthorized) return onLoggedOut()
    showSaveError(status, err)
    refresh()
  }
  const removeButton = (label: string, remove: () => Promise<void>) => {
    const b = h('button', { class: 'btn btn-outline', type: 'button' }, label)
    b.addEventListener('click', async () => {
      b.disabled = true
      try {
        await remove()
        reload()
      } catch (err) {
        b.disabled = false
        failed(err)
      }
    })
    return b
  }

  // With a vacation set, the dates show once, as text; the fields open to change them.
  const editor = h('div', { class: 'vacation-form', hidden: Boolean(own) }, fields.row, h('div', { class: 'form-actions' }, save))
  let summary: HTMLElement | null = null
  if (own) {
    const change = h('button', { class: 'btn btn-outline', type: 'button', 'aria-expanded': 'false', 'aria-controls': 'my-vacation-editor' }, t('vacation.change'))
    change.addEventListener('click', () => {
      editor.hidden = false
      change.remove()
      fields.from.focus()
    })
    summary = h('div', { class: 'vacation-summary' }, h('p', {}, h('strong', {}, t('vacation.mine', { range: range(own) }))), h('div', { class: 'form-actions' }, change, removeButton(t('vacation.remove'), api.deleteMyVacation)))
  }
  editor.id = 'my-vacation-editor'
  const form = h('form', { class: 'vacation-form', novalidate: true }, summary, editor, status)
  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    const problem = vacationProblem(fields.from.value, fields.to.value, today)
    if (problem) {
      status.className = 'small error'
      status.textContent = t(problem, { max: maxVacationDays })
      return
    }
    save.disabled = true
    status.className = 'small muted'
    status.textContent = t('settings.saving')
    try {
      await api.setMyVacation(fields.from.value, fields.to.value)
      reload()
    } catch (err) {
      failed(err)
    }
  })

  // The ones admins set: in that server only, and theirs to remove.
  const byAdmins = v.set_by_admins.length
    ? h(
        'ul',
        { class: 'grant-list vacation-list' },
        ...v.set_by_admins.map((x) =>
          h(
            'li',
            { class: 'grant' },
            h('span', {}, t('vacation.byAdmin', { server: x.guild_name ?? '', range: range(x) })),
            removeButton(t('vacation.remove'), () => api.deleteVacationSetByAdmin(x.discord_guild_id ?? '')),
          ),
        ),
      )
    : null
  refresh()
  const out = [h('h2', { id: 'vacation-title' }, t('vacation.title')), h('p', { class: 'muted small' }, t('vacation.help')), form]
  return byAdmins ? [...out, byAdmins] : out
}

// --- Settings, for admins ---

// guildVacationsCard lists the members' vacations in the server and lets an admin add one for
// someone who forgot. The member's own vacations show too, but only they can change those.
export function guildVacationsCard(g: api.Guild, onLoggedOut: () => void): HTMLElement {
  const card = h('section', { class: 'card settings vacation', 'aria-labelledby': 'guild-vacation-title', 'aria-busy': 'true' },
    h('h2', { id: 'guild-vacation-title' }, t('vacation.title')),
    h('p', { class: 'muted small' }, t('access.loading')),
  )
  const load = () =>
    api.guildVacations(g.discord_guild_id).then(
      (v) => {
        card.removeAttribute('aria-busy')
        card.replaceChildren(...guildVacationsForm(g, v, load, onLoggedOut))
      },
      (err) => {
        if (err instanceof api.Unauthorized) return onLoggedOut()
        card.removeAttribute('aria-busy')
        card.replaceChildren(h('h2', { id: 'guild-vacation-title' }, t('vacation.title')), h('p', { class: 'error small' }, t('error.generic')))
      },
    )
  load()
  return card
}

function guildVacationsForm(g: api.Guild, v: api.GuildVacations, reload: () => void, onLoggedOut: () => void): HTMLElement[] {
  const today = todayIn(g.timezone)
  const members: Option[] = v.members.map((m) => ({ kind: 'user', id: m.discord_user_id, label: m.username }))
  const byID = new Map(members.map((o) => [o.id, o]))
  let picked: Option | undefined
  const status = h('p', { class: 'small', role: 'status' })
  const failed = (err: unknown) => {
    if (err instanceof api.Unauthorized) return onLoggedOut()
    showSaveError(status, err)
  }

  const row = (x: api.GuildVacation) => {
    const who = optionChip(byID.get(x.discord_user_id) ?? { kind: 'user', id: x.discord_user_id, label: x.username })
    let end: HTMLElement
    if (x.set_here) {
      const name = x.username
      end = h('button', { class: 'btn btn-ghost btn-icon', type: 'button', 'aria-label': t('vacation.removeFor', { name }), title: t('vacation.removeFor', { name }) }, icons.x())
      end.addEventListener('click', async () => {
        ;(end as HTMLButtonElement).disabled = true
        try {
          await api.deleteGuildVacation(g.discord_guild_id, x.discord_user_id)
          reload()
        } catch (err) {
          ;(end as HTMLButtonElement).disabled = false
          failed(err)
        }
      })
    } else {
      end = h('span', { class: 'muted small' }, t('vacation.theirs'))
    }
    return h('li', { class: 'grant vacation-row' }, who, h('span', { class: 'small' }, range(x)), end)
  }

  const fields = dateFields('guild-vacation', today)
  const add = h('button', { class: 'btn btn-primary', type: 'submit' }, t('vacation.add'))
  const picker = combobox({
    id: 'vacation-member',
    label: t('vacation.member'),
    placeholder: t('vacation.member.placeholder'),
    options: () => members,
    selected: () => picked,
    onPick: (o) => {
      picked = o
      status.textContent = ''
    },
    noMatch: t('vacation.member.noMatch'),
  })
  const form = h(
    'form',
    { class: 'vacation-form', novalidate: true },
    h('div', { class: 'field' }, h('label', { for: 'vacation-member' }, t('vacation.member')), picker),
    fields.row,
    h('div', { class: 'form-actions' }, add, status),
  )
  // Only half-filled forms count as unsaved changes.
  const dirty = () => String(Boolean(picked || fields.from.value || fields.to.value))
  for (const el of [fields.from, fields.to]) el.addEventListener('change', () => (add.dataset.dirty = dirty()))
  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    const problem = picked ? vacationProblem(fields.from.value, fields.to.value, today) : 'vacation.error.member'
    if (problem) {
      status.className = 'small error'
      status.textContent = t(problem, { max: maxVacationDays })
      return
    }
    add.disabled = true
    status.className = 'small muted'
    status.textContent = t('settings.saving')
    try {
      await api.setGuildVacation(g.discord_guild_id, picked!.id, fields.from.value, fields.to.value)
      reload()
    } catch (err) {
      add.disabled = false
      failed(err)
    }
  })

  return [
    h('h2', { id: 'guild-vacation-title' }, t('vacation.title')),
    h('p', { class: 'muted small' }, t('vacation.admin.help')),
    v.vacations.length ? h('ul', { class: 'grant-list vacation-list' }, ...v.vacations.map(row)) : h('p', { class: 'muted small' }, t('vacation.none')),
    form,
  ]
}
