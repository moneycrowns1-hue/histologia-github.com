import React, { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { cards } from '../flashcards/flashcards.js'
import { isDue } from '../flashcards/srs.js'
import { getCardState, loadProgress } from '../flashcards/storage.js'

function fmtDate(ms) {
  if (!ms) return '—'
  try {
    return new Date(ms).toLocaleString()
  } catch {
    return String(ms)
  }
}

export default function StructurePage() {
  const { cardId } = useParams()
  const decoded = decodeURIComponent(cardId || '')

  const progress = useMemo(() => loadProgress(), [])

  const card = useMemo(() => cards.find((c) => c.id === decoded) || null, [decoded])
  const state = useMemo(() => (card ? getCardState(progress, card.id) : null), [progress, card])

  const events = useMemo(() => {
    if (!card) return []
    const list = (progress.events || []).filter((e) => e.cardId === card.id)
    list.sort((a, b) => (b.at || 0) - (a.at || 0))
    return list.slice(0, 25)
  }, [progress.events, card])

  const summary = useMemo(() => {
    if (!card) return { reviews: 0, wrong: 0, accuracy: 0 }
    let reviews = 0
    let wrong = 0
    for (const e of progress.events || []) {
      if (e.cardId !== card.id) continue
      reviews += 1
      if (!e.correct) wrong += 1
    }
    const accuracy = reviews ? Math.round(((reviews - wrong) / reviews) * 100) : 0
    return { reviews, wrong, accuracy }
  }, [progress.events, card])

  if (!card) {
    return (
      <div className="grid gap-3">
        <div className="text-lg font-semibold">Estructura</div>
        <div className="rounded-2xl border border-slate-800/60 bg-slate-900/20 p-4 text-sm text-slate-300">
          No se encontró esta estructura.
        </div>
        <Link className="text-sm text-slate-300 hover:underline" to="/estadisticas">
          Volver a estadísticas
        </Link>
      </div>
    )
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-lg font-semibold">{card.correctAnswer}</div>
          <div className="text-sm text-slate-400">Deck: {card.deckTitle}</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            className="rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
            to="/flashcards"
          >
            Ir a Flashcards
          </Link>
          <Link className="text-sm text-slate-300 hover:underline" to="/estadisticas">
            Volver
          </Link>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-800/60 bg-slate-900/20 p-4">
          <div className="text-xs text-slate-500">Repasos</div>
          <div className="mt-1 text-2xl font-semibold">{summary.reviews}</div>
        </div>
        <div className="rounded-2xl border border-slate-800/60 bg-slate-900/20 p-4">
          <div className="text-xs text-slate-500">Precisión</div>
          <div className="mt-1 text-2xl font-semibold">{summary.accuracy}%</div>
        </div>
        <div className="rounded-2xl border border-slate-800/60 bg-slate-900/20 p-4">
          <div className="text-xs text-slate-500">Vencimiento</div>
          <div className="mt-1 text-sm text-slate-200">
            {state ? (isDue(state) ? 'Vencida (repasar hoy)' : fmtDate(state.dueAt)) : '—'}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800/60 bg-slate-900/20 p-4">
        <div className="text-sm font-semibold">Explicación</div>
        <div className="mt-2 text-sm text-slate-300">{card.explainCorrect}</div>
        <div className="mt-2 text-xs text-slate-500">Tags: {(card.tags || []).join(', ') || '—'}</div>
      </div>

      <div className="rounded-2xl border border-slate-800/60 bg-slate-900/20 p-4">
        <div className="text-sm font-semibold">Historial reciente</div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="text-xs text-slate-500">
              <tr>
                <th className="py-2 pr-3">Fecha</th>
                <th className="py-2 pr-3">Elegida</th>
                <th className="py-2 pr-3">Correcta</th>
                <th className="py-2 pr-3">Resultado</th>
                <th className="py-2 pr-3">Calidad</th>
              </tr>
            </thead>
            <tbody>
              {events.length === 0 ? (
                <tr className="border-t border-slate-800/60">
                  <td className="py-2 pr-3 text-slate-300" colSpan={5}>
                    Sin eventos todavía.
                  </td>
                </tr>
              ) : (
                events.map((e, idx) => (
                  <tr key={idx} className="border-t border-slate-800/60">
                    <td className="py-2 pr-3 text-slate-300">{fmtDate(e.at)}</td>
                    <td className="py-2 pr-3 text-slate-300">{e.picked || '—'}</td>
                    <td className="py-2 pr-3 text-slate-300">{e.correctAnswer || '—'}</td>
                    <td className={`py-2 pr-3 ${e.correct ? 'text-emerald-300' : 'text-rose-300'}`}>{e.correct ? 'OK' : 'Error'}</td>
                    <td className="py-2 pr-3 text-slate-300">{e.quality}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
