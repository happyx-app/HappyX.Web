// Personal data (GDPR): the user's own data page, and the server export on the settings page.

import * as api from './api'
import { h } from './dom'
import * as icons from './icons'
import { t, type Key } from './i18n'

// confirmedUser tells whether what the user typed is their username, ignoring surrounding spaces.
export const confirmedUser = (u: api.User, typed: string) => typed.trim() !== '' && typed.trim() === u.username.trim()

function downloadButton(label: string, run: () => Promise<void>, onLoggedOut: () => void) {
  const status = h('p', { class: 'small', role: 'status' })
  const btn = h('button', { class: 'btn btn-primary', type: 'button' }, icons.inline(icons.download), label)
  btn.addEventListener('click', async () => {
    btn.disabled = true
    status.className = 'small muted'
    status.textContent = t('privacy.preparing')
    try {
      await run()
      status.className = 'small success'
      status.replaceChildren(icons.inline(icons.check), t('privacy.downloaded'))
    } catch (err) {
      if (err instanceof api.Unauthorized) return onLoggedOut()
      status.className = 'small error'
      status.textContent = t('error.generic')
    }
    btn.disabled = false
  })
  return h('div', { class: 'form-actions' }, btn, status)
}

const bullets = (keys: Key[]) => h('ul', { class: 'danger-list small' }, ...keys.map((k) => h('li', {}, t(k))))

// privacyPage is the user's own data: what HappyX keeps, a download, and erasing it.
export function privacyPage(m: api.Me, onErased: () => void, onLoggedOut: () => void): HTMLElement[] {
  const kept = h(
    'section',
    { class: 'card' },
    h('h2', {}, t('privacy.kept.title')),
    h('p', { class: 'secondary small' }, t('privacy.kept.body')),
    bullets(['privacy.kept.moods', 'privacy.kept.kudos', 'privacy.kept.game', 'privacy.kept.member']),
    h('p', { class: 'muted small' }, `🔒 ${t('privacy.kept.not')}`),
  )

  const download = h(
    'section',
    { class: 'card' },
    h('h2', {}, t('privacy.download.title')),
    h('p', { class: 'secondary small' }, t('privacy.download.body')),
    downloadButton(t('privacy.download.button'), api.downloadMyData, onLoggedOut),
  )

  const input = h('input', { id: 'confirm-user', autocomplete: 'off', spellcheck: 'false' })
  const status = h('p', { class: 'small', role: 'status' })
  const erase = h('button', { class: 'btn btn-danger', type: 'submit', disabled: true }, t('privacy.erase.confirm'))
  const cancel = h('button', { class: 'btn btn-ghost', type: 'button' }, t('danger.cancel'))
  const open = h('button', { class: 'btn btn-danger-outline', type: 'button' }, t('privacy.erase.open'))
  const [before, after] = t('danger.type', { name: '\u0000' }).split('\u0000')
  const confirm = h(
    'form',
    { class: 'danger-confirm', hidden: true },
    h('p', { class: 'small' }, t('privacy.erase.lose')),
    bullets(['privacy.erase.moods', 'privacy.erase.kudos', 'privacy.erase.game']),
    h('p', { class: 'small' }, `⏸️ ${t('privacy.erase.paused')}`),
    m.guilds.some((g) => g.active) ? h('p', { class: 'warning small' }, `⚠️ ${t('privacy.erase.admin')}`) : null,
    h('div', { class: 'field' }, h('label', { for: 'confirm-user' }, before, h('strong', {}, m.user.username), after), input),
    h('div', { class: 'form-actions' }, erase, cancel, status),
  )
  input.addEventListener('input', () => {
    erase.disabled = !confirmedUser(m.user, input.value)
  })
  open.addEventListener('click', () => {
    open.hidden = true
    confirm.hidden = false
    input.focus()
  })
  cancel.addEventListener('click', () => {
    input.value = ''
    erase.disabled = true
    status.textContent = ''
    confirm.hidden = true
    open.hidden = false
  })
  confirm.addEventListener('submit', async (e) => {
    e.preventDefault()
    if (!confirmedUser(m.user, input.value)) return
    erase.disabled = cancel.disabled = input.disabled = true
    status.className = 'small muted'
    status.textContent = t('privacy.erase.erasing')
    try {
      await api.eraseMyData(input.value.trim())
      onErased()
    } catch (err) {
      if (err instanceof api.Unauthorized) return onLoggedOut()
      status.className = 'small error'
      status.textContent = t('error.generic')
      erase.disabled = cancel.disabled = input.disabled = false
    }
  })
  const danger = h(
    'section',
    { class: 'card danger', 'aria-labelledby': 'erase-title' },
    h('h2', { id: 'erase-title' }, t('privacy.erase.title')),
    h('p', { class: 'muted small' }, t('privacy.erase.help')),
    h('div', {}, open),
    confirm,
  )

  return [kept, download, danger, h('p', { class: 'muted small' }, `🗄️ ${t('privacy.backups')}`)]
}

// guildExport is the settings page's card to download the server's data.
export function guildExport(g: api.Guild, onLoggedOut: () => void): HTMLElement {
  return h(
    'section',
    { class: 'card export' },
    h('h2', {}, t('export.title')),
    h('p', { class: 'secondary small' }, t('export.body')),
    bullets(['export.has.moods', 'export.has.members', 'export.has.kudos', 'export.has.game']),
    h('p', { class: 'muted small' }, icons.inline(icons.lock), t(g.anonymous ? 'export.anonymous' : 'export.named')),
    downloadButton(t('export.button'), () => api.downloadGuildData(g.discord_guild_id), onLoggedOut),
  )
}
