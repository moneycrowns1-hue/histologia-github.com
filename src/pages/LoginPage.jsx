import React, { useEffect, useMemo, useState } from 'react'
import { cloudIsReady, cloudSendLoginEmail } from '../utils/supabaseSync.js'

const COOLDOWN_KEY = 'microlab:auth:otp_cooldown_until'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const [cooldownUntil, setCooldownUntil] = useState(() => {
    try {
      const raw = localStorage.getItem(COOLDOWN_KEY)
      const n = raw ? Number(raw) : 0
      return Number.isFinite(n) ? n : 0
    } catch {
      return 0
    }
  })

  useEffect(() => {
    const t = setInterval(() => {
      setCooldownUntil((v) => v)
    }, 250)
    return () => clearInterval(t)
  }, [])

  const cooldownMsLeft = useMemo(() => {
    const left = (cooldownUntil || 0) - Date.now()
    return left > 0 ? left : 0
  }, [cooldownUntil])

  const canSend = !busy && cooldownMsLeft <= 0

  async function onSend() {
    if (!canSend) return

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

      try {
        const until = Date.now() + 60_000
        localStorage.setItem(COOLDOWN_KEY, String(until))
        setCooldownUntil(until)
      } catch {
        // ignore
      }

      const redirectTo = `${window.location.origin}${window.location.pathname}`
      await cloudSendLoginEmail(e, redirectTo)
      setStatus('Revisa tu correo y abre el link para iniciar sesión. Si usas iPhone/iPad, ábrelo en el mismo navegador donde está la app. Los links viejos pueden expirar.')
    } catch (err) {
      const msg = String(err?.message || 'error')
      if (msg.toLowerCase().includes('rate limit')) {
        setStatus('Demasiados intentos de email por ahora (rate limit). Espera unos minutos y vuelve a intentar.')
        try {
          const until = Date.now() + 3 * 60_000
          localStorage.setItem(COOLDOWN_KEY, String(until))
          setCooldownUntil(until)
        } catch {
          // ignore
        }
      } else {
        setStatus(`No se pudo enviar el login: ${msg}`)
      }
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
            disabled={!canSend}
            onClick={onSend}
            className={`mt-2 h-12 rounded-2xl px-4 text-base font-extrabold transition active:scale-[0.99] ${
              !canSend ? 'bg-white/10 text-slate-400' : 'bg-emerald-500 text-emerald-950 hover:bg-emerald-400'
            }`}
          >
            {cooldownMsLeft > 0 ? `Reenviar en ${Math.ceil(cooldownMsLeft / 1000)}s` : 'Enviar link/código'}
          </button>
          {status ? <div className="mt-2 text-sm text-slate-300">{status}</div> : null}
        </div>

        <div className="mt-5 text-xs text-slate-500">
          Abre el link del correo en este mismo navegador. Si el link falla, vuelve a enviar uno nuevo (los links expiran).
        </div>
      </div>
    </div>
  )
}
