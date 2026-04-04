import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'

const ToastContext = createContext(null)

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n))
}

function iconFor(type) {
  const common = {
    width: 18,
    height: 18,
    viewBox: '0 0 24 24',
    fill: 'none',
    xmlns: 'http://www.w3.org/2000/svg'
  }

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

export function ToastProvider({ children, position = 'bottom-right' }) {
  const [toasts, setToasts] = useState([])
  const timersRef = useRef(new Map())

  const remove = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
    const timers = timersRef.current
    const h = timers.get(id)
    if (h) window.clearTimeout(h)
    timers.delete(id)
  }, [])

  const toast = useCallback(
    (input) => {
      const now = Date.now()
      const id = `${now}-${Math.random().toString(16).slice(2)}`
      const t = {
        id,
        type: input?.type || 'info',
        title: input?.title || '',
        message: String(input?.message || ''),
        durationMs: clamp(Number(input?.durationMs ?? 2400), 900, 12000)
      }

      setToasts((prev) => {
        const next = [t, ...prev]
        return next.slice(0, 4)
      })

      const handle = window.setTimeout(() => {
        remove(id)
      }, t.durationMs)
      timersRef.current.set(id, handle)

      return id
    },
    [remove]
  )

  const api = useMemo(() => ({ toast, remove }), [toast, remove])

  const pos = useMemo(() => {
    if (position === 'top-center') return 'top-4 left-1/2 -translate-x-1/2'
    if (position === 'top-right') return 'top-4 right-4'
    if (position === 'bottom-center') return 'bottom-4 left-1/2 -translate-x-1/2'
    return 'bottom-4 right-4'
  }, [position])

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className={`pointer-events-none fixed z-[300] ${pos} w-[min(420px,calc(100vw-2rem))]`}
      >
        <div className="grid gap-2">
          {toasts.map((t) => {
            const isOk = t.type === 'success'
            const isErr = t.type === 'error'
            const isWarn = t.type === 'warning'

            const accent = isOk ? 'rgb(16 185 129)' : isErr ? 'rgb(225 29 72)' : isWarn ? 'rgb(251 191 36)' : 'rgb(34 211 238)'
            const glow = isOk
              ? 'rgba(16,185,129,0.25)'
              : isErr
                ? 'rgba(225,29,72,0.25)'
                : isWarn
                  ? 'rgba(251,191,36,0.22)'
                  : 'rgba(34,211,238,0.22)'

            return (
              <div
                key={t.id}
                className="pointer-events-auto overflow-hidden rounded-2xl border border-white/10 bg-black/30 backdrop-blur-md"
                style={{
                  boxShadow: `0 0 0 1px rgba(255,255,255,0.06), 0 18px 55px -35px rgba(0,0,0,0.95), 0 0 28px -18px ${glow}`,
                  animation: 'microlabToastIn 160ms ease-out both'
                }}
                role="status"
                aria-live="polite"
              >
                <div className="flex items-start gap-3 px-4 py-3">
                  <div className="mt-0.5 grid h-9 w-9 place-items-center rounded-2xl"
                    style={{ background: `color-mix(in srgb, ${accent} 16%, rgba(0,0,0,0.25))`, color: accent, boxShadow: `inset 0 0 0 1px rgba(255,255,255,0.08)` }}
                  >
                    {iconFor(t.type)}
                  </div>

                  <div className="min-w-0 flex-1">
                    {t.title ? <div className="text-sm font-extrabold text-white">{t.title}</div> : null}
                    <div className={`text-sm font-semibold ${t.title ? 'text-slate-200' : 'text-white'}`}>{t.message}</div>
                  </div>

                  <button
                    type="button"
                    onClick={() => remove(t.id)}
                    className="-mr-1 grid h-9 w-9 place-items-center rounded-xl text-slate-300 hover:bg-white/5"
                    style={{ boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.06)' }}
                    aria-label="Cerrar"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M18 6 6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M6 6l12 12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>

                <div className="h-1 w-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
                  <div
                    className="h-full"
                    style={{
                      width: '100%',
                      background: `linear-gradient(90deg, ${accent}, rgba(255,255,255,0.15))`,
                      animation: `microlabToastBar ${t.durationMs}ms linear forwards`
                    }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <style>{`
        @keyframes microlabToastIn {
          from { opacity: 0; transform: translateY(8px) scale(0.99); }
          to { opacity: 1; transform: translateY(0px) scale(1); }
        }
        @keyframes microlabToastBar {
          from { transform: translateX(0%); }
          to { transform: translateX(-100%); }
        }
      `}</style>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    throw new Error('useToast must be used within ToastProvider')
  }
  return ctx
}
