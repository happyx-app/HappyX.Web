// "Admins and permissions": the main admin, who receives the reports, and the users or Discord
// roles with extra access. Everything is picked from the server's members and roles, never typed
// freely.

import * as api from './api'
import { h } from './dom'
import { t } from './i18n'

export interface Option {
  kind: 'user' | 'role'
  id: string
  label: string
  color?: number
}

export const optionKey = (o: { kind: string; id: string }) => `${o.kind}:${o.id}`

// fold lowercases and drops accents, so "jose" finds "José".
const fold = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

export const matches = (query: string, label: string) => fold(label).includes(fold(query.trim()))

// filterOptions keeps the options whose name contains the query, leaving out those in exclude.
export function filterOptions(options: Option[], query: string, exclude: Set<string> = new Set()): Option[] {
  return options.filter((o) => !exclude.has(optionKey(o)) && matches(query, o.label))
}

// roleColor turns Discord's RGB number into CSS; 0 is Discord's "no colour".
export const roleColor = (n: number | undefined) => (n ? `#${n.toString(16).padStart(6, '0')}` : '')

export const roleOptions = (a: api.Access): Option[] => a.roles.map((r) => ({ kind: 'role', id: r.id, label: r.name, color: r.color }))
export const memberOptions = (a: api.Access): Option[] => a.members.map((m) => ({ kind: 'user', id: m.discord_user_id, label: m.username }))

// knownGrants drops grants to people who left the server, which the API would refuse on save.
export function knownGrants(a: api.Access): { grants: api.Grant[]; dropped: number } {
  const known = new Set([...roleOptions(a), ...memberOptions(a)].map(optionKey))
  const grants = a.grants.filter((g) => known.has(optionKey(g)))
  return { grants, dropped: a.grants.length - grants.length }
}

export interface AccessState {
  admin: string
  grants: api.Grant[]
}

export const sameAccess = (a: AccessState, b: AccessState) => a.admin === b.admin && JSON.stringify(a.grants) === JSON.stringify(b.grants)

let comboCount = 0

interface ComboOptions {
  id?: string
  label: string
  placeholder: string
  options: () => Option[]
  exclude?: () => Set<string>
  // selected is the picked option's label shown in the box; without it the box clears after
  // each pick (for adding to a list).
  selected?: () => Option | undefined
  onPick: (o: Option) => void
}

// combobox is a text box that only accepts one of its options: typing filters the list, and
// leaving the box without picking puts back what was there.
export function combobox(c: ComboOptions): HTMLElement {
  const n = ++comboCount
  const listID = `combo-list-${n}`
  const input = h('input', {
    id: c.id ?? `combo-${n}`, class: 'combo-input', role: 'combobox', 'aria-autocomplete': 'list', 'aria-expanded': 'false',
    'aria-controls': listID, 'aria-label': c.label, placeholder: c.placeholder, autocomplete: 'off', spellcheck: 'false',
  })
  const list = h('ul', { id: listID, class: 'combo-list', role: 'listbox', 'aria-label': c.label, hidden: true })
  let shown: Option[] = []
  let active = -1

  const showSelected = () => {
    input.value = c.selected?.()?.label ?? ''
  }
  const close = () => {
    list.hidden = true
    input.setAttribute('aria-expanded', 'false')
    input.removeAttribute('aria-activedescendant')
    active = -1
  }
  const setActive = (i: number) => {
    active = i
    list.querySelectorAll('[role=option]').forEach((el, j) => el.setAttribute('aria-selected', String(j === i)))
    const el = list.querySelector(`#${listID}-${i}`)
    if (el) {
      input.setAttribute('aria-activedescendant', el.id)
      el.scrollIntoView({ block: 'nearest' })
    }
  }
  const pick = (o: Option) => {
    c.onPick(o)
    close()
    if (c.selected) showSelected()
    else input.value = ''
  }
  const open = () => {
    // A box showing its selection lists everything until the user types something else.
    const sel = c.selected?.()
    const query = sel && input.value === sel.label ? '' : input.value
    shown = filterOptions(c.options(), query, c.exclude?.())
    const groups: [Option['kind'], string][] = [['role', t('access.roles')], ['user', t('access.members')]]
    const items: HTMLElement[] = []
    let i = 0
    for (const [kind, title] of groups) {
      const opts = shown.filter((o) => o.kind === kind)
      if (opts.length === 0) continue
      if (shown.some((o) => o.kind !== kind)) items.push(h('li', { class: 'combo-group', role: 'presentation' }, title))
      for (const o of opts) {
        const index = i++
        items.push(
          h(
            'li',
            {
              id: `${listID}-${index}`, role: 'option', class: 'combo-option', 'aria-selected': 'false',
              onmousedown: (e: Event) => {
                e.preventDefault() // keep the focus in the box
                pick(o)
              },
            },
            optionChip(o),
          ),
        )
      }
    }
    // Keep the visual order and the keyboard order the same.
    shown = groups.flatMap(([kind]) => shown.filter((o) => o.kind === kind))
    if (items.length === 0) items.push(h('li', { class: 'combo-empty muted small', role: 'presentation' }, t('access.noMatch')))
    list.replaceChildren(...items)
    list.hidden = false
    input.setAttribute('aria-expanded', 'true')
    setActive(shown.length && query ? 0 : -1)
  }

  input.addEventListener('focus', () => {
    input.select()
    open()
  })
  input.addEventListener('click', open)
  input.addEventListener('input', open)
  input.addEventListener('blur', () => {
    close()
    if (c.selected) showSelected()
    else input.value = ''
  })
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (list.hidden) open()
      if (shown.length === 0) return
      const step = e.key === 'ArrowDown' ? 1 : -1
      setActive((active + step + shown.length) % shown.length)
    } else if (e.key === 'Enter') {
      e.preventDefault() // never submit the form from here
      if (!list.hidden && active >= 0 && shown[active]) pick(shown[active])
    } else if (e.key === 'Escape') {
      close()
      if (c.selected) showSelected()
    }
  })
  showSelected()
  return h('div', { class: 'combo' }, input, list)
}

