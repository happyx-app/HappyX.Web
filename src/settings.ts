// Server settings form: the same options as the bot's /happyx config, except who receives the
// reports, which stays in Discord.

import * as api from './api'
import { h } from './dom'
import { t } from './i18n'

// Languages the bot speaks (HappyX.Bot internal/i18n/locales), named in their own language.
export const botLanguages: [code: string, name: string][] = [
  ['ca', 'Català'],
  ['de', 'Deutsch'],
  ['en', 'English'],
  ['es', 'Español'],
  ['fr', 'Français'],
  ['it', 'Italiano'],
  ['pt-BR', 'Português (Brasil)'],
]

export type Settings = Required<api.SettingsPatch>

export const settingsOf = (g: api.Guild): Settings => ({
  anonymous: g.anonymous,
  timezone: g.timezone,
  language: g.language,
  survey_hour: g.survey_hour,
  report_frequency: g.report_frequency,
})

// changes returns only the fields that differ, so a save never rewrites what didn't change.
export function changes(before: Settings, after: Settings): api.SettingsPatch {
  const out: api.SettingsPatch = {}
  for (const k of Object.keys(after) as (keyof Settings)[]) {
    if (after[k] !== before[k]) (out as Record<string, unknown>)[k] = after[k]
  }
  return out
}

export function timezones(): string[] {
  try {
    return Intl.supportedValuesOf('timeZone')
  } catch {
    return []
  }
}

export function settingsForm(g: api.Guild, onSaved: (g: api.Guild) => void, onLoggedOut: () => void): HTMLElement {
  let saved = settingsOf(g)
  const disabled = !g.active

  const language = h('select', { id: 'language', disabled }, ...botLanguages.map(([code, name]) => h('option', { value: code, selected: code === saved.language }, name)))
  if (!botLanguages.some(([code]) => code === saved.language)) language.append(h('option', { value: saved.language, selected: true }, saved.language))

  const hour = h(
    'select',
    { id: 'hour', disabled },
    ...Array.from({ length: 24 }, (_, i) => h('option', { value: i, selected: i === saved.survey_hour }, `${String(i).padStart(2, '0')}:00`)),
  )

  const zones = timezones()
  const tz = h('input', { id: 'timezone', list: 'timezones', value: saved.timezone, autocomplete: 'off', spellcheck: 'false', disabled })
  const tzList = h('datalist', { id: 'timezones' }, ...zones.map((z) => h('option', { value: z })))

  const freq = (['weekly', 'monthly'] as const).map((f) =>
    h('label', { class: 'radio' }, h('input', { type: 'radio', name: 'frequency', value: f, checked: f === saved.report_frequency, disabled }), t(`guilds.${f}`)),
  )

  const anon = h('input', { id: 'anonymous', type: 'checkbox', role: 'switch', checked: saved.anonymous, disabled })
  const anonWarning = h('p', { class: 'warning small', hidden: true }, `⚠️ ${t('settings.anonymous.off')}`)

  const status = h('p', { class: 'small', role: 'status' })
  const save = h('button', { class: 'btn btn-primary', type: 'submit', disabled: true }, t('settings.save'))

  const read = (): Settings => ({
    language: language.value,
    survey_hour: Number(hour.value),
    timezone: tz.value.trim(),
    report_frequency: (freq.map((l) => l.querySelector('input')!).find((i) => i.checked)?.value ?? saved.report_frequency) as Settings['report_frequency'],
    anonymous: anon.checked,
  })
  const refresh = () => {
    const now = read()
    const dirty = Object.keys(changes(saved, now)).length > 0
    const tzValid = zones.length === 0 || zones.includes(now.timezone) || now.timezone === saved.timezone
    tz.setCustomValidity(tzValid ? '' : t('settings.timezone.invalid'))
    save.disabled = disabled || !dirty || !tzValid
    anonWarning.hidden = now.anonymous || saved.anonymous === false
    if (dirty) status.textContent = ''
  }

  const form = h(
    'form',
    { class: 'card settings', novalidate: true },
    h('h2', {}, t('settings.title')),
    disabled ? h('p', { class: 'warning small' }, t('settings.inactive')) : null,
    field('language', t('settings.language'), t('settings.language.help'), language),
    h('div', { class: 'field-row' },
      field('hour', t('settings.hour'), t('settings.hour.help'), hour),
      field('timezone', t('settings.timezone'), t('settings.timezone.help'), h('div', {}, tz, tzList)),
    ),
    h('fieldset', { class: 'field' }, h('legend', {}, t('settings.frequency')), h('div', { class: 'radios' }, ...freq), h('p', { class: 'muted small' }, t('settings.frequency.help'))),
    h(
      'div',
      { class: 'field' },
      h('label', { class: 'switch', for: 'anonymous' }, anon, h('span', {}, t('settings.anonymous'))),
      h('p', { class: 'muted small' }, t('settings.anonymous.help')),
      anonWarning,
    ),
    h('p', { class: 'muted small' }, `ℹ️ ${t('settings.admin.help')}`),
    h('div', { class: 'form-actions' }, save, status),
  )
  form.addEventListener('input', refresh)
  form.addEventListener('change', refresh)
  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    const patch = changes(saved, read())
    if (Object.keys(patch).length === 0) return
    save.disabled = true
    status.className = 'small muted'
    status.textContent = t('settings.saving')
    try {
      const updated = await api.updateSettings(g.discord_guild_id, patch)
      saved = settingsOf(updated)
      status.className = 'small success'
      status.textContent = `✓ ${t('settings.saved')}`
      onSaved(updated)
    } catch (err) {
      if (err instanceof api.Unauthorized) return onLoggedOut()
      status.className = 'small error'
      status.textContent = err instanceof api.ApiError && err.status === 400 ? `${t('settings.error')}: ${err.message}` : t('error.generic')
    }
    refresh()
  })
  return form
}

function field(id: string, label: string, help: string, control: HTMLElement) {
  return h('div', { class: 'field' }, h('label', { for: id }, label), control, h('p', { class: 'muted small' }, help))
}
