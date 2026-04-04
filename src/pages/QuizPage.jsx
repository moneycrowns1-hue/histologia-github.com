import React, { useEffect, useMemo, useState } from 'react'
import SlideViewer from '../slides/SlideViewer.jsx'
import { getCatalog, subscribeSlides } from '../slides/slides.js'

export default function QuizPage() {
  const [catalog, setCatalog] = useState(() => getCatalog())

  useEffect(() => {
    const unsub = subscribeSlides(() => {
      setCatalog(getCatalog())
    })
    return () => {
      unsub?.()
    }
  }, [])

  const allSlides = useMemo(() => catalog.flatMap((c) => c.items), [catalog])
  const [categoryId, setCategoryId] = useState('all')
  const [questionCount, setQuestionCount] = useState(8)

  const [session, setSession] = useState(null)
  const [confirmExitOpen, setConfirmExitOpen] = useState(false)

  const availableSlides = useMemo(() => {
    if (categoryId === 'all') return allSlides
    const cat = catalog.find((c) => c.id === categoryId)
    return cat ? cat.items : []
  }, [allSlides, categoryId])

  const questions = session?.questions || []
  const index = session?.index ?? 0
  const current = questions[index] || null

  const currentSlide = useMemo(() => {
    if (!current) return null
    return availableSlides.find((s) => s.id === current.slideId) || allSlides.find((s) => s.id === current.slideId) || null
  }, [allSlides, availableSlides, current])

  const currentTarget = useMemo(() => {
    if (!currentSlide || !current) return null
    return currentSlide.hotspots.find((h) => h.id === current.hotspotId) || null
  }, [currentSlide, current])

  function shuffle(arr) {
    const a = [...arr]
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[a[i], a[j]] = [a[j], a[i]]
    }
    return a
  }

  function buildQuestions() {
    const pool = []
    for (const s of availableSlides) {
      for (const h of s.hotspots) {
        pool.push({ slideId: s.id, hotspotId: h.id })
      }
    }
    const pick = shuffle(pool).slice(0, clampCount(questionCount, 1, Math.max(1, pool.length)))
    return pick
  }

  function clampCount(n, min, max) {
    const v = Number.isFinite(Number(n)) ? Number(n) : min
    return Math.max(min, Math.min(max, v))
  }

  function start() {
    const qs = buildQuestions()
    setSession({
      questions: qs,
      index: 0,
      correct: 0,
      answered: []
    })
  }

  function stop() {
    setSession(null)
    setConfirmExitOpen(false)
  }

  function onPickHotspot(hotspot) {
    if (!session || !current || !currentSlide) return
    if (!hotspot) return

    const isCorrect = hotspot.id === current.hotspotId
    const answered = [
      ...session.answered,
      {
        slideId: current.slideId,
        targetHotspotId: current.hotspotId,
        pickedHotspotId: hotspot.id,
        correct: isCorrect
      }
    ]

    const nextIndex = session.index + 1
    setSession({
      ...session,
      correct: session.correct + (isCorrect ? 1 : 0),
      index: nextIndex,
      answered
    })
  }

  const done = session && session.index >= questions.length

  if (allSlides.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-800/60 bg-slate-900/20 p-4 text-sm text-slate-300">
        Aún no hay diapositivas cargadas.
      </div>
    )
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-lg font-semibold">Quiz</div>
          <div className="text-sm text-slate-400">Toca el punto correcto según la pregunta.</div>
        </div>

        {session ? (
          <button
            type="button"
            onClick={() => setConfirmExitOpen(true)}
            className="rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
          >
            Salir
          </button>
        ) : null}
      </div>

      {confirmExitOpen ? (
        <div className="fixed inset-0 z-[200] grid place-items-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-950 p-5 text-white shadow-[0_30px_80px_-50px_rgba(0,0,0,0.9)]">
            <div className="text-lg font-extrabold">¿Salir del quiz?</div>
            <div className="mt-1 text-sm text-slate-300">Perderás el progreso de esta sesión.</div>

            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setConfirmExitOpen(false)}
                className="h-12 rounded-2xl bg-white/10 px-4 text-base font-extrabold text-white transition active:scale-[0.99] hover:bg-white/15"
              >
                No
              </button>
              <button
                type="button"
                onClick={stop}
                className="h-12 rounded-2xl bg-emerald-500 px-4 text-base font-extrabold text-emerald-950 transition active:scale-[0.99] hover:bg-emerald-400"
              >
                Sí, salir
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {!session && (
        <div className="grid gap-3 rounded-2xl border border-slate-800/60 bg-slate-900/20 p-4">
          <div className="grid gap-2 md:grid-cols-3">
            <div className="grid gap-1">
              <div className="text-xs text-slate-500">Categoría</div>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2 text-sm"
              >
                <option value="all">Todas</option>
                {catalog.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-1">
              <div className="text-xs text-slate-500">Preguntas</div>
              <input
                type="number"
                min={1}
                max={50}
                value={questionCount}
                onChange={(e) => setQuestionCount(Number(e.target.value))}
                className="rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2 text-sm"
              />
            </div>

            <div className="grid content-end">
              <button
                type="button"
                onClick={start}
                className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 hover:bg-emerald-400"
              >
                Iniciar
              </button>
            </div>
          </div>
          <div className="text-xs text-slate-500">
            Consejo: empieza con 5–10 preguntas por categoría.
          </div>
        </div>
      )}

      {session && done && (
        <div className="grid gap-3 rounded-2xl border border-slate-800/60 bg-slate-900/20 p-4">
          <div className="text-sm font-semibold">Resultado</div>
          <div className="text-sm text-slate-300">
            Puntaje: <span className="font-semibold text-white">{session.correct}</span> / {questions.length}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={start}
              className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 hover:bg-emerald-400"
            >
              Repetir
            </button>
            <button
              type="button"
              onClick={stop}
              className="rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
            >
              Volver a configuración
            </button>
          </div>
        </div>
      )}

      {session && !done && currentSlide && currentTarget && (
        <div className="grid gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800/60 bg-slate-900/20 p-4">
            <div>
              <div className="text-xs text-slate-500">Pregunta {index + 1} / {questions.length}</div>
              <div className="text-sm font-semibold">Encuentra: {currentTarget.name}</div>
              <div className="mt-1 text-xs text-slate-500">Diapositiva: {currentSlide.title}</div>
            </div>
            <div className="text-sm text-slate-300">
              Correctas: <span className="font-semibold text-white">{session.correct}</span>
            </div>
          </div>

          <SlideViewer slide={currentSlide} mode="quiz" onHotspotSelect={onPickHotspot} showDetail={false} />

          <div className="rounded-2xl border border-slate-800/60 bg-slate-900/20 p-4 text-sm text-slate-300">
            Toca el punto que corresponde a la estructura pedida.
          </div>
        </div>
      )}
    </div>
  )
}