// optionChip shows a role with its colour or a member with their initial.
export function optionChip(o: Option): HTMLElement {
  if (o.kind === 'role') {
    const dot = h('span', { class: 'role-dot', 'aria-hidden': 'true' })
    if (roleColor(o.color)) dot.style.background = roleColor(o.color)
    return h('span', { class: 'who' }, dot, h('span', { class: 'who-name' }, `@${o.label}`))
  }
  return h('span', { class: 'who' }, h('span', { class: 'member-initial', 'aria-hidden': 'true' }, o.label.slice(0, 1).toUpperCase() || '?'), h('span', { class: 'who-name' }, o.label))
}

// accessCard loads who has access and lets an owner change it. onAdminChanged runs after a save
// that handed the main admin to someone else, since the viewer may have lost access.
export function accessCard(g: api.Guild, onAdminChanged: () => void, onLoggedOut: () => void): HTMLElement {
  const card = h('section', { class: 'card settings access', 'aria-labelledby': 'access-title', 'aria-busy': 'true' },
    h('h2', { id: 'access-title' }, t('access.title')),
    h('p', { class: 'muted small' }, t('access.loading')),
  )
  api.access(g.discord_guild_id).then(
    (a) => {
      card.removeAttribute('aria-busy')
      card.replaceChildren(...accessForm(g, a, onAdminChanged, onLoggedOut))
    },
    (err) => {
      if (err instanceof api.Unauthorized) return onLoggedOut()
      card.removeAttribute('aria-busy')
      card.replaceChildren(h('h2', { id: 'access-title' }, t('access.title')), h('p', { class: 'error small' }, t('error.generic')))
    },
  )
  return card
}

