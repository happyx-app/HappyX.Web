// "Who gets the survey": everyone, everyone except some Discord roles (e.g. external
// collaborators), or only some roles. Roles are picked from the server's, never typed freely.

import * as api from './api'
import { combobox, type Option, optionChip, optionKey } from './access'
import { h } from './dom'
import * as icons from './icons'
import { t } from './i18n'

export const surveyModes: api.SurveyRolesMode[] = ['all', 'except', 'only']

// surveyRolesOf reads the server's choice, leaving out roles deleted in Discord since.
export function surveyRolesOf(g: api.Guild, roles?: api.Role[]): api.SurveyRoles {
  const r = g.survey_roles ?? { mode: 'all', role_ids: [] }
  const known = roles ? new Set(roles.map((x) => x.id)) : null
  return { mode: r.mode, role_ids: (r.role_ids ?? []).filter((id) => !known || known.has(id)) }
}

// toSave is what the API stores: with everyone, no roles, however many were picked before.
export const toSave = (s: api.SurveyRoles): api.SurveyRoles => (s.mode === 'all' ? { mode: 'all', role_ids: [] } : { mode: s.mode, role_ids: [...s.role_ids] })

export const sameSurveyRoles = (a: api.SurveyRoles, b: api.SurveyRoles) => JSON.stringify(toSave(a)) === JSON.stringify(toSave(b))

// needsRoles tells when the choice can't be saved yet: "except" and "only" need at least one role.
export const needsRoles = (s: api.SurveyRoles) => s.mode !== 'all' && s.role_ids.length === 0

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
  const options: Option[] = roles.map((r) => ({ kind: 'role', id: r.id, label: r.name, color: r.color }))
  const byID = new Map(options.map((o) => [o.id, o]))
  let saved = surveyRolesOf(g, roles)
  const state: api.SurveyRoles = { mode: saved.mode, role_ids: [...saved.role_ids] }

  const status = h('p', { class: 'small', role: 'status' })
  const save = h('button', { class: 'btn btn-primary', type: 'submit', disabled: true }, t('settings.save'))
  const radios = surveyModes.map((m) =>
    h('label', { class: 'radio' }, h('input', { type: 'radio', name: 'survey-roles-mode', value: m, checked: m === state.mode }), t(`surveyRoles.mode.${m}`)),
  )
  const rows = h('ul', { class: 'grant-list' })
  const missing = h('p', { class: 'error small', hidden: true })
  const legend = h('legend', {})
  const help = h('p', { class: 'muted small' })
  const picker = combobox({
    id: 'survey-role-add',
    label: t('surveyRoles.add'),
    placeholder: t('surveyRoles.add.placeholder'),
    options: () => options,
    exclude: () => new Set(state.role_ids.map((id) => `role:${id}`)),
    noMatch: t('surveyRoles.noMatch'),
    onPick: (o) => {
      state.role_ids.push(o.id)
      refresh()
    },
  })
  const rolesField = h('fieldset', { class: 'field' },
    legend, help, rows, missing,
    h('label', { class: 'sr-only', for: 'survey-role-add' }, t('surveyRoles.add')),
    picker,
  )

  const roleRow = (id: string, i: number) => {
    const o = byID.get(id)!
    const remove = h('button', { class: 'btn btn-ghost btn-icon', type: 'button', 'aria-label': t('access.remove', { name: o.label }), title: t('access.remove', { name: o.label }) }, icons.x())
    remove.addEventListener('click', () => {
      state.role_ids.splice(i, 1)
      refresh()
    })
    return h('li', { class: 'grant', 'data-key': optionKey(o) }, optionChip(o), remove)
  }

  const refresh = () => {
    state.mode = (radios.map((l) => l.querySelector('input')!).find((i) => i.checked)?.value ?? state.mode) as api.SurveyRolesMode
    rolesField.hidden = state.mode === 'all' || options.length === 0
    if (state.mode !== 'all') {
      legend.textContent = t(`surveyRoles.roles.${state.mode}`)
      help.textContent = t(`surveyRoles.roles.${state.mode}.help`)
      missing.textContent = t(`surveyRoles.missing.${state.mode}`)
    }
    missing.hidden = !needsRoles(state)
    rows.replaceChildren(...state.role_ids.map(roleRow))
    const dirty = !sameSurveyRoles(saved, state)
    save.disabled = !dirty || needsRoles(state)
    if (dirty) status.textContent = ''
  }

  const form = h(
    'form',
    { class: 'survey-roles-form', novalidate: true },
    h('fieldset', { class: 'field' },
      h('legend', { class: 'sr-only' }, t('surveyRoles.title')),
      h('div', { class: 'radios stacked' }, ...radios),
    ),
    options.length === 0 ? h('p', { class: 'muted small' }, icons.inline(icons.info), t('access.noRoles')) : null,
    rolesField,
    h('p', { class: 'muted small' }, icons.inline(icons.info), t('surveyRoles.note')),
    h('div', { class: 'form-actions' }, save, status),
  )
  form.addEventListener('change', refresh)
  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    if (needsRoles(state)) return
    save.disabled = true
    status.className = 'small muted'
    status.textContent = t('settings.saving')
    try {
      const updated = await api.updateSettings(g.discord_guild_id, { survey_roles: toSave(state) })
      saved = surveyRolesOf(updated, roles)
      state.role_ids = state.mode === 'all' ? state.role_ids : [...saved.role_ids]
      status.className = 'small success'
      status.replaceChildren(icons.inline(icons.check), t('settings.saved'))
      onSaved(updated)
    } catch (err) {
      if (err instanceof api.Unauthorized) return onLoggedOut()
      status.className = 'small error'
      status.textContent = err instanceof api.ApiError && err.status === 400 ? `${t('settings.error')}: ${err.message}` : t('error.generic')
    }
    refresh()
  })
  refresh()
  return [h('h2', { id: 'survey-roles-title' }, t('surveyRoles.title')), h('p', { class: 'muted small' }, t('surveyRoles.help')), form]
}
