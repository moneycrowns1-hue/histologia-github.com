import React, { useState } from 'react'
import { cloudIsReady, cloudSendLoginEmail } from '../utils/supabaseSync.js'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)

  async function onSend() {
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

    try {
      setBusy(true)
      setStatus('Enviando link/código al email…')
      const redirectTo = `${window.location.origin}${window.location.pathname}#/`
      await cloudSendLoginEmail(e, redirectTo)
      setStatus('Revisa tu correo y abre el link para iniciar sesión.')
    } catch (err) {
      setStatus(`No se pudo enviar el login: ${err?.message || 'error'}`)
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
          <button
            type="button"
            disabled={busy}
            onClick={onSend}
            className={`mt-2 h-12 rounded-2xl px-4 text-base font-extrabold transition active:scale-[0.99] ${
              busy ? 'bg-white/10 text-slate-400' : 'bg-emerald-500 text-emerald-950 hover:bg-emerald-400'
            }`}
          >
            Enviar link/código
          </button>
          {status ? <div className="mt-2 text-sm text-slate-300">{status}</div> : null}
        </div>

        <div className="mt-5 text-xs text-slate-500">
          Abre el link del correo en este mismo navegador. Luego volverás automáticamente a la app.
        </div>
      </div>
    </div>
  )
}
