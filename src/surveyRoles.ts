// Role filters: who gets the survey («Who gets the survey» card) and who plays «Who's who?»
// (under the game switch in the settings form). Each is everyone, everyone except some Discord
// roles (e.g. external collaborators), or only some roles. Roles are picked from the server's,
// never typed freely.

import * as api from './api'
import { combobox, type Option, optionChip } from './access'
import { h } from './dom'
import { showSaveError } from './errors'
import * as icons from './icons'
import { t } from './i18n'

export const filterModes: api.RoleFilterMode[] = ['all', 'except', 'only']

export const everyone = (): api.RoleFilter => ({ mode: 'all', role_ids: [] })

// filterOf reads a stored filter, leaving out roles deleted in Discord since.
export function filterOf(f: api.RoleFilter | undefined, roles?: api.Role[]): api.RoleFilter {
  const r = f ?? everyone()
  const known = roles ? new Set(roles.map((x) => x.id)) : null
  return { mode: r.mode, role_ids: (r.role_ids ?? []).filter((id) => !known || known.has(id)) }
}

export const surveyRolesOf = (g: api.Guild, roles?: api.Role[]) => filterOf(g.survey_roles, roles)

// toSave is what the API stores: with everyone, no roles, however many were picked before.
export const toSave = (s: api.RoleFilter): api.RoleFilter => (s.mode === 'all' ? everyone() : { mode: s.mode, role_ids: [...s.role_ids] })

export const sameSurveyRoles = (a: api.RoleFilter, b: api.RoleFilter) => JSON.stringify(toSave(a)) === JSON.stringify(toSave(b))

// needsRoles tells when the choice can't be saved yet: "except" and "only" need at least one role.
export const needsRoles = (s: api.RoleFilter) => s.mode !== 'all' && s.role_ids.length === 0

// texts names the i18n keys of one filter: surveyRoles.* or gameRoles.*.
type Texts = 'surveyRoles' | 'gameRoles'

export interface RoleFilterEditor {
  el: HTMLElement
  value: () => api.RoleFilter
  reset: (f: api.RoleFilter) => void
}

// roleFilterEditor shows the three choices and, for "except" and "only", the picked roles with a
// search box to add more. onChange runs after every change.
export function roleFilterEditor(id: string, texts: Texts, initial: api.RoleFilter, roles: api.Role[], onChange: () => void): RoleFilterEditor {
  const options: Option[] = roles.map((r) => ({ kind: 'role', id: r.id, label: r.name, color: r.color }))
  const byID = new Map(options.map((o) => [o.id, o]))
  const state: api.RoleFilter = { mode: initial.mode, role_ids: [...initial.role_ids] }

  const radios = filterModes.map((m) => {
    const input = h('input', { type: 'radio', name: `${id}-mode`, value: m, checked: m === state.mode })
    input.addEventListener('change', () => {
      state.mode = m
      refresh()
    })
    return h('label', { class: 'radio' }, input, t(`${texts}.mode.${m}`))
  })
  const rows = h('ul', { class: 'grant-list' })
  const missing = h('p', { class: 'error small', hidden: true })
  const legend = h('legend', {})
  const help = h('p', { class: 'muted small' })
  const picker = combobox({
    id: `${id}-add`,
    label: t('surveyRoles.add'),
    placeholder: t('surveyRoles.add.placeholder'),
    options: () => options,
    exclude: () => new Set(state.role_ids.map((r) => `role:${r}`)),
    noMatch: t('surveyRoles.noMatch'),
    onPick: (o) => {
      state.role_ids.push(o.id)
      refresh()
    },
  })
  const rolesField = h('fieldset', { class: 'field' }, legend, help, rows, missing, h('label', { class: 'sr-only', for: `${id}-add` }, t('surveyRoles.add')), picker)

  const roleRow = (roleID: string, i: number) => {
    const o = byID.get(roleID)!
    const remove = h('button', { class: 'btn btn-ghost btn-icon', type: 'button', 'aria-label': t('access.remove', { name: o.label }), title: t('access.remove', { name: o.label }) }, icons.x())
    remove.addEventListener('click', () => {
      state.role_ids.splice(i, 1)
      refresh()
    })
    return h('li', { class: 'grant' }, optionChip(o), remove)
  }

  const refresh = () => {
    radios.forEach((l) => {
      const input = l.querySelector('input')!
      input.checked = input.value === state.mode
    })
    rolesField.hidden = state.mode === 'all' || options.length === 0
    if (state.mode !== 'all') {
      legend.textContent = t(`${texts}.roles.${state.mode}`)
      help.textContent = t(`${texts}.roles.${state.mode}.help`)
      missing.textContent = t(`${texts}.missing.${state.mode}`)
    }
    missing.hidden = !needsRoles(state)
    rows.replaceChildren(...state.role_ids.map(roleRow))
    onChange()
  }

  const el = h(
    'div',
    { class: 'role-filter' },
    h('fieldset', { class: 'field' }, h('legend', { class: 'sr-only' }, t(`${texts}.title`)), h('div', { class: 'radios stacked' }, ...radios)),
    options.length === 0 ? h('p', { class: 'muted small' }, icons.inline(icons.info), t('access.noRoles')) : null,
    rolesField,
  )
  queueMicrotask(refresh)
  return {
    el,
    value: () => ({ mode: state.mode, role_ids: [...state.role_ids] }),
    reset: (f) => {
      state.mode = f.mode
      state.role_ids = [...f.role_ids]
      refresh()
    },
  }
}