function accessForm(g: api.Guild, a: api.Access, onAdminChanged: () => void, onLoggedOut: () => void): HTMLElement[] {
  const members = memberOptions(a)
  const roles = roleOptions(a)
  const byKey = new Map([...roles, ...members].map((o) => [optionKey(o), o]))
  const known = knownGrants(a)
  let saved: AccessState = { admin: a.admin_discord_user_id, grants: known.grants }
  const state: AccessState = { admin: saved.admin, grants: [...saved.grants] }

  const status = h('p', { class: 'small', role: 'status' })
  const save = h('button', { class: 'btn btn-primary', type: 'submit', disabled: true }, t('settings.save'))
  const adminWarning = h('p', { class: 'warning small', hidden: true })
  const rows = h('ul', { class: 'grant-list' })
  const empty = h('p', { class: 'muted small grant-empty' }, t('access.none'))
  const droppedNote = known.dropped ? h('p', { class: 'muted small' }, t('access.dropped', { n: known.dropped })) : null

  const refresh = () => {
    const dirty = !sameAccess(saved, state) || known.dropped > 0
    save.disabled = !dirty
    if (dirty) status.textContent = ''
    const admin = byKey.get(`user:${state.admin}`)
    adminWarning.hidden = state.admin === saved.admin
    adminWarning.textContent = `⚠️ ${t('access.adminChange', { name: admin?.label ?? '' })}`
    empty.hidden = state.grants.length > 0
    rows.replaceChildren(...state.grants.map(grantRow))
  }

  const grantRow = (gr: api.Grant, i: number) => {
    const o = byKey.get(optionKey(gr))!
    const level = h(
      'select',
      { class: 'grant-level', 'aria-label': t('access.levelFor', { name: o.label }) },
      ...(['view', 'manage'] as const).map((l) => h('option', { value: l, selected: l === gr.level }, t(`access.level.${l}`))),
    )
    level.addEventListener('change', () => {
      state.grants[i] = { ...gr, level: level.value as api.GrantLevel }
      refresh()
    })
    const remove = h('button', { class: 'btn btn-ghost btn-icon', type: 'button', 'aria-label': t('access.remove', { name: o.label }), title: t('access.remove', { name: o.label }) }, '✕')
    remove.addEventListener('click', () => {
      state.grants.splice(i, 1)
      refresh()
    })
    return h('li', { class: 'grant' }, optionChip(o), level, remove)
  }

  const adminPicker = combobox({
    id: 'main-admin',
    label: t('access.admin'),
    placeholder: t('access.admin.placeholder'),
    options: () => members,
    selected: () => byKey.get(`user:${state.admin}`),
    onPick: (o) => {
      state.admin = o.id
      // The main admin already has full access, so a grant of their own would only clutter.
      state.grants = state.grants.filter((gr) => !(gr.kind === 'user' && gr.id === o.id))
      refresh()
    },
  })
  const addPicker = combobox({
    id: 'add-grant',
    label: t('access.add'),
    placeholder: t('access.add.placeholder'),
    options: () => [...roles, ...members],
    exclude: () => new Set([`user:${state.admin}`, ...state.grants.map(optionKey)]),
    onPick: (o) => {
      state.grants.push({ kind: o.kind, id: o.id, level: 'view' })
      refresh()
    },
  })

  const form = h(
    'form',
    { class: 'access-form', novalidate: true },
    h('div', { class: 'field' },
      h('label', { for: 'main-admin' }, `👑 ${t('access.admin')}`),
      adminPicker,
      h('p', { class: 'muted small' }, t('access.admin.help')),
      adminWarning,
    ),
    h('fieldset', { class: 'field' },
      h('legend', {}, t('access.extra')),
      h('p', { class: 'muted small' }, t('access.extra.help')),
      rows,
      empty,
      droppedNote,
      h('label', { class: 'sr-only', for: 'add-grant' }, t('access.add')),
      addPicker,
      roles.length === 0 ? h('p', { class: 'muted small' }, `ℹ️ ${t('access.noRoles')}`) : null,
    ),
    h('dl', { class: 'levels small' },
      h('dt', {}, t('access.level.view')), h('dd', {}, t('access.level.view.help')),
      h('dt', {}, t('access.level.manage')), h('dd', {}, t('access.level.manage.help')),
    ),
    h('p', { class: 'muted small' }, `ℹ️ ${t('access.discordAdmins')}`),
    h('div', { class: 'form-actions' }, save, status),
  )
  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    save.disabled = true
    status.className = 'small muted'
    status.textContent = t('settings.saving')
    try {
      const updated = await api.setAccess(g.discord_guild_id, state.admin, state.grants)
      const adminChanged = updated.admin_discord_user_id !== saved.admin
      saved = { admin: updated.admin_discord_user_id, grants: updated.grants }
      state.grants = [...updated.grants]
      known.dropped = 0
      droppedNote?.remove()
      status.className = 'small success'
      status.textContent = `✓ ${t('access.saved')}`
      refresh()
      if (adminChanged) onAdminChanged()
    } catch (err) {
      if (err instanceof api.Unauthorized) return onLoggedOut()
      status.className = 'small error'
      status.textContent = err instanceof api.ApiError && err.status === 400 ? `${t('settings.error')}: ${err.message}` : t('error.generic')
      save.disabled = false
    }
  })
  refresh()
  return [h('h2', { id: 'access-title' }, t('access.title')), h('p', { class: 'muted small' }, t('access.help')), form]
}
