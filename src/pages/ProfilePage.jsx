import React, { useEffect, useState } from 'react'
import { cloudGetUser, cloudSignOut, cloudUpdateProfile } from '../utils/supabaseSync.js'

const roleOptions = [
  { value: 'read', label: 'Lectura (solo ver)' },
  { value: 'amigo', label: 'Amigo' },
  { value: 'estudiante', label: 'Estudiante' },
  { value: 'editor', label: 'Editor' }
]

export default function ProfilePage() {
  const [user, setUser] = useState(null)
  const [role, setRole] = useState('')
  const [name, setName] = useState('')
  const [perfEnabled, setPerfEnabled] = useState(() => {
    try {
      return localStorage.getItem('microlab:perf') === '1'
    } catch {
      return false
    }
  })
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')

  useEffect(() => {
    let alive = true
    cloudGetUser()
      .then((u) => {
        if (!alive) return
        setUser(u)
        const r = String(u?.user_metadata?.role || '')
        const n = String(u?.user_metadata?.name || '')
        setRole(r)
        setName(n)
      })
      .catch(() => {
        if (!alive) return
        setUser(null)
      })
    return () => {
      alive = false
    }
  }, [])

  async function onSaveRole() {
    try {
      setBusy(true)
      setStatus('Guardando…')
      const next = await cloudUpdateProfile({ role, name })
      setUser(next)
      setStatus('Guardado.')
      setTimeout(() => setStatus(''), 1200)
    } catch (err) {
      const msg = String(err?.message || 'error')
      setStatus(`No se pudo guardar: ${msg}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="rounded-2xl border border-slate-800/60 bg-slate-900/30 p-5">
        <div className="text-lg font-extrabold">Perfil</div>
        <div className="mt-1 text-sm text-slate-300">Cuenta y rol.</div>

        <div className="mt-5 grid gap-2">
          <div className="text-xs font-semibold text-slate-400">Email</div>
          <div className="rounded-xl border border-slate-800/60 bg-black/30 px-4 py-3 text-sm font-semibold text-slate-200">
            {user?.email || '—'}
          </div>

          <div className="mt-3 text-xs font-semibold text-slate-400">Nombre</div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Tu nombre"
            className="h-12 w-full rounded-2xl border border-slate-800/60 bg-black px-4 text-base font-semibold text-white placeholder:text-slate-600"
          />

          <div className="mt-3 text-xs font-semibold text-slate-400">Rol</div>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="h-12 w-full rounded-2xl border border-slate-800/60 bg-black px-4 text-base font-semibold text-white"
          >
            <option value="">Sin seleccionar</option>
            {roleOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>

          <div className="mt-3 rounded-2xl border border-slate-800/60 bg-black/30 p-4">
            <div className="text-sm font-extrabold text-white">Monitoreo de rendimiento</div>
            <div className="mt-1 text-sm text-slate-300">Activa logs de rendimiento (LCP/CLS/long tasks) en consola.</div>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                const next = !perfEnabled
                setPerfEnabled(next)
                try {
                  localStorage.setItem('microlab:perf', next ? '1' : '0')
                } catch {
                  // ignore
                }
                setStatus('Guardado. Reinicia la página para aplicar.')
                setTimeout(() => setStatus(''), 1800)
              }}
              className={`mt-3 h-11 w-full rounded-2xl px-4 text-base font-extrabold transition active:scale-[0.99] ${
                perfEnabled ? 'bg-cyan-400 text-slate-950 hover:bg-cyan-300' : 'bg-white/10 text-white hover:bg-white/15'
              }`}
            >
              {perfEnabled ? 'Rendimiento: ACTIVO' : 'Rendimiento: INACTIVO'}
            </button>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={onSaveRole}
              className={`h-12 rounded-2xl px-4 text-base font-extrabold transition active:scale-[0.99] ${
                busy ? 'bg-white/10 text-slate-400' : 'bg-emerald-500 text-emerald-950 hover:bg-emerald-400'
              }`}
            >
              Guardar
            </button>

            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                try {
                  setBusy(true)
                  await cloudSignOut()
                } catch {
                  // ignore
                } finally {
                  setBusy(false)
                }
              }}
              className={`h-12 rounded-2xl px-4 text-base font-extrabold transition active:scale-[0.99] ${
                busy ? 'bg-white/10 text-slate-400' : 'bg-slate-800 text-slate-100 hover:bg-slate-700'
              }`}
            >
              Cerrar sesión
            </button>
          </div>

          {status ? <div className="mt-2 text-sm text-slate-300">{status}</div> : null}
        </div>
      </div>
    </div>
  )
}
