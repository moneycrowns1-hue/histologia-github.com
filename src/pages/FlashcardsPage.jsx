import React, { useMemo, useState } from 'react'
import { cards, decks } from '../flashcards/flashcards.js'
import { isDue, schedule } from '../flashcards/srs.js'
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

  function buildErrorQueue(baseCards, take) {
    const candidates = baseCards
      .map((c) => {
        const st = getCardState(progress, c.id)
        const due = isDue(st)
        const err = cardErrorRate(c.id)
        const wrongRecent = wasWrongRecently(c.id, 7)
        const dueAt = st.dueAt || 0
        return { c, due, err, wrongRecent, dueAt }
      })
      .filter((r) => r.err >= 0.25 || r.wrongRecent || r.due)

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
  return a
}

function buildChoices(allCards, correct, count) {
  const others = allCards.map((c) => c.correctAnswer).filter((v) => v && v !== correct)
  const pick = shuffle(Array.from(new Set(others))).slice(0, Math.max(0, count - 1))
  return shuffle([correct, ...pick])
}

export default function FlashcardsPage() {
  const [deckId, setDeckId] = useState('all')
  const [limit, setLimit] = useState(12)
  const [mode, setMode] = useState('adaptive')

  const [session, setSession] = useState(null)
  const [revealed, setRevealed] = useState(false)
  const [picked, setPicked] = useState(null)

  const progress = useMemo(() => loadProgress(), [])
  const perf = useMemo(() => computeCardStats(progress), [progress])

  const deckCards = useMemo(() => {
    const base = deckId === 'all' ? cards : cards.filter((c) => c.deckId === deckId || c.tags?.includes(deckId))
    return base
  }, [deckId])

  const dueCards = useMemo(() => {
    const due = []
    for (const c of deckCards) {
      const st = getCardState(progress, c.id)
      if (isDue(st)) due.push(c)
    }
    return due
  }, [deckCards, progress])

  const cardByAnswer = useMemo(() => {
    const m = new Map()
    for (const c of cards) m.set(c.correctAnswer, c)
    return m
  }, [])

  function cardErrorRate(cardId) {
    const s = perf.get(cardId)
    if (!s || !s.reviews) return 0
    return s.wrong / s.reviews
  }

  function wasWrongRecently(cardId, days) {
    const since = Date.now() - days * 24 * 60 * 60 * 1000
    for (let i = (progress.events || []).length - 1; i >= 0; i--) {
      const ev = progress.events[i]
      if (!ev || ev.at < since) break
      if (ev.cardId === cardId) return ev.correct === false
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

  function start() {
    const base = deckCards.length ? deckCards : cards
    const qs = (mode === 'errors' ? buildErrorQueue : buildAdaptiveQueue)(base, Math.max(1, limit))
    setSession({
      queue: qs,
      index: 0,
      correct: 0,
      wrong: 0
    })
    setRevealed(false)
    setPicked(null)
  }

  function stop() {
    setSession(null)
    setRevealed(false)
    setPicked(null)
  }

  const current = session ? session.queue[session.index] : null
  const done = session && session.index >= session.queue.length

  const choices = useMemo(() => {
    if (!current) return []
    return buildChoices(deckCards.length ? deckCards : cards, current.correctAnswer, 4)
  }, [current, deckCards])

  function grade(quality) {
    if (!current) return

    const fresh = loadProgress()
    const prev = getCardState(fresh, current.id)
    const next = schedule(prev, quality)
    let updated = setCardState(fresh, current.id, next)

    const wasCorrect = picked === current.correctAnswer
    updated = bumpGlobalStats(updated, wasCorrect)
    updated = addReviewEvent(updated, {
      at: Date.now(),
      cardId: current.id,
      deckId: current.deckId,
      tags: current.tags || [],
      picked: picked,
      correctAnswer: current.correctAnswer,
      correct: wasCorrect,
      quality
    })
    saveProgress(updated)

    setSession((s) => ({
      ...s,
      index: s.index + 1,
      correct: s.correct + (wasCorrect ? 1 : 0),
      wrong: s.wrong + (wasCorrect ? 0 : 1)
    }))
    setRevealed(false)
    setPicked(null)
  }

  return (
    <div className="grid gap-4">
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
          <div className="text-sm text-slate-300">Correctas: {session.correct} · Incorrectas: {session.wrong}</div>
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

          <div className="rounded-2xl border border-slate-800/60 bg-slate-900/20 p-5">
            <div className="text-sm font-semibold">{current.prompt}</div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {choices.map((ch) => {
                const active = picked === ch
                const showState = revealed
                const isCorrect = ch === current.correctAnswer
                const wrongPick = showState && active && !isCorrect
                const rightPick = showState && active && isCorrect

                return (
                  <button
                    key={ch}
                    type="button"
                    disabled={revealed}
                    onClick={() => {
                      setPicked(ch)
                      setRevealed(true)
                    }}
                    className={`rounded-xl border px-4 py-3 text-left text-sm transition ${
                      rightPick
                        ? 'border-emerald-400 bg-emerald-500/10'
                        : wrongPick
                          ? 'border-rose-400 bg-rose-500/10'
                          : active
                            ? 'border-slate-500 bg-slate-900/30'
                            : 'border-slate-800 bg-slate-950/30 hover:bg-slate-900/20'
                    }`}
                  >
                    <div className="font-medium">{ch}</div>
                    {showState && isCorrect ? (
                      <div className="mt-1 text-xs text-slate-400">Respuesta correcta</div>
                    ) : null}
                  </button>
                )
              })}
            </div>

            {revealed && (
              <div className="mt-4 grid gap-3 rounded-2xl border border-slate-800/60 bg-slate-950/30 p-4">
                <div className="text-sm font-semibold">
                  {picked === current.correctAnswer ? 'Correcto' : 'Incorrecto'}
                </div>
                <div className="text-sm text-slate-300">
                  {picked === current.correctAnswer ? current.explainCorrect : current.explainIncorrect}
                </div>

                {picked && picked !== current.correctAnswer ? (
                  <div className="grid gap-2 rounded-xl border border-slate-800/60 bg-slate-900/10 p-3">
                    <div className="text-xs text-slate-500">Por qué la correcta es correcta</div>
                    <div className="text-sm text-slate-300">{current.explainCorrect}</div>

                    <div className="text-xs text-slate-500">Por qué la elegida es incorrecta (qué era realmente)</div>
                    <div className="text-sm text-slate-300">
                      {cardByAnswer.get(picked)?.explainCorrect || 'No hay explicación para esta opción todavía.'}
                    </div>
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => grade(0)}
                    className="rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
                  >
                    Again
                  </button>
                  <button
                    type="button"
                    onClick={() => grade(3)}
                    className="rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
                  >
                    Hard
                  </button>
                  <button
                    type="button"
                    onClick={() => grade(4)}
                    className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 hover:bg-emerald-400"
                  >
                    Good
                  </button>
                  <button
                    type="button"
                    onClick={() => grade(5)}
                    className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 hover:bg-emerald-400"
                  >
                    Easy
                  </button>
                </div>

                <div className="text-xs text-slate-500">
                  Tip: si fallaste, usa Again/Hard para que vuelva más pronto.
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
