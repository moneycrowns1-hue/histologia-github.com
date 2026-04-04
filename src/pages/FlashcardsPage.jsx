import React, { useEffect, useMemo, useState } from 'react'
import { getCards, getDecks } from '../flashcards/flashcards.js'
import { isDue, schedule } from '../flashcards/srs.js'
import { subscribeSlides } from '../slides/slides.js'
import {
  addReviewEvent,
  bumpGlobalStats,
  computeCardStats,
  getCardState,
  loadProgress,
  saveProgress,
  setCardState
} from '../flashcards/storage.js'

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export default function FlashcardsPage() {
  const [decks, setDecks] = useState(() => getDecks())
  const [cards, setCards] = useState(() => getCards())

  useEffect(() => {
    const unsub = subscribeSlides(() => {
      setDecks(getDecks())
      setCards(getCards())
    })
    return () => {
      unsub?.()
    }
  }, [])

  const [deckId, setDeckId] = useState('all')
  const [limit, setLimit] = useState(12)
  const [mode, setMode] = useState('adaptive')
  const [autoAdvance, setAutoAdvance] = useState(true)

  const [session, setSession] = useState(null)
  const [flipped, setFlipped] = useState(false)
  const [pendingAdvance, setPendingAdvance] = useState(false)
  const [lastNextLabel, setLastNextLabel] = useState('')
  const [animPhase, setAnimPhase] = useState('')

  const [progress, setProgress] = useState(() => loadProgress())
  const perf = useMemo(() => computeCardStats(progress), [progress])

  const deckCards = useMemo(() => {
    const base = deckId === 'all' ? cards : cards.filter((c) => c.deckId === deckId || c.tags?.includes(deckId))
    return base
  }, [deckId, cards])

  const dueCards = useMemo(() => {
    const due = []
    for (const c of deckCards) {
      const st = getCardState(progress, c.id)
      if (isDue(st)) due.push(c)
    }
    return due
  }, [deckCards, progress])

  function dayKey(ms) {
    const d = new Date(ms)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  function activityCountSince(days) {
    const since = Date.now() - days * 24 * 60 * 60 * 1000
    let n = 0
    for (const ev of progress.events || []) {
      if (!ev || !ev.at) continue
      if (ev.at >= since) n += 1
    }
    return n
  }

  const global = useMemo(() => progress.stats || { reviews: 0, qualitySum: 0 }, [progress])
  const avgQuality = useMemo(() => {
    const r = Number(global.reviews) || 0
    const qs = Number(global.qualitySum) || 0
    return r ? Math.round((qs / r) * 10) / 10 : 0
  }, [global])

  const activity7 = useMemo(() => activityCountSince(7), [progress])
  const activity30 = useMemo(() => activityCountSince(30), [progress])

  const streakDays = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const counts = new Map()
    for (const ev of progress.events || []) {
      const at = Number(ev?.at) || 0
      if (!at) continue
      const k = dayKey(at)
      counts.set(k, (counts.get(k) || 0) + 1)
    }

    let streak = 0
    const d = new Date(today)
    while (true) {
      const k = dayKey(d.getTime())
      const c = counts.get(k) || 0
      if (c <= 0) break
      streak += 1
      d.setDate(d.getDate() - 1)
    }
    return streak
  }, [progress])

  function cardErrorRate(cardId) {
    const s = perf.get(cardId)
    if (!s || !s.reviews) return 0
    return (s.lapses || 0) / s.reviews
  }

  function wasWrongRecently(cardId, days) {
    const since = Date.now() - days * 24 * 60 * 60 * 1000
    for (let i = (progress.events || []).length - 1; i >= 0; i--) {
      const ev = progress.events[i]
      if (!ev || ev.at < since) break
      if (ev.cardId === cardId) return Number(ev.quality) < 3
    }
    return false
  }

  function buildAdaptiveQueue(baseCards, take) {
    const rows = baseCards.map((c) => {
      const st = getCardState(progress, c.id)
      const due = isDue(st)
      const err = cardErrorRate(c.id)
      const dueAt = st.dueAt || 0
      return { c, due, err, dueAt }
    })

    rows.sort((a, b) => {
      if (a.due !== b.due) return a.due ? -1 : 1
      if (b.err !== a.err) return b.err - a.err
      return a.dueAt - b.dueAt
    })

    return rows.slice(0, take).map((r) => r.c)
  }

  function buildErrorQueue(baseCards, take) {
    const rows = baseCards.map((c) => {
      const st = getCardState(progress, c.id)
      const due = isDue(st)
      const err = cardErrorRate(c.id)
      const dueAt = st.dueAt || 0
      const wrongRecent = wasWrongRecently(c.id, 14)
      return { c, due, err, dueAt, wrongRecent }
    })

    const candidates = rows.filter((r) => r.err >= 0.25 || r.wrongRecent || r.due)
    candidates.sort((a, b) => {
      if (a.wrongRecent !== b.wrongRecent) return a.wrongRecent ? -1 : 1
      if (a.due !== b.due) return a.due ? -1 : 1
      if (b.err !== a.err) return b.err - a.err
      return a.dueAt - b.dueAt
    })

    const list = candidates.map((r) => r.c)
    if (list.length === 0) return buildAdaptiveQueue(baseCards, take)
    return list.slice(0, take)
  }

  function start() {
    const base = deckCards.length ? deckCards : cards
    const qs = (mode === 'errors' ? buildErrorQueue : buildAdaptiveQueue)(base, Math.max(1, limit))
    setSession({
      queue: qs,
      index: 0,
      correct: 0,
      wrong: 0
    })
    setFlipped(false)
    setPendingAdvance(false)
    setLastNextLabel('')
    setAnimPhase('')
  }

  function startDue() {
    const base = dueCards.length ? dueCards : deckCards.length ? deckCards : cards
    const qs = shuffle(base).slice(0, Math.max(1, limit))
    setSession({
      queue: qs,
      index: 0,
      correct: 0,
      wrong: 0
    })
    setFlipped(false)
    setPendingAdvance(false)
    setLastNextLabel('')
    setAnimPhase('')
  }

  function stop() {
    setSession(null)
    setFlipped(false)
    setPendingAdvance(false)
    setLastNextLabel('')
    setAnimPhase('')
  }

  const current = session ? session.queue[session.index] : null
  const done = session && session.index >= session.queue.length

  function nextReviewLabel(dueAt) {
    const at = Number(dueAt) || 0
    if (!at) return '—'

    const now = new Date()
    const today = new Date(now)
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const dayAfter = new Date(today)
    dayAfter.setDate(dayAfter.getDate() + 2)

    if (at < tomorrow.getTime()) return 'Hoy'
    if (at < dayAfter.getTime()) return 'Mañana'
    const days = Math.max(2, Math.round((at - today.getTime()) / (24 * 60 * 60 * 1000)))
    return `En ${days} días`
  }

  function advanceNow() {
    setSession((s) => {
      if (!s) return s
      return { ...s, index: s.index + 1 }
    })
    setFlipped(false)
    setPendingAdvance(false)
    setLastNextLabel('')
  }

  function grade(quality) {
    if (!current) return
    if (pendingAdvance) return

    const fresh = loadProgress()
    const prev = getCardState(fresh, current.id)
    const next = schedule(prev, quality)
    let updated = setCardState(fresh, current.id, next)

    updated = bumpGlobalStats(updated, quality)
    updated = addReviewEvent(updated, {
      at: Date.now(),
      cardId: current.id,
      deckId: current.deckId,
      tags: current.tags || [],
      quality
    })
    saveProgress(updated)
    setProgress(updated)

    setLastNextLabel(nextReviewLabel(next.dueAt))
    setPendingAdvance(true)

    if (autoAdvance) {
      setAnimPhase('out')
      window.setTimeout(() => {
        advanceNow()
        setAnimPhase('in')
        window.setTimeout(() => setAnimPhase(''), 180)
      }, 180)
    }
  }

  return (
    <div className="grid gap-4">
      <style>{`
        @keyframes microlabCardOut {
          from { opacity: 1; transform: translateY(0px) scale(1); }
          to { opacity: 0; transform: translateY(10px) scale(0.985); }
        }
        @keyframes microlabCardIn {
          from { opacity: 0; transform: translateY(-8px) scale(0.99); }
          to { opacity: 1; transform: translateY(0px) scale(1); }
        }
        .microlab-card-out { animation: microlabCardOut 180ms ease-in both; }
        .microlab-card-in { animation: microlabCardIn 180ms ease-out both; }
      `}</style>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-lg font-semibold">Flashcards</div>
          <div className="text-sm text-slate-400">Repetición espaciada + repaso adaptativo (prioriza vencidas y con errores).</div>
        </div>
        {session ? (
          <button
            type="button"
            onClick={stop}
            className="rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
          >
            Salir
          </button>
        ) : null}
      </div>

      {!session && (
        <div className="grid gap-3 rounded-2xl border border-slate-800/60 bg-slate-900/20 p-4">
          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-2xl border border-slate-800/60 bg-slate-950/30 p-4">
              <div className="text-xs font-semibold text-slate-500">Vencidas hoy</div>
              <div className="mt-1 text-2xl font-extrabold text-white">{dueCards.length}</div>
            </div>
            <div className="rounded-2xl border border-slate-800/60 bg-slate-950/30 p-4">
              <div className="text-xs font-semibold text-slate-500">Racha</div>
              <div className="mt-1 text-2xl font-extrabold text-white">{streakDays} día(s)</div>
            </div>
            <div className="rounded-2xl border border-slate-800/60 bg-slate-950/30 p-4">
              <div className="text-xs font-semibold text-slate-500">Actividad 7 días</div>
              <div className="mt-1 text-2xl font-extrabold text-white">{activity7}</div>
            </div>
            <div className="rounded-2xl border border-slate-800/60 bg-slate-950/30 p-4">
              <div className="text-xs font-semibold text-slate-500">Calidad prom.</div>
              <div className="mt-1 text-2xl font-extrabold text-white">{avgQuality} / 5</div>
            </div>
          </div>

          <div className="grid gap-2 md:grid-cols-2">
            <button
              type="button"
              disabled={dueCards.length === 0}
              onClick={startDue}
              className={`h-12 rounded-2xl px-4 text-sm font-extrabold transition active:scale-[0.99] ${
                dueCards.length === 0
                  ? 'bg-slate-900/50 text-slate-500 ring-1 ring-slate-800'
                  : 'bg-emerald-500 text-emerald-950 hover:bg-emerald-400'
              }`}
            >
              Repasar vencidas ({dueCards.length})
            </button>
            <div className="rounded-2xl border border-slate-800/60 bg-slate-950/30 p-4">
              <div className="text-xs font-semibold text-slate-500">Actividad 30 días</div>
              <div className="mt-1 text-2xl font-extrabold text-white">{activity30}</div>
              <div className="mt-1 text-xs text-slate-500">Repasos totales en los últimos 30 días.</div>
            </div>
          </div>

          <div className="grid gap-2 md:grid-cols-3">
            <div className="grid gap-1">
              <div className="text-xs text-slate-500">Deck</div>
              <select
                value={deckId}
                onChange={(e) => setDeckId(e.target.value)}
                className="rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2 text-sm"
              >
                <option value="all">Todos</option>
                {decks.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-1">
              <div className="text-xs text-slate-500">Tarjetas por sesión</div>
              <input
                type="number"
                min={1}
                max={50}
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
                className="rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2 text-sm"
              />
            </div>

            <div className="grid gap-1">
              <div className="text-xs text-slate-500">Modo</div>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value)}
                className="rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2 text-sm"
              >
                <option value="adaptive">Adaptativo</option>
                <option value="errors">Repaso de errores</option>
              </select>
            </div>

            <label className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/20 px-3 py-2 text-sm text-slate-200">
              <input
                type="checkbox"
                checked={autoAdvance}
                onChange={(e) => setAutoAdvance(e.target.checked)}
                className="h-4 w-4"
              />
              Auto-advance
            </label>

            <div className="grid content-end md:col-span-3">
              <button
                type="button"
                onClick={start}
                className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 hover:bg-emerald-400"
              >
                Iniciar repaso
              </button>
            </div>
          </div>

          <div className="text-xs text-slate-500">
            Vencidas hoy: {dueCards.length} / {deckCards.length} en este deck.
          </div>
        </div>
      )}

      {session && done && (
        <div className="grid gap-3 rounded-2xl border border-slate-800/60 bg-slate-900/20 p-4">
          <div className="text-sm font-semibold">Sesión completada</div>
          <div className="text-sm text-slate-300">Tarjetas repasadas: {session.queue.length}</div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={start}
              className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 hover:bg-emerald-400"
            >
              Otra sesión
            </button>
            <button
              type="button"
              onClick={stop}
              className="rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
            >
              Configuración
            </button>
          </div>
        </div>
      )}

      {session && !done && current && (
        <div className="grid gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800/60 bg-slate-900/20 p-4">
            <div>
              <div className="text-xs text-slate-500">Tarjeta {session.index + 1} / {session.queue.length}</div>
              <div className="text-sm font-semibold">{current.deckTitle}</div>
            </div>
            <div className="text-xs text-slate-500">Tags: {(current.tags || []).slice(0, 4).join(', ') || '—'}</div>
          </div>

          <div
            className={`grid gap-3 rounded-2xl border border-slate-800/60 bg-slate-900/20 p-5 ${
              animPhase === 'out' ? 'microlab-card-out' : animPhase === 'in' ? 'microlab-card-in' : ''
            }`}
          >
            <button
              type="button"
              onClick={() => setFlipped((v) => !v)}
              className="relative grid min-h-[240px] w-full place-items-center overflow-hidden rounded-2xl border border-slate-800/60 bg-slate-950/30 p-5 text-left transition hover:bg-slate-950/40"
            >
              <div className="absolute right-4 top-4 text-xs font-semibold text-slate-500">Toca para voltear</div>
              {!flipped ? (
                <div className="grid gap-3 text-center">
                  <div className="text-xs font-semibold tracking-[0.22em] text-slate-500">FRENTE</div>
                  <div className="text-3xl font-extrabold leading-tight text-white">{current.front}</div>
                </div>
              ) : (
                <div className="grid w-full max-w-2xl gap-3">
                  <div className="text-xs font-semibold tracking-[0.22em] text-slate-500">ATRÁS</div>
                  <div className="whitespace-pre-wrap text-base font-semibold leading-relaxed text-slate-200">{current.back}</div>
                </div>
              )}
            </button>

            {pendingAdvance && lastNextLabel ? (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3">
                <div className="text-sm font-semibold text-emerald-200">Siguiente repaso: {lastNextLabel}</div>
                {!autoAdvance ? (
                  <button
                    type="button"
                    onClick={() => {
                      setAnimPhase('out')
                      window.setTimeout(() => {
                        advanceNow()
                        setAnimPhase('in')
                        window.setTimeout(() => setAnimPhase(''), 180)
                      }, 180)
                    }}
                    className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-extrabold text-emerald-950 hover:bg-emerald-400"
                  >
                    Siguiente
                  </button>
                ) : null}
              </div>
            ) : null}

            <div className="grid gap-2">
              <div className="text-xs font-semibold text-slate-500">
                Califica tu recuerdo (esto controla cuándo volverá a aparecer)
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={!flipped || pendingAdvance}
                  onClick={() => grade(0)}
                  className={`rounded-xl px-4 py-2 text-sm font-semibold ${
                    !flipped || pendingAdvance
                      ? 'bg-slate-900/50 text-slate-500 ring-1 ring-slate-800'
                      : 'bg-slate-800 text-white hover:bg-slate-700'
                  }`}
                >
                  Again
                </button>
                <button
                  type="button"
                  disabled={!flipped || pendingAdvance}
                  onClick={() => grade(3)}
                  className={`rounded-xl px-4 py-2 text-sm font-semibold ${
                    !flipped || pendingAdvance
                      ? 'bg-slate-900/50 text-slate-500 ring-1 ring-slate-800'
                      : 'bg-slate-800 text-white hover:bg-slate-700'
                  }`}
                >
                  Hard
                </button>
                <button
                  type="button"
                  disabled={!flipped || pendingAdvance}
                  onClick={() => grade(4)}
                  className={`rounded-xl px-4 py-2 text-sm font-semibold ${
                    !flipped || pendingAdvance
                      ? 'bg-slate-900/50 text-slate-500 ring-1 ring-slate-800'
                      : 'bg-emerald-500 text-emerald-950 hover:bg-emerald-400'
                  }`}
                >
                  Good
                </button>
                <button
                  type="button"
                  disabled={!flipped || pendingAdvance}
                  onClick={() => grade(5)}
                  className={`rounded-xl px-4 py-2 text-sm font-semibold ${
                    !flipped || pendingAdvance
                      ? 'bg-slate-900/50 text-slate-500 ring-1 ring-slate-800'
                      : 'bg-emerald-500 text-emerald-950 hover:bg-emerald-400'
                  }`}
                >
                  Easy
                </button>
              </div>

              <div className="text-xs text-slate-500">Tip: voltea la tarjeta antes de calificar.</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
