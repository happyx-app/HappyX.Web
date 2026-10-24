// Server settings form: the same options as the bot's /happyx config, except who receives the
// reports, which is chosen with the permissions (see access.ts).

import * as api from './api'
import { h } from './dom'
import { formatDay, t } from './i18n'
import logoURL from './logo.svg'
import * as survey from './surveyMessage'

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

// The survey message has its own card (surveyMessageCard), saved on its own.
export type Settings = Required<Omit<api.SettingsPatch, 'survey_message'>>

export const settingsOf = (g: api.Guild): Settings => ({
  anonymous: g.anonymous,
  timezone: g.timezone,
  language: g.language,
  survey_hour: g.survey_hour,
  report_frequency: g.report_frequency,
  games_enabled: g.games_enabled,
  working_days: g.working_days ?? mondayToFriday,
})

export const mondayToFriday = [1, 2, 3, 4, 5]

// weekdayName names an ISO day (1 is Monday) in the page's language.
export const weekdayName = (iso: number, width: 'short' | 'long' = 'short') =>
  formatDay(`2026-10-${18 + iso}`, { weekday: width }) // 19 October 2026 is a Monday

// changes returns only the fields that differ, so a save never rewrites what didn't change.
export function changes(before: Settings, after: Settings): api.SettingsPatch {
  const out: api.SettingsPatch = {}
  for (const k of Object.keys(after) as (keyof Settings)[]) {
    if (JSON.stringify(after[k]) !== JSON.stringify(before[k])) (out as Record<string, unknown>)[k] = after[k]
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

  const language = h('select', { id: 'language' }, ...botLanguages.map(([code, name]) => h('option', { value: code, selected: code === saved.language }, name)))
  if (!botLanguages.some(([code]) => code === saved.language)) language.append(h('option', { value: saved.language, selected: true }, saved.language))

  const hour = h(
    'select',
    { id: 'hour' },
    ...Array.from({ length: 24 }, (_, i) => h('option', { value: i, selected: i === saved.survey_hour }, `${String(i).padStart(2, '0')}:00`)),
  )

  const zones = timezones()
  const tz = h('input', { id: 'timezone', list: 'timezones', value: saved.timezone, autocomplete: 'off', spellcheck: 'false' })
  const tzList = h('datalist', { id: 'timezones' }, ...zones.map((z) => h('option', { value: z })))

  const freq = (['weekly', 'monthly'] as const).map((f) =>
    h('label', { class: 'radio' }, h('input', { type: 'radio', name: 'frequency', value: f, checked: f === saved.report_frequency }), t(`guilds.${f}`)),
  )

  const days = [1, 2, 3, 4, 5, 6, 7].map((d) =>
    h(
      'label',
      { class: 'radio day', title: weekdayName(d, 'long') },
      h('input', { type: 'checkbox', name: 'working_days', value: d, checked: saved.working_days.includes(d) }),
      weekdayName(d),
    ),
  )
  const daysError = h('p', { class: 'error small', hidden: true }, t('settings.days.none'))

  const anon = h('input', { id: 'anonymous', type: 'checkbox', role: 'switch', checked: saved.anonymous })
  const anonWarning = h('p', { class: 'warning small', hidden: true }, `⚠️ ${t('settings.anonymous.off')}`)

  const games = h('input', { id: 'games', type: 'checkbox', role: 'switch', checked: saved.games_enabled })

  const status = h('p', { class: 'small', role: 'status' })
  const save = h('button', { class: 'btn btn-primary', type: 'submit', disabled: true }, t('settings.save'))

  const read = (): Settings => ({
    language: language.value,
    survey_hour: Number(hour.value),
    timezone: tz.value.trim(),
    report_frequency: (freq.map((l) => l.querySelector('input')!).find((i) => i.checked)?.value ?? saved.report_frequency) as Settings['report_frequency'],
    anonymous: anon.checked,
    games_enabled: games.checked,
    working_days: days.map((l) => l.querySelector('input')!).filter((i) => i.checked).map((i) => Number(i.value)),
  })
  const refresh = () => {
    const now = read()
    const dirty = Object.keys(changes(saved, now)).length > 0
    const tzValid = zones.length === 0 || zones.includes(now.timezone) || now.timezone === saved.timezone
    tz.setCustomValidity(tzValid ? '' : t('settings.timezone.invalid'))
    daysError.hidden = now.working_days.length > 0
    save.disabled = !dirty || !tzValid || now.working_days.length === 0
    anonWarning.hidden = now.anonymous || saved.anonymous === false
    if (dirty) status.textContent = ''
  }

  const form = h(
    'form',
    { class: 'card settings', novalidate: true },
    h('h2', {}, t('settings.title')),
    // Short fields sit side by side when the card is wide enough.
    h('div', { class: 'field-row' },
      field('language', t('settings.language'), t('settings.language.help'), language),
      field('hour', t('settings.hour'), t('settings.hour.help'), hour),
      field('timezone', t('settings.timezone'), t('settings.timezone.help'), h('div', {}, tz, tzList)),
    ),
    h(
      'fieldset',
      { class: 'field' },
      h('legend', {}, t('settings.days')),
      h('div', { class: 'radios days' }, ...days),
      daysError,
      h('p', { class: 'muted small' }, t('settings.days.help')),
    ),
    h('fieldset', { class: 'field' }, h('legend', {}, t('settings.frequency')), h('div', { class: 'radios' }, ...freq), h('p', { class: 'muted small' }, t('settings.frequency.help'))),
    h('div', { class: 'field-row' },
      h(
        'div',
        { class: 'field' },
        h('label', { class: 'switch', for: 'anonymous' }, anon, h('span', {}, t('settings.anonymous'))),
        h('p', { class: 'muted small' }, t('settings.anonymous.help')),
        anonWarning,
      ),
      h(
        'div',
        { class: 'field' },
        h('label', { class: 'switch', for: 'games' }, games, h('span', {}, `🎲 ${t('settings.games')}`)),
        h('p', { class: 'muted small' }, t('settings.games.help')),
        h('p', { class: 'muted small' }, `👀 ${t('settings.games.privacy')}`),
      ),
    ),
    h('p', { class: 'muted small' }, `ℹ️ ${t(api.isOwner(g) ? 'settings.admin.help' : 'settings.admin.help.manage')}`),
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

// surveyMessageCard edits the admin's own survey text, with the variables to insert, the same
// checks as the API and a preview of the DM as the viewer would get it. It is saved on its own;
// the preview follows the language and anonymity picked in the settings form, saved or not.
export function surveyMessageCard(g: api.Guild, onSaved: (g: api.Guild) => void, onLoggedOut: () => void, viewer?: api.User): HTMLElement {
  let saved = g.survey_message ?? ''
  const current = () => ({
    language: (document.getElementById('language') as HTMLSelectElement | null)?.value ?? g.language,
    anonymous: (document.getElementById('anonymous') as HTMLInputElement | null)?.checked ?? g.anonymous,
  })
  const today = new Date()
  const me: survey.Recipient = { id: viewer?.discord_user_id ?? '0', name: viewer?.username ?? 'Ana', streak: 0 }
  const input = h('textarea', { id: 'survey-message', rows: 4, spellcheck: 'true' }) as HTMLTextAreaElement
  input.value = saved
  const status = h('p', { class: 'small', role: 'status' })
  const save = h('button', { class: 'btn btn-primary', type: 'submit', disabled: true }, t('settings.save'))
  const count = h('span', { class: 'muted small survey-count' })
  const problem = h('p', { class: 'error small', role: 'alert', hidden: true })
  const reset = h('button', { class: 'btn btn-ghost', type: 'button' }, `↺ ${t('survey.reset')}`)
  const previewTitle = h('p', { class: 'field-label small' })
  const content = h('div', { class: 'dc-content' })
  const b = () => survey.botStrings[current().language] ?? survey.botStrings.en

  const vars = survey.surveyVars.map((v) => {
    const chip = h('button', { class: 'chip chip-code', type: 'button' }, `{{${v.name}}}`)
    chip.addEventListener('click', () => {
      const start = input.selectionStart ?? input.value.length
      input.setRangeText(`{{${v.name}}}`, start, input.selectionEnd ?? start, 'end')
      input.focus()
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    const help = t(v.help, { date: survey.longDate(current().language, today), weekday: b().weekdays[today.getDay()] })
    return h('li', {}, chip, h('span', { class: 'muted small' }, help))
  })

  const moodRow = h('div', { class: 'dc-buttons' })
  const stopRow = h('div', { class: 'dc-buttons' })
  const preview = h(
    'div',
    { class: 'dc-preview', 'aria-live': 'polite' },
    h('img', { class: 'dc-avatar', src: logoURL, alt: '' }),
    h('div', { class: 'dc-body' }, h('div', { class: 'dc-head' }, h('strong', {}, 'HappyX'), h('span', { class: 'dc-app' }, 'APP')), content, moodRow, stopRow),
  )

  const refresh = () => {
    const text = input.value
    const p = survey.check(text)
    count.textContent = t('survey.count', { n: [...text].length, max: survey.maxSurveyMessage })
    count.classList.toggle('error', p.tooLong)
    problem.textContent = p.unclosed
      ? t('survey.unclosed')
      : p.unknown.length
        ? t('survey.unknown', { vars: p.unknown.map((v) => `{{${v}}}`).join(', ') })
        : p.tooLong
          ? t('survey.tooLong', { max: survey.maxSurveyMessage })
          : ''
    problem.hidden = problem.textContent === ''
    input.setAttribute('aria-invalid', String(!survey.isValid(p)))
    reset.hidden = text.trim() === ''
    const { language, anonymous } = current()
    input.placeholder = t('survey.placeholder', { text: survey.surveyContent('', g.name, language, true, me, today).split('\n')[0].replaceAll('**', '') })
    previewTitle.textContent = t(text.trim() === '' ? 'survey.preview.default' : 'survey.preview')
    content.replaceChildren(...survey.markdown(survey.surveyContent(text, g.name, language, anonymous, me, today), () => me.name))
    moodRow.replaceChildren(...b().moods.map((m, i) => h('span', { class: 'dc-button' }, `${survey.moodEmojis[i]} ${m}`)))
    stopRow.replaceChildren(h('span', { class: 'dc-button' }, `🔕 ${b().stop}`))
    const dirty = text.trim() !== saved
    save.disabled = !dirty || !survey.isValid(p)
    if (dirty) status.textContent = ''
  }
  reset.addEventListener('click', () => {
    input.value = ''
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })

  // The preview shows the viewer's real streak in this server once it's known.
  const day = today.toISOString().slice(0, 10)
  api
    .myMoods(day, day)
    .then((r) => {
      me.streak = r.guilds.find((x) => x.discord_guild_id === g.discord_guild_id)?.streak ?? 0
      refresh()
    })
    .catch(() => {})

  const form = h(
    'form',
    { class: 'card settings survey-message', novalidate: true, 'aria-labelledby': 'survey-title' },
    h('h2', { id: 'survey-title' }, `✏️ ${t('survey.title')}`),
    h('p', { class: 'muted small' }, t('survey.help')),
    // On a wide card the editor and its variables sit side by side; the preview keeps the full width.
    h(
      'div',
      { class: 'survey-layout' },
      h('div', { class: 'field' }, input, h('div', { class: 'survey-meta' }, problem, count), h('div', {}, reset)),
      h('div', { class: 'field' }, h('p', { class: 'field-label' }, t('survey.vars.title')), h('p', { class: 'muted small' }, t('survey.vars')), h('ul', { class: 'survey-vars' }, ...vars)),
    ),
    h('div', { class: 'field' }, previewTitle, preview, h('p', { class: 'muted small' }, `🔒 ${t('survey.always')}`)),
    h('div', { class: 'form-actions' }, save, status),
  )
  form.addEventListener('input', refresh)
  // The preview follows the language and anonymity chosen in the settings form above.
  const follow = (e: Event) => {
    if (!form.isConnected) return document.removeEventListener('change', follow)
    if (e.target instanceof HTMLElement && (e.target.id === 'language' || e.target.id === 'anonymous')) refresh()
  }
  document.addEventListener('change', follow)
  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    if (!survey.isValid(survey.check(input.value))) return
    save.disabled = true
    status.className = 'small muted'
    status.textContent = t('settings.saving')
    try {
      const updated = await api.updateSettings(g.discord_guild_id, { survey_message: input.value.trim() })
      saved = updated.survey_message ?? ''
      input.value = saved
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
  refresh()
  return form
}

function field(id: string, label: string, help: string, control: HTMLElement) {
  return h('div', { class: 'field' }, h('label', { for: id }, label), control, h('p', { class: 'muted small' }, help))
}

// confirmed tells whether what the user typed names the server, ignoring surrounding spaces.
export const confirmed = (g: api.Guild, typed: string) => typed.trim() !== '' && typed.trim() === g.name.trim()

// dangerZone offers to delete the server from HappyX. The user must open it and type the server's
// name before the delete button works.
export function dangerZone(g: api.Guild, onDeleted: () => void, onLoggedOut: () => void): HTMLElement {
  const input = h('input', { id: 'confirm-name', autocomplete: 'off', spellcheck: 'false' })
  const status = h('p', { class: 'small', role: 'status' })
  const remove = h('button', { class: 'btn btn-danger', type: 'submit', disabled: true }, t('danger.delete'))
  const cancel = h('button', { class: 'btn btn-ghost', type: 'button' }, t('danger.cancel'))
  const open = h('button', { class: 'btn btn-danger-outline', type: 'button' }, t('danger.open'))

  const name = h('strong', {}, g.name)
  const [before, after] = t('danger.type', { name: '\u0000' }).split('\u0000')
  const confirm = h(
    'form',
    { class: 'danger-confirm', hidden: true },
    h('p', { class: 'small' }, t('danger.lose')),
    h(
      'ul',
      { class: 'danger-list small' },
      ...(['danger.lose.moods', 'danger.lose.members', 'danger.lose.kudos', 'danger.lose.game', 'danger.lose.settings'] as const).map((k) => h('li', {}, t(k))),
    ),
    h('p', { class: 'small' }, `🚪 ${t('danger.bot')}`),
    h('div', { class: 'field' }, h('label', { for: 'confirm-name' }, before, name, after), input),
    h('div', { class: 'form-actions' }, remove, cancel, status),
  )
  input.addEventListener('input', () => {
    remove.disabled = !confirmed(g, input.value)
  })
  open.addEventListener('click', () => {
    open.hidden = true
    confirm.hidden = false
    input.focus()
  })
  cancel.addEventListener('click', () => {
    input.value = ''
    remove.disabled = true
    status.textContent = ''
    confirm.hidden = true
    open.hidden = false
  })
  confirm.addEventListener('submit', async (e) => {
    e.preventDefault()
    if (!confirmed(g, input.value)) return
    remove.disabled = cancel.disabled = input.disabled = true
    status.className = 'small muted'
    status.textContent = t('danger.deleting')
    try {
      await api.deleteGuild(g.discord_guild_id, input.value.trim())
      onDeleted()
    } catch (err) {
      if (err instanceof api.Unauthorized) return onLoggedOut()
      status.className = 'small error'
      status.textContent = t('error.generic')
      remove.disabled = cancel.disabled = input.disabled = false
    }
  })

  return h(
    'section',
    { class: 'card danger', 'aria-labelledby': 'danger-title' },
    h('h2', { id: 'danger-title' }, t('danger.title')),
    h('p', { class: 'muted small' }, t('danger.help')),
    h('div', {}, open),
    confirm,
  )
}
