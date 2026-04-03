import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import SlideViewer from '../slides/SlideViewer.jsx'
import { slides } from '../slides/slides.js'

export default function ViewerPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const slideId = searchParams.get('slide') || slides[0]?.id
  const slide = useMemo(() => slides.find((s) => s.id === slideId) || slides[0], [slideId])

  const [mode, setMode] = useState('study')

  useEffect(() => {
    if (!slide?.id) return

    try {
      const key = 'microlab:recents'
      const raw = localStorage.getItem(key)
      const arr = raw ? JSON.parse(raw) : []
      const now = Date.now()
      const maxAgeMs = 7 * 24 * 60 * 60 * 1000

      const cleaned = (Array.isArray(arr) ? arr : [])
        .filter((x) => x && typeof x === 'object')
        .filter((x) => typeof x.id === 'string')
        .filter((x) => typeof x.t === 'number')
        .filter((x) => now - x.t <= maxAgeMs)

      const without = cleaned.filter((x) => x.id !== slide.id)
      const next = [{ id: slide.id, t: now }, ...without].slice(0, 30)
      localStorage.setItem(key, JSON.stringify(next))
    } catch {
      // ignore
    }
  }, [slide?.id])

  if (!slide) return null

  return (
    <div className="relative -mx-4 -mt-4 min-h-[100dvh] bg-black sm:mx-0 sm:mt-0">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30">
        <div
          className="pointer-events-auto mx-auto flex w-full max-w-6xl items-center gap-3 bg-black/60 px-3 py-2 backdrop-blur md:gap-4 md:px-5"
          style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.5rem)' }}
        >
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900/60 text-sm font-semibold text-slate-100 ring-1 ring-slate-800 hover:bg-slate-900 md:h-12 md:w-12"
            aria-label="Volver"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          <div className="flex-1 text-center">
            <div className="truncate text-[13px] font-semibold text-white md:text-sm">{slide.title}</div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden sm:block">
              <select
                value={slide.id}
                onChange={(e) => setSearchParams({ slide: e.target.value })}
                className="h-11 max-w-[220px] rounded-2xl border border-slate-800 bg-slate-950/40 px-3 text-[13px] text-slate-100 md:h-12 md:max-w-[320px] md:text-sm"
              >
                {slides.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="inline-flex h-11 items-center rounded-2xl border border-slate-800 bg-slate-950/40 p-1 md:h-12">
              <button
                className={`h-9 rounded-xl px-3 text-[13px] md:h-10 md:text-sm ${
                  mode === 'study' ? 'bg-slate-800 text-white' : 'text-slate-300 hover:bg-slate-900'
                }`}
                onClick={() => setMode('study')}
                type="button"
              >
                Estudio
              </button>
              <button
                className={`h-9 rounded-xl px-3 text-[13px] md:h-10 md:text-sm ${
                  mode === 'quiz' ? 'bg-slate-800 text-white' : 'text-slate-300 hover:bg-slate-900'
                }`}
                onClick={() => setMode('quiz')}
                type="button"
              >
                Quiz
              </button>
            </div>
          </div>
        </div>
      </div>

      <SlideViewer slide={slide} mode={mode} immersive />
    </div>
  )
}