export function surveyRolesCard(g: api.Guild, onSaved: (g: api.Guild) => void, onLoggedOut: () => void): HTMLElement {
  const card = h('section', { class: 'card settings survey-roles', 'aria-labelledby': 'survey-roles-title', 'aria-busy': 'true' },
    h('h2', { id: 'survey-roles-title' }, t('surveyRoles.title')),
    h('p', { class: 'muted small' }, t('access.loading')),
  )
  api.roles(g.discord_guild_id).then(
    (roles) => {
      card.removeAttribute('aria-busy')
      card.replaceChildren(...surveyRolesForm(g, roles, onSaved, onLoggedOut))
    },
    (err) => {
      if (err instanceof api.Unauthorized) return onLoggedOut()
      card.removeAttribute('aria-busy')
      card.replaceChildren(h('h2', { id: 'survey-roles-title' }, t('surveyRoles.title')), h('p', { class: 'error small' }, t('error.generic')))
    },
  )
  return card
}

function surveyRolesForm(g: api.Guild, roles: api.Role[], onSaved: (g: api.Guild) => void, onLoggedOut: () => void): HTMLElement[] {
  let saved = surveyRolesOf(g, roles)
  const status = h('p', { class: 'small', role: 'status' })
  const save = h('button', { class: 'btn btn-primary', type: 'submit', disabled: true }, t('settings.save'))
  const editor = roleFilterEditor('survey-roles', 'surveyRoles', saved, roles, () => {
    const now = editor.value()
    const dirty = !sameSurveyRoles(saved, now)
    save.disabled = !dirty || needsRoles(now)
    if (dirty) status.textContent = ''
  })

  const form = h(
    'form',
    { class: 'survey-roles-form', novalidate: true },
    editor.el,
    h('p', { class: 'muted small' }, icons.inline(icons.info), t('surveyRoles.note')),
    h('div', { class: 'form-actions' }, save, status),
  )
  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    const now = editor.value()
    if (needsRoles(now)) return
    save.disabled = true
    status.className = 'small muted'
    status.textContent = t('settings.saving')
    try {
      const updated = await api.updateSettings(g.discord_guild_id, { survey_roles: toSave(now) })
      saved = surveyRolesOf(updated, roles)
      if (now.mode !== 'all') editor.reset(saved)
      status.className = 'small success'
      status.replaceChildren(icons.inline(icons.check), t('settings.saved'))
      onSaved(updated)
    } catch (err) {
      if (err instanceof api.Unauthorized) return onLoggedOut()
      showSaveError(status, err)
      save.disabled = false
    }
  })
  return [h('h2', { id: 'survey-roles-title' }, t('surveyRoles.title')), h('p', { class: 'muted small' }, t('surveyRoles.help')), form]
}
