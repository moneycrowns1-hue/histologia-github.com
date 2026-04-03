import React, { useState } from 'react'
import { cloudIsReady, cloudSignInWithPassword } from '../utils/supabaseSync.js'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)

  const canSignIn = !busy

  function isAllowedEmail(e) {
    const raw = String(import.meta.env.VITE_ALLOWED_EMAILS || '').trim()
    if (!raw) return true
    const allowed = raw
      .split(',')
      .map((x) => String(x || '').trim().toLowerCase())
      .filter(Boolean)
    return allowed.includes(String(e || '').trim().toLowerCase())
  }

  async function onSignIn() {
    if (!canSignIn) return

    const ready = await cloudIsReady().catch(() => false)
    if (!ready) {
      setStatus('Configura Supabase (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).')
      return
    }

    const e = String(email || '').trim()
    if (!e || !e.includes('@')) {
      setStatus('Ingresa un email válido.')
      return
    }

    if (!isAllowedEmail(e)) {
      setStatus('Este email no está autorizado para entrar.')
      return
    }

    const p = String(password || '')
    if (!p) {
      setStatus('Ingresa tu contraseña.')
      return
    }

    try {
      setBusy(true)
      setStatus('Iniciando sesión…')
      await cloudSignInWithPassword(e, p)
      setStatus('')
    } catch (err) {
      const msg = String(err?.message || 'error')
      setStatus(`No se pudo iniciar sesión: ${msg}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="-mx-4 -my-6 grid min-h-[100dvh] place-items-center bg-black px-4 py-10 text-white">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[0_30px_80px_-50px_rgba(0,0,0,0.9)]">
        <div className="text-2xl font-extrabold tracking-tight">MicroLab</div>
        <div className="mt-1 text-sm font-semibold text-slate-300">Inicia sesión para sincronizar tu biblioteca.</div>

        <div className="mt-5 grid gap-2">
          <div className="text-xs font-semibold text-slate-400">Email</div>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@email.com"
            className="h-12 w-full rounded-2xl border border-white/10 bg-black px-4 text-base font-semibold text-white placeholder:text-slate-600"
          />
          <div className="mt-2 text-xs font-semibold text-slate-400">Contraseña</div>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            type="password"
            className="h-12 w-full rounded-2xl border border-white/10 bg-black px-4 text-base font-semibold text-white placeholder:text-slate-600"
          />
          <button
            type="button"
            disabled={!canSignIn}
            onClick={onSignIn}
            className={`mt-2 h-12 rounded-2xl px-4 text-base font-extrabold transition active:scale-[0.99] ${
              !canSignIn ? 'bg-white/10 text-slate-400' : 'bg-emerald-500 text-emerald-950 hover:bg-emerald-400'
            }`}
          >
            Entrar
          </button>
          {status ? <div className="mt-2 text-sm text-slate-300">{status}</div> : null}
        </div>

        <div className="mt-5 text-xs text-slate-500">
          Tu sesión queda guardada en este dispositivo. Si quieres cambiar de cuenta, cierra sesión desde Perfil.
        </div>
      </div>
    </div>
  )
}
