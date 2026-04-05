import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getCatalog } from '../slides/slides.js'
import { listNotifications } from '../notifications/notifications.js'

function safeParse(raw, fallback) {
  try {
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function todayKey() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function HomePage({ user = null }) {
  const [catalog, setCatalog] = useState(() => getCatalog())
  const [stats, setStats] = useState(() => safeParse(localStorage.getItem('microlab_stats'), { streak: 0, lastDay: null, opens: 0 }))
  const [unreadCount, setUnreadCount] = useState(() => listNotifications().filter((n) => !n.read).length)

  useEffect(() => {
    function onSlides() {
      setCatalog(getCatalog())
    }
    function onInbox() {
      setUnreadCount(listNotifications().filter((n) => !n.read).length)
    }
    window.addEventListener('microlab:slides-updated', onSlides)
    window.addEventListener('microlab:notifications-updated', onInbox)
    return () => {
      window.removeEventListener('microlab:slides-updated', onSlides)
      window.removeEventListener('microlab:notifications-updated', onInbox)
    }
  }, [])

  useEffect(() => {
    try {
      setStats(safeParse(localStorage.getItem('microlab_stats'), { streak: 0, lastDay: null, opens: 0 }))
    } catch {
      // ignore
    }
  }, [])

  const allSlides = useMemo(() => catalog.flatMap((c) => c.items), [catalog])

  const recents = useMemo(() => {
    const raw = localStorage.getItem('microlab:recents')
    const arr = safeParse(raw, [])
    const ids = (Array.isArray(arr) ? arr : [])
      .filter((x) => x && typeof x === 'object')
      .map((x) => x.id)
      .filter((id) => typeof id === 'string')

    const map = new Map()
    for (const s of allSlides) map.set(s.id, s)

    const out = []
    const seen = new Set()
    for (const id of ids) {
      if (seen.has(id)) continue
      const s = map.get(id)
      if (!s) continue
      seen.add(id)
      out.push(s)
      if (out.length >= 8) break
    }
    return out
  }, [allSlides])

  const lastRecent = recents[0] || null
  const openedToday = stats?.lastDay === todayKey()

  const displayName = String(user?.user_metadata?.name || '').trim()
  const greeting = useMemo(() => {
    const h = new Date().getHours()
    if (h >= 5 && h < 12) return 'Buenos días'
    if (h >= 12 && h < 19) return 'Buenas tardes'
    return 'Buenas noches'
  }, [])

  return (
    <div className="grid gap-4">
      <style>{`
        @keyframes microlabHomeIn {
          from { opacity: 0; transform: translateY(10px) scale(0.99); }
          to { opacity: 1; transform: translateY(0px) scale(1); }
        }
      `}</style>

      <div
        className="overflow-hidden rounded-3xl border border-white/10 bg-black/30 p-6 backdrop-blur-md"
        style={{
          background: 'linear-gradient(180deg, rgba(15,23,42,0.55), rgba(2,6,23,0.55))',
          boxShadow: '0 0 0 1px rgba(255,255,255,0.06), 0 30px 80px -50px rgba(0,0,0,0.9)',
          animation: 'microlabHomeIn 180ms ease-out both'
        }}
      >
        <div className="text-xs font-semibold tracking-[0.22em] text-slate-500">MEDHUB</div>
        <div className="mt-1 text-3xl font-extrabold text-white">Inicio</div>
        {displayName ? (
          <div className="mt-2 text-2xl font-extrabold text-white sm:text-3xl">
            {greeting}, {displayName}.
          </div>
        ) : null}
        <div className="mt-2 text-base font-semibold text-slate-300">
          {openedToday ? 'Hoy ya registraste actividad.' : 'Abre la app y haz un quiz corto para mantener tu racha.'}
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs font-semibold tracking-[0.22em] text-slate-500">RACHA</div>
            <div className="mt-1 text-xl font-extrabold text-white">{Number(stats?.streak || 0)} día(s)</div>
            <div className="mt-1 text-base text-slate-400">Último: {stats?.lastDay || '—'}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs font-semibold tracking-[0.22em] text-slate-500">APERTURAS</div>
            <div className="mt-1 text-xl font-extrabold text-white">{Number(stats?.opens || 0)}</div>
            <div className="mt-1 text-base text-slate-400">Total en este dispositivo</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs font-semibold tracking-[0.22em] text-slate-500">INBOX</div>
            <div className="mt-1 text-xl font-extrabold text-white">{Number(unreadCount || 0)} sin leer</div>
            <div className="mt-1 text-base text-slate-400">Resultados y guardados</div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {lastRecent ? (
            <Link
              to={`/visor?slide=${encodeURIComponent(lastRecent.id)}`}
              className="inline-flex h-12 items-center justify-center rounded-2xl bg-cyan-400 px-5 text-lg font-extrabold text-slate-950 transition active:scale-[0.99] hover:bg-cyan-300"
            >
              Continuar
            </Link>
          ) : (
            <Link
              to="/visor"
              className="inline-flex h-12 items-center justify-center rounded-2xl bg-cyan-400 px-5 text-lg font-extrabold text-slate-950 transition active:scale-[0.99] hover:bg-cyan-300"
            >
              Abrir visor
            </Link>
          )}
          <Link
            to="/biblioteca"
            className="inline-flex h-12 items-center justify-center rounded-2xl bg-white/10 px-5 text-lg font-extrabold text-white transition active:scale-[0.99] hover:bg-white/15"
          >
            Biblioteca
          </Link>
          <Link
            to="/quiz"
            className="inline-flex h-12 items-center justify-center rounded-2xl bg-emerald-500 px-5 text-lg font-extrabold text-emerald-950 transition active:scale-[0.99] hover:bg-emerald-400"
          >
            Quiz
          </Link>
          <Link
            to="/notificaciones"
            className="inline-flex h-12 items-center justify-center rounded-2xl bg-white/10 px-5 text-lg font-extrabold text-white transition active:scale-[0.99] hover:bg-white/15"
          >
            Notificaciones
          </Link>
        </div>
      </div>

      {recents.length ? (
        <section className="rounded-3xl border border-slate-800/60 bg-slate-900/20 p-5">
          <div className="text-xs font-semibold tracking-[0.22em] text-slate-500">RECIENTES</div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {recents.slice(0, 4).map((s) => (
              <Link
                key={s.id}
                to={`/visor?slide=${encodeURIComponent(s.id)}`}
                className="rounded-2xl border border-white/10 bg-black/20 p-4 transition hover:bg-black/25 active:scale-[0.99]"
              >
                <div className="text-base font-extrabold text-white line-clamp-2">{s.title}</div>
                <div className="mt-1 text-sm font-semibold text-slate-400 line-clamp-1">{s.topic || 'Sin tema'}</div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section className="grid gap-3 md:grid-cols-3">
        <div className="rounded-3xl border border-slate-800/60 bg-slate-900/20 p-5">
          <div className="text-xs font-semibold tracking-[0.22em] text-slate-500">MODO</div>
          <div className="mt-1 text-lg font-extrabold text-white">Estudio</div>
          <div className="mt-2 text-base text-slate-300">Explora la lámina, usa zoom fluido y revisa etiquetas.</div>
        </div>
        <div className="rounded-3xl border border-slate-800/60 bg-slate-900/20 p-5">
          <div className="text-xs font-semibold tracking-[0.22em] text-slate-500">MODO</div>
          <div className="mt-1 text-lg font-extrabold text-white">Identificar Punto</div>
          <div className="mt-2 text-base text-slate-300">Entrena reconocimiento tocando el hotspot correcto.</div>
        </div>
        <div className="rounded-3xl border border-slate-800/60 bg-slate-900/20 p-5">
          <div className="text-xs font-semibold tracking-[0.22em] text-slate-500">NUEVO</div>
          <div className="mt-1 text-lg font-extrabold text-white">Medical Quiz 2026</div>
          <div className="mt-2 text-base text-slate-300">Pin “?” + opciones A-D + feedback premium para memorizar rápido.</div>
        </div>
      </section>
    </div>
  )
}
