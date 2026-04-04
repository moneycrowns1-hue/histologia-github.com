import React, { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { cards } from '../flashcards/flashcards.js'
import { isDue } from '../flashcards/srs.js'
import { computeCardStats, getCardState, loadProgress } from '../flashcards/storage.js'

function dayKey(ms) {
  const d = new Date(ms)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function lastNDaysKeys(n) {
  const keys = []
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  for (let i = n - 1; i >= 0; i--) {
    const x = new Date(d)
    x.setDate(x.getDate() - i)
    keys.push(dayKey(x.getTime()))
  }
  return keys
}

function groupByTag(cardsList) {
  const map = new Map()
  for (const c of cardsList) {
    const tags = c.tags?.length ? c.tags : ['sin-tag']
    for (const t of tags) {
      if (!map.has(t)) map.set(t, [])
      map.get(t).push(c)
    }
  }
  return Array.from(map.entries()).map(([tag, items]) => ({ tag, items }))
}

export default function StatsPage() {
  const progress = useMemo(() => loadProgress(), [])
  const perf = useMemo(() => computeCardStats(progress), [progress])

  const global = progress.stats || { reviews: 0, qualitySum: 0 }
  const avgQuality = global.reviews ? Math.round((global.qualitySum / global.reviews) * 10) / 10 : 0

  const dueCount = useMemo(() => {
    let n = 0
    for (const c of cards) {
      const st = getCardState(progress, c.id)
      if (isDue(st)) n += 1
    }
    return n
  }, [progress])

  const hardest = useMemo(() => {
    const rows = cards
      .map((c) => {
        const s = perf.get(c.id) || { reviews: 0, lapses: 0, qualitySum: 0, lastAt: 0 }
        const rate = s.reviews ? (s.lapses || 0) / s.reviews : 0
        const avgQ = s.reviews ? (s.qualitySum || 0) / s.reviews : 0
        return { id: c.id, title: c.front, deck: c.deckTitle, reviews: s.reviews, lapses: s.lapses || 0, rate, avgQ, lastAt: s.lastAt }
      })
      .filter((r) => r.reviews > 0)
      .sort((a, b) => (b.rate - a.rate) || (b.lapses - a.lapses) || (b.reviews - a.reviews))
      .slice(0, 10)

    return rows
  }, [perf])

  const activity = useMemo(() => {
    const keys = lastNDaysKeys(30)
    const counts = new Map(keys.map((k) => [k, 0]))
    for (const ev of progress.events || []) {
      const k = dayKey(ev.at || 0)
      if (counts.has(k)) counts.set(k, counts.get(k) + 1)
    }
    const values = keys.map((k) => ({ day: k, count: counts.get(k) || 0 }))
    const max = values.reduce((m, v) => Math.max(m, v.count), 0)
    const total = values.reduce((s, v) => s + v.count, 0)
    return { values, max, total }
  }, [progress.events])

  const byTag = useMemo(() => {
    const groups = groupByTag(cards)
    const rows = groups
      .map((g) => {
        let due = 0
        let avgEase = 0
        for (const c of g.items) {
          const st = getCardState(progress, c.id)
          if (isDue(st)) due += 1
          avgEase += st.ease || 2.5
        }
        avgEase = g.items.length ? avgEase / g.items.length : 0
        return { tag: g.tag, total: g.items.length, due, avgEase }
      })
      .sort((a, b) => b.due - a.due)

    return rows
  }, [progress])

  return (
    <div className="grid gap-4">
      <div>
        <div className="text-lg font-semibold">Estadísticas</div>
        <div className="text-sm text-slate-400">Seguimiento local (en este navegador) del repaso con flashcards.</div>
      </div>

      <div className="rounded-2xl border border-slate-800/60 bg-slate-900/20 p-4">
        <div className="text-sm font-semibold">Estructuras más falladas</div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-xs text-slate-500">
              <tr>
                <th className="py-2 pr-3">Estructura</th>
                <th className="py-2 pr-3">Deck</th>
                <th className="py-2 pr-3">Repasos</th>
                <th className="py-2 pr-3">Lapses</th>
                <th className="py-2 pr-3">Lapse %</th>
              </tr>
            </thead>
            <tbody>
              {hardest.length === 0 ? (
                <tr className="border-t border-slate-800/60">
                  <td className="py-2 pr-3 text-slate-300" colSpan={5}>
                    Aún no hay suficientes datos. Haz un repaso en Flashcards.
                  </td>
                </tr>
              ) : (
                hardest.map((r) => (
                  <tr key={r.id} className="border-t border-slate-800/60">
                    <td className="py-2 pr-3 text-slate-200">
                      <Link className="hover:underline" to={`/estructura/${encodeURIComponent(r.id)}`}>
                        {r.title}
                      </Link>
                    </td>
                    <td className="py-2 pr-3 text-slate-300">{r.deck}</td>
                    <td className="py-2 pr-3 text-slate-300">{r.reviews}</td>
                    <td className="py-2 pr-3 text-slate-300">{r.lapses}</td>
                    <td className="py-2 pr-3 text-slate-300">{Math.round(r.rate * 100)}%</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800/60 bg-slate-900/20 p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="text-sm font-semibold">Actividad (últimos 30 días)</div>
          <div className="text-xs text-slate-500">Total: {activity.total} repaso(s)</div>
        </div>
        <div className="mt-3 grid grid-cols-10 gap-2 sm:grid-cols-15 md:grid-cols-30">
          {activity.values.map((v) => {
            const intensity = activity.max ? v.count / activity.max : 0
            const bg =
              v.count === 0
                ? 'bg-slate-900/40'
                : intensity < 0.34
                  ? 'bg-emerald-500/20'
                  : intensity < 0.67
                    ? 'bg-emerald-500/35'
                    : 'bg-emerald-500/55'

            return (
              <div
                key={v.day}
                title={`${v.day}: ${v.count} repaso(s)`}
                className={`h-4 w-4 rounded ${bg} ring-1 ring-slate-800`}
              />
            )
          })}
        </div>
        <div className="mt-2 text-xs text-slate-500">Entre más verde, más repasos ese día. Pasa el cursor/mantén presionado para ver el número exacto.</div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-800/60 bg-slate-900/20 p-4">
          <div className="text-xs text-slate-500">Repasos totales</div>
          <div className="mt-1 text-2xl font-semibold">{global.reviews || 0}</div>
        </div>
        <div className="rounded-2xl border border-slate-800/60 bg-slate-900/20 p-4">
          <div className="text-xs text-slate-500">Calidad prom.</div>
          <div className="mt-1 text-2xl font-semibold">{avgQuality} / 5</div>
        </div>
        <div className="rounded-2xl border border-slate-800/60 bg-slate-900/20 p-4">
          <div className="text-xs text-slate-500">Vencidas hoy</div>
          <div className="mt-1 text-2xl font-semibold">{dueCount}</div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800/60 bg-slate-900/20 p-4">
        <div className="text-sm font-semibold">Por tag (estructura/tejido/órgano)</div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="text-xs text-slate-500">
              <tr>
                <th className="py-2 pr-3">Tag</th>
                <th className="py-2 pr-3">Total</th>
                <th className="py-2 pr-3">Vencidas</th>
                <th className="py-2 pr-3">Ease prom.</th>
              </tr>
            </thead>
            <tbody>
              {byTag.map((r) => (
                <tr key={r.tag} className="border-t border-slate-800/60">
                  <td className="py-2 pr-3 text-slate-200">{r.tag}</td>
                  <td className="py-2 pr-3 text-slate-300">{r.total}</td>
                  <td className="py-2 pr-3 text-slate-300">{r.due}</td>
                  <td className="py-2 pr-3 text-slate-300">{r.avgEase.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="text-xs text-slate-500">
        Nota: para estadísticas más avanzadas (por estructura específica, dificultad, curva de olvido), el siguiente paso es
        guardar eventos de respuesta y construir métricas derivadas.
      </div>
    </div>
  )
}
