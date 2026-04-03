import React, { useEffect, useMemo, useState } from 'react'

function todayKey() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // ignore
  }
}

export default function NotificationsPage() {
  const [stats, setStats] = useState(() => readJSON('microlab_stats', { streak: 0, lastDay: null, opens: 0 }))

  useEffect(() => {
    const t = todayKey()
    setStats((prev) => {
      const last = prev.lastDay
      const next = { ...prev, opens: (prev.opens || 0) + 1 }
      if (last === t) return next

      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      const yKey = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(
        yesterday.getDate()
      ).padStart(2, '0')}`

      const streak = last === yKey ? (prev.streak || 0) + 1 : 1
      return { ...next, streak, lastDay: t }
    })
  }, [])

  useEffect(() => {
    writeJSON('microlab_stats', stats)
  }, [stats])

  const items = useMemo(() => {
    return [
      {
        id: 'n-streak',
        title: `Racha de estudio: ${stats.streak} día(s)` ,
        detail: 'Abre la app cada día para mantener la racha. Luego, practica un quiz corto.'
      },
      {
        id: 'n-tip',
        title: 'Tip de estudio',
        detail: 'En cada diapositiva, empieza con 3–5 hotspots y sube gradualmente.'
      },
      {
        id: 'n-assets',
        title: 'Carga tus imágenes',
        detail: 'Cuando tengas microfotografías, colócalas en public/slides y actualiza src/slides/slides.js.'
      }
    ]
  }, [stats.streak])

  return (
    <div className="grid gap-4">
      <h2 className="text-lg font-semibold">Notificaciones</h2>
      <div className="rounded-2xl border border-slate-800/60 bg-slate-900/20 p-4">
        <div className="text-sm font-semibold">Actividad</div>
        <div className="mt-1 text-sm text-slate-300">Aperturas totales: {stats.opens}</div>
      </div>
      <div className="grid gap-3">
        {items.map((n) => (
          <div key={n.id} className="rounded-2xl border border-slate-800/60 bg-slate-900/20 p-4">
            <div className="text-sm font-semibold">{n.title}</div>
            <div className="mt-1 text-sm text-slate-300">{n.detail}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
