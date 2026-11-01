// «Who's who?»: this week's round (answer Monday to Wednesday, guess Thursday to Sunday) and
// last week's results. Answers come without names until the round is finished; the API never
// sends them earlier, so nothing here can leak an author.

import * as api from './api'
import { h } from './dom'
import * as icons from './icons'
import { showSaveError } from './errors'
import { formatDay, formatNumber, t } from './i18n'

export const maxAnswer = 200
export const maxProposal = 200

const steps = ['answering', 'guessing', 'finished'] as const

// dayBefore('2026-10-22') is '2026-10-21', for "answer until Wednesday".
export function dayBefore(day: string): string {
  const d = new Date(`${day}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}

export const medal = (place: number) => ['🥇', '🥈', '🥉'][place] ?? `${place + 1}.`

// places gives tied scores the same place: [3, 3, 1] -> [0, 0, 2].
export function places(ranking: api.GameScore[]): number[] {
  return ranking.map((s, i) => {
    let p = i
    while (p > 0 && ranking[p - 1].correct === s.correct && ranking[p - 1].guesses === s.guesses) p--
    return p
  })
}

const longDay = (day: string) => formatDay(day, { weekday: 'long', day: 'numeric', month: 'long' })

export function gamePage(board: api.GameBoard, onLoggedOut: () => void): HTMLElement[] {
  const cur = board.current
  const out: HTMLElement[] = []
  if (cur) out.push(stepper(cur.phase))
  out.push(h('p', { class: 'privacy-note' }, icons.eye(), t('game.privacy')))
  if (!cur) out.push(h('section', { class: 'card empty' }, h('span', { class: 'game-big', 'aria-hidden': 'true' }, '🎲'), h('p', { class: 'secondary' }, t('game.none'))))
  else if (cur.phase === 'answering') out.push(answerCard(board.discord_guild_id, cur, onLoggedOut))
  else out.push(guessCard(board.discord_guild_id, cur, onLoggedOut))
  if (board.proposal?.open) out.push(proposalCard(board.discord_guild_id, board.proposal, onLoggedOut))
  if (board.previous) out.push(resultsCard(board.previous))
  return out
}

function stepper(phase: api.GamePhase) {
  const at = steps.indexOf(phase)
  const names = ['answer', 'guess', 'results'] as const
  return h(
    'ol',
    { class: 'steps', 'aria-label': t('game.title') },
    ...names.map((n, i) =>
      h(
        'li',
        { class: i === at ? 'step step-on' : i < at ? 'step step-done' : 'step', 'aria-current': i === at ? 'step' : undefined },
        h('span', { class: 'step-num', 'aria-hidden': 'true' }, i < at ? '✓' : String(i + 1)),
        h('span', {}, h('strong', {}, t(`game.step.${n}`)), h('span', { class: 'muted small' }, t(`game.step.${n}.when`))),
      ),
    ),
  )
}

function question(r: api.GameRound) {
  return h('div', { class: 'game-question' }, h('span', { class: 'muted small' }, t('game.thisWeek')), h('h2', {}, r.question), proposedLine(r))
}

// proposedLine says the question came from the team: the proposer learns it is theirs, everyone
// else finds out who once the round is over.
export function proposedLine(r: api.GameRound) {
  if (r.proposed_by) return h('p', { class: 'muted small' }, `💡 ${r.my_question ? t('game.proposedBy.you') : t('game.proposedBy', { name: r.proposed_by.username })}`)
  if (r.my_question) return h('p', { class: 'small success' }, `💡 ${t('game.myQuestion')}`)
  if (r.proposed) return h('p', { class: 'muted small' }, `💡 ${t('game.proposed')}`)
  return null
}

function proposalCard(guildID: string, p: api.GameProposal, onLoggedOut: () => void) {
  let saved = p.mine
  const input = h('textarea', { id: 'game-proposal', maxlength: maxProposal, rows: 2, placeholder: t('game.propose.placeholder') })
  input.value = saved
  const counter = h('span', { class: 'muted small counter' })
  const save = h('button', { class: 'btn', type: 'submit' }, t(saved ? 'game.propose.update' : 'game.propose.save'))
  const status = h('p', { class: saved ? 'small success' : 'small muted', role: 'status' }, saved ? `✓ ${t('game.propose.saved')}` : '')
  const count = h('p', { class: 'muted small' }, proposalCount(p.count))
  const refresh = () => {
    counter.textContent = `${input.value.length}/${maxProposal}`
    save.disabled = input.value.trim() === '' || input.value.trim() === saved
  }
  const form = h(
    'form',
    { class: 'card game-card', novalidate: true },
    h('div', { class: 'game-question' }, h('span', { class: 'muted small' }, t('game.propose.kicker')), h('h2', {}, `💡 ${t('game.propose.title')}`)),
    h('p', { class: 'secondary small' }, t('game.propose.body')),
    h('label', { for: 'game-proposal', class: 'field-label' }, t('game.propose.label')),
    input,
    h('div', { class: 'form-actions' }, save, counter, status),
    count,
  )
  form.addEventListener('input', refresh)
  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    save.disabled = true
    try {
      const res = await api.proposeQuestion(guildID, input.value.trim())
      if (!saved) p.count++
      saved = res.question
      input.value = saved
      save.textContent = t('game.propose.update')
      status.className = 'small success'
      status.textContent = `✓ ${t('game.propose.saved')}`
      count.textContent = proposalCount(p.count)
    } catch (err) {
      if (err instanceof api.Unauthorized) return onLoggedOut()
      showError(status, err)
    }
    refresh()
  })
  refresh()
  return form
}

export const proposalCount = (n: number) =>
  n === 0 ? t('game.propose.count.none') : n === 1 ? t('game.propose.count.one') : t('game.propose.count', { n: formatNumber(n) })

function answerCard(guildID: string, r: api.GameRound, onLoggedOut: () => void) {
  const until = longDay(dayBefore(r.guessing_starts))
  let saved = r.my_answer
  const input = h('textarea', { id: 'game-answer', maxlength: maxAnswer, rows: 3, placeholder: t('game.answer.placeholder') })
  input.value = saved
  const counter = h('span', { class: 'muted small counter' })
  const save = h('button', { class: 'btn btn-primary', type: 'submit' }, t(saved ? 'game.answer.update' : 'game.answer.save'))
  const status = h('p', { class: 'small', role: 'status' }, saved ? `✓ ${t('game.answer.saved', { day: until })}` : t('game.answer.until', { day: until }))
  status.className = saved ? 'small success' : 'small muted'
  const count = h('p', { class: 'muted small' }, countText(r.answer_count))
  const refresh = () => {
    counter.textContent = `${input.value.length}/${maxAnswer}`
    save.disabled = input.value.trim() === '' || input.value.trim() === saved
  }
  const form = h(
    'form',
    { class: 'card game-card', novalidate: true },
    question(r),
    h('label', { for: 'game-answer', class: 'field-label' }, t('game.answer.label')),
    input,
    h('div', { class: 'form-actions' }, save, counter, status),
    count,
  )
  form.addEventListener('input', refresh)
  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    save.disabled = true
    try {
      const res = await api.answerGame(guildID, input.value.trim())
      if (!saved) r.answer_count++
      saved = res.answer
      input.value = saved
      save.textContent = t('game.answer.update')
      status.className = 'small success'
      status.textContent = `✓ ${t('game.answer.saved', { day: until })}`
      count.textContent = countText(r.answer_count)
    } catch (err) {
      if (err instanceof api.Unauthorized) return onLoggedOut()
      showError(status, err)
    }
    refresh()
  })
  refresh()
  return form
}

const countText = (n: number) => (n === 1 ? t('game.answer.count.one') : t('game.answer.count', { n: formatNumber(n) }))

function guessCard(guildID: string, r: api.GameRound, onLoggedOut: () => void) {
  if (r.answer_count < r.min_answers) {
    return h('section', { class: 'card game-card' }, question(r), h('p', { class: 'secondary' }, t('game.tooFew', { n: r.answer_count, min: r.min_answers })))
  }
  const me = r.answers.find((a) => a.mine)?.discord_user_id
  const others = r.players.filter((p) => p.discord_user_id !== me)
  const guessable = r.answers.filter((a) => !a.mine)
  const selects = new Map<string, HTMLSelectElement>()
  let saved = { ...r.my_guesses }

  const progress = h('span', { class: 'muted small' })
  const save = h('button', { class: 'btn btn-primary', type: 'submit' }, t('game.guess.save'))
  const status = h('p', { class: 'small', role: 'status' })
  const read = () => {
    const out: Record<string, string> = {}
    for (const [id, sel] of selects) if (sel.value) out[id] = sel.value
    return out
  }
  const refresh = () => {
    const now = read()
    progress.textContent = t('game.guess.progress', { n: Object.keys(now).length, total: guessable.length })
    save.disabled = JSON.stringify(Object.entries(now).sort()) === JSON.stringify(Object.entries(saved).sort())
  }

  const list = h(
    'ol',
    { class: 'guesses' },
    ...r.answers.map((a, i) => {
      if (a.mine) {
        return h('li', { class: 'guess guess-mine' }, h('span', { class: 'guess-n' }, String(i + 1)), h('p', { class: 'msg-text' }, a.answer), h('span', { class: 'badge' }, t('game.guess.yours')))
      }
      const id = `guess-${a.id}`
      const sel = h(
        'select',
        { id, 'aria-label': `${t('game.guess.pick')} ${i + 1}` },
        h('option', { value: '' }, t('game.guess.pick')),
        ...others.map((p) => h('option', { value: p.discord_user_id, selected: r.my_guesses[a.id] === p.discord_user_id }, p.username)),
      )
      selects.set(a.id, sel)
      return h('li', { class: 'guess' }, h('span', { class: 'guess-n' }, String(i + 1)), h('p', { class: 'msg-text' }, a.answer), sel)
    }),
  )
  const form = h(
    'form',
    { class: 'card game-card', novalidate: true },
    question(r),
    h('p', { class: 'secondary small' }, t('game.guess.intro', { day: longDay(r.last_day) })),
    list,
    h('div', { class: 'form-actions' }, save, progress, status),
  )
  form.addEventListener('change', () => {
    status.textContent = ''
    refresh()
  })
  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    const guesses = read()
    save.disabled = true
    try {
      await api.guessGame(guildID, guesses)
      saved = guesses
      status.className = 'small success'
      status.textContent = `✓ ${t('game.guess.saved')}`
    } catch (err) {
      if (err instanceof api.Unauthorized) return onLoggedOut()
      showError(status, err)
    }
    refresh()
  })
  refresh()
  return form
}

function resultsCard(r: api.GameRound) {
  const head = h('div', { class: 'game-question' }, h('span', { class: 'muted small' }, `${t('game.results')} · ${formatDay(r.week)}–${formatDay(r.last_day)}`), h('h2', {}, r.question), proposedLine(r))
  if (r.answer_count < r.min_answers) {
    return h('section', { class: 'card game-card' }, head, h('p', { class: 'secondary' }, t('game.tooFew', { n: r.answer_count, min: r.min_answers })))
  }
  const pl = places(r.ranking)
  const ranking = r.ranking.length
    ? h(
        'ol',
        { class: 'ranking' },
        ...r.ranking.map((s, i) =>
          h(
            'li',
            { class: pl[i] === 0 ? 'rank rank-top' : 'rank' },
            pl[i] < 3 ? h('span', { class: 'rank-medal', 'aria-hidden': 'true' }, medal(pl[i])) : h('span', { class: 'rank-num' }, medal(pl[i])),
            h('strong', {}, s.username),
            h('span', { class: 'muted small' }, t('game.ranking.score', { correct: s.correct, guesses: s.guesses })),
          ),
        ),
      )
    : h('p', { class: 'muted small' }, t('game.ranking.empty'))
  const reveal = h(
    'ul',
    { class: 'reveal' },
    ...r.answers.map((a) => {
      const guess = r.my_guesses[a.id]
      const mine = guess === undefined ? null : guess === a.discord_user_id
        ? h('span', { class: 'pill pill-right' }, `✓ ${t('game.yourGuess.right')}`)
        : h('span', { class: 'pill pill-wrong' }, `✗ ${t('game.yourGuess.wrong', { name: r.answers.find((x) => x.discord_user_id === guess)?.username ?? '?' })}`)
      const right = a.right ?? 0
      return h(
        'li',
        {},
        h('p', { class: 'msg-text' }, a.answer),
        h(
          'div',
          { class: 'reveal-meta' },
          h('strong', {}, a.mine ? `${a.username} (${t('game.you')})` : a.username ?? ''),
          h('span', { class: 'muted small' }, right === 0 ? t('game.right.none') : right === 1 ? t('game.right.one') : t('game.right', { n: right })),
          mine,
        ),
      )
    }),
  )
  return h(
    'section',
    { class: 'card game-card' },
    head,
    h('div', { class: 'grid-results' }, h('div', {}, h('h3', {}, t('game.ranking')), ranking), h('div', {}, h('h3', {}, t('game.reveal')), reveal)),
  )
}

function showError(status: HTMLElement, err: unknown) {
  if (err instanceof api.DemoReadOnly) return showSaveError(status, err)
  status.className = 'small error'
  if (err instanceof api.ApiError && err.status === 409) status.textContent = t('game.closed')
  else if (err instanceof api.ApiError && err.status === 400) status.textContent = `${t('settings.error')}: ${err.message}`
  else status.textContent = t('error.generic')
}
