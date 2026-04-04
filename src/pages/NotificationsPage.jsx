import React, { useEffect, useMemo, useState } from 'react'
import { clearNotifications, listNotifications, markAllRead, markRead } from '../notifications/notifications.js'

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

  const [inbox, setInbox] = useState(() => listNotifications())

  const today = useMemo(() => todayKey(), [])
  const streak = Number(stats?.streak || 0)
  const lastDay = stats?.lastDay || null
  const openedToday = lastDay === today

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

  useEffect(() => {
    function onUpdate() {
      setInbox(listNotifications())
    }
    window.addEventListener('microlab:notifications-updated', onUpdate)
    return () => window.removeEventListener('microlab:notifications-updated', onUpdate)
  }, [])

  const unreadCount = useMemo(() => inbox.filter((n) => !n.read).length, [inbox])

  function iconFor(type) {
    const common = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', xmlns: 'http://www.w3.org/2000/svg' }
    if (type === 'success') {
      return (
        <svg {...common}>
          <path d="M20 6 9 17l-5-5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    }
    if (type === 'error') {
      return (
        <svg {...common}>
          <path d="M18 6 6 18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M6 6l12 12" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    }
    if (type === 'warning') {
      return (
        <svg {...common}>
          <path
            d="M10.3 4.3 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0Z"
            stroke="currentColor"
            strokeWidth="2.1"
            strokeLinejoin="round"
          />
          <path d="M12 9v4" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
          <path d="M12 17h.01" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
      )
    }
    return (
      <svg {...common}>
        <path
          d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10Z"
          stroke="currentColor"
          strokeWidth="2.1"
        />
        <path d="M12 16v-4" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M12 8h.01" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
    )
  }

  function fmtTime(ms) {
    const d = new Date(ms)
    return d.toLocaleString()
  }

  return (
    <div className="grid gap-4">
      <div>
        <h2 className="text-lg font-semibold">Notificaciones</h2>
        <div className="text-sm text-slate-400">Tu actividad y recordatorios de estudio.</div>
      </div>

      <div
        className="overflow-hidden rounded-3xl border border-white/10 bg-black/30 backdrop-blur-md"
        style={{
          background: 'linear-gradient(180deg, rgba(15,23,42,0.55), rgba(2,6,23,0.55))',
          boxShadow: '0 0 0 1px rgba(255,255,255,0.06), 0 30px 80px -50px rgba(0,0,0,0.9)'
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-3">
            <div
              className="grid h-11 w-11 place-items-center rounded-2xl"
              style={{
                background: 'linear-gradient(180deg, rgba(244,63,94,0.22), rgba(251,191,36,0.16))',
                boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.10), 0 0 28px -18px rgba(251,191,36,0.35)'
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M12 2s2 3 2 6-2 4-2 6 2 3 2 6c0 0-7 0-7-7 0-4 3-6 5-11Z"
                  stroke="url(#microlabFlameStroke)"
                  strokeWidth="2.2"
                  strokeLinejoin="round"
                />
                <path
                  d="M12 7c2 3 4 5 4 9a4 4 0 0 1-8 0c0-2 1-4 4-9Z"
                  fill="url(#microlabFlameFill)"
                  opacity="0.9"
                />
                <defs>
                  <linearGradient id="microlabFlameFill" x1="8" y1="7" x2="16" y2="19" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#fb7185" />
                    <stop offset="0.55" stopColor="#f97316" />
                    <stop offset="1" stopColor="#fbbf24" />
                  </linearGradient>
                  <linearGradient id="microlabFlameStroke" x1="8" y1="3" x2="16" y2="21" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#f43f5e" />
                    <stop offset="0.55" stopColor="#f97316" />
                    <stop offset="1" stopColor="#fbbf24" />
                  </linearGradient>
                </defs>
              </svg>
            </div>

            <div>
              <div className="text-xs font-semibold tracking-[0.22em] text-slate-500">RACHA</div>
              <div className="mt-1 text-base font-extrabold text-white">{streak} día(s) seguidos</div>
              <div className="mt-1 text-xs text-slate-400">
                {openedToday ? 'Hoy ya sumaste tu día.' : 'Abre la app hoy para continuar la racha.'}
              </div>
            </div>
          </div>

          <div className="grid gap-1 text-right">
            <div className="text-xs text-slate-500">Aperturas totales</div>
            <div className="text-sm font-semibold text-slate-200">{Number(stats?.opens || 0)}</div>
            <div className="text-xs text-slate-500">Último día</div>
            <div className="text-sm font-semibold text-slate-200">{lastDay || '—'}</div>
          </div>
        </div>

        <div className="grid gap-3 px-5 py-4">
          <div className="grid gap-2 md:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <div className="text-xs font-semibold tracking-[0.22em] text-slate-500">OBJETIVO</div>
              <div className="mt-1 text-sm font-semibold text-slate-200">5 preguntas</div>
              <div className="mt-1 text-xs text-slate-400">Completa 5 preguntas del Medical Quiz.</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <div className="text-xs font-semibold tracking-[0.22em] text-slate-500">MÉTODO</div>
              <div className="mt-1 text-sm font-semibold text-slate-200">1 lámina</div>
              <div className="mt-1 text-xs text-slate-400">Repite 1 lámina hasta acertar 3 seguidas.</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <div className="text-xs font-semibold tracking-[0.22em] text-slate-500">TIP</div>
              <div className="mt-1 text-sm font-semibold text-slate-200">Ajuste rápido</div>
              <div className="mt-1 text-xs text-slate-400">Si fallas, mira el pin y memoriza el contexto.</div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold tracking-[0.22em] text-slate-500">INBOX</div>
          <div className="mt-1 text-base font-extrabold text-white">
            Notificaciones
            <span className="ml-2 text-sm font-semibold text-slate-400">({unreadCount} sin leer)</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => markAllRead()}
            className="h-12 rounded-2xl bg-white/10 px-4 text-sm font-extrabold text-white transition active:scale-[0.99] hover:bg-white/15"
          >
            Marcar todo leído
          </button>
          <button
            type="button"
            onClick={() => clearNotifications()}
            className="h-12 rounded-2xl bg-rose-500/15 px-4 text-sm font-extrabold text-rose-100 ring-1 ring-rose-400/20 transition active:scale-[0.99] hover:bg-rose-500/20"
          >
            Limpiar
          </button>
        </div>
      </div>

      <div className="grid gap-3">
        {inbox.length === 0 ? (
          <div className="rounded-3xl border border-slate-800/60 bg-slate-900/20 p-6 text-sm text-slate-300">
            No tienes notificaciones todavía.
          </div>
        ) : (
          inbox.map((n) => {
            const isOk = n.type === 'success'
            const isErr = n.type === 'error'
            const isWarn = n.type === 'warning'
            const accent = isOk ? 'rgb(16 185 129)' : isErr ? 'rgb(225 29 72)' : isWarn ? 'rgb(251 191 36)' : 'rgb(34 211 238)'

            return (
              <button
                key={n.id}
                type="button"
                onClick={() => markRead(n.id, true)}
                className="w-full rounded-3xl border border-slate-800/60 bg-slate-900/20 p-6 text-left transition hover:bg-slate-900/30 active:scale-[0.999]"
                style={{
                  boxShadow: n.read
                    ? '0 0 0 1px rgba(255,255,255,0.02), 0 18px 55px -55px rgba(0,0,0,0.95)'
                    : `0 0 0 1px rgba(255,255,255,0.02), 0 18px 55px -55px rgba(0,0,0,0.95), 0 0 28px -18px color-mix(in srgb, ${accent} 30%, transparent)`
                }}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div
                      className="grid h-12 w-12 place-items-center rounded-2xl"
                      style={{
                        background: `color-mix(in srgb, ${accent} 14%, rgba(0,0,0,0.25))`,
                        color: accent,
                        boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.08)'
                      }}
                    >
                      {iconFor(n.type)}
                    </div>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-lg font-extrabold text-white">{n.title || 'Notificación'}</div>
                        {!n.read ? (
                          <div className="rounded-full bg-cyan-400/15 px-2 py-1 text-xs font-extrabold text-cyan-100 ring-1 ring-cyan-300/20">
                            NUEVO
                          </div>
                        ) : null}
                      </div>
                      <div className="mt-1 text-base font-semibold text-slate-200">{n.message}</div>
                      <div className="mt-2 text-sm text-slate-500">{fmtTime(n.at)}</div>
                    </div>
                  </div>
                </div>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
