import React, { useEffect, useMemo, useRef, useState } from 'react'
import SlideViewer from '../slides/SlideViewer.jsx'
import { getCatalog, subscribeSlides } from '../slides/slides.js'
import { pushNotification } from '../notifications/notifications.js'

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

  const [quizMode, setQuizMode] = useState('point')

  const [session, setSession] = useState(null)
  const [confirmExitOpen, setConfirmExitOpen] = useState(false)

  const [medicalSession, setMedicalSession] = useState(null)
  const [medicalAnswer, setMedicalAnswer] = useState(null)
  const [medicalReveal, setMedicalReveal] = useState('')

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

  function startMedical() {
    const qs = buildQuestions()
    setMedicalSession({
      questions: qs,
      index: 0,
      correct: 0,
      answered: []
    })
    setMedicalAnswer(null)
    setMedicalReveal('')
  }

  function stop() {
    setSession(null)
    setConfirmExitOpen(false)
  }

  function stopMedical() {
    setMedicalSession(null)
    setMedicalAnswer(null)
    setMedicalReveal('')
    setConfirmExitOpen(false)
  }

  function shuffle4(arr) {
    return shuffle(arr).slice(0, 4)
  }

  function buildMedicalOptions(target, slide) {
    if (!target || !slide) return []
    const poolSame = (slide.hotspots || []).filter((h) => h?.id && h.id !== target.id && h?.name)
    const poolGlobal = allSlides
      .flatMap((s) => (s.hotspots || []).map((h) => ({ ...h, __slideId: s.id })))
      .filter((h) => h?.id && h.id !== target.id && h?.name)

    const distractors = shuffle(poolSame.length >= 3 ? poolSame : poolGlobal).slice(0, 3)
    const opts = shuffle([
      { id: target.id, label: target.name, correct: true },
      ...distractors.map((h) => ({ id: h.id, label: h.name, correct: false }))
    ])
    const letters = ['A', 'B', 'C', 'D']
    return opts.slice(0, 4).map((o, i) => ({ ...o, letter: letters[i] }))
  }

  const activeMedical = medicalSession != null
  const medicalQuestions = medicalSession?.questions || []
  const medicalIndex = medicalSession?.index ?? 0
  const medicalCurrent = medicalQuestions[medicalIndex] || null
  const medicalDone = activeMedical && medicalIndex >= medicalQuestions.length

  const medicalSlide = useMemo(() => {
    if (!medicalCurrent) return null
    return availableSlides.find((s) => s.id === medicalCurrent.slideId) || allSlides.find((s) => s.id === medicalCurrent.slideId) || null
  }, [allSlides, availableSlides, medicalCurrent])

  const medicalTarget = useMemo(() => {
    if (!medicalSlide || !medicalCurrent) return null
    return medicalSlide.hotspots.find((h) => h.id === medicalCurrent.hotspotId) || null
  }, [medicalSlide, medicalCurrent])

  const medicalOptions = useMemo(() => {
    return buildMedicalOptions(medicalTarget, medicalSlide)
  }, [medicalTarget?.id, medicalSlide?.id])

  function pickMedical(opt) {
    if (!medicalSession || !medicalCurrent || !medicalTarget) return
    if (medicalAnswer) return
    const isCorrect = Boolean(opt?.correct)
    setMedicalAnswer({ ...opt, isCorrect })
    setMedicalReveal(isCorrect ? 'correct' : 'incorrect')

    const answered = [
      ...medicalSession.answered,
      {
        slideId: medicalCurrent.slideId,
        targetHotspotId: medicalCurrent.hotspotId,
        pickedHotspotId: opt?.id,
        correct: isCorrect
      }
    ]
    setMedicalSession({
      ...medicalSession,
      correct: medicalSession.correct + (isCorrect ? 1 : 0),
      answered
    })
  }

  function nextMedical() {
    if (!medicalSession) return
    const nextIndex = medicalSession.index + 1
    setMedicalSession({ ...medicalSession, index: nextIndex })
    setMedicalAnswer(null)
    setMedicalReveal('')
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

  const pointResultNotifiedRef = useRef(false)
  const medicalResultNotifiedRef = useRef(false)

  useEffect(() => {
    if (!session || !done) {
      pointResultNotifiedRef.current = false
      return
    }
    if (pointResultNotifiedRef.current) return
    pointResultNotifiedRef.current = true

    pushNotification({
      type: 'success',
      title: 'Quiz completado',
      message: `Identificar Punto: ${session.correct} / ${questions.length}`,
      meta: { mode: 'point', correct: session.correct, total: questions.length }
    })
  }, [done, questions.length, session])

  useEffect(() => {
    if (!medicalSession || !medicalDone) {
      medicalResultNotifiedRef.current = false
      return
    }
    if (medicalResultNotifiedRef.current) return
    medicalResultNotifiedRef.current = true

    pushNotification({
      type: 'success',
      title: 'Medical Quiz completado',
      message: `Resultado: ${medicalSession.correct} / ${medicalQuestions.length}`,
      meta: { mode: 'medical', correct: medicalSession.correct, total: medicalQuestions.length }
    })
  }, [medicalDone, medicalQuestions.length, medicalSession])

  if (allSlides.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-800/60 bg-slate-900/20 p-4 text-sm text-slate-300">
        Aún no hay diapositivas cargadas.
      </div>
    )
  }

  return (
    <div className="grid gap-4">
      <style>{`
        @keyframes microlabGlassIn {
          from { opacity: 0; transform: translateY(10px) scale(0.985); }
          to { opacity: 1; transform: translateY(0px) scale(1); }
        }
        @keyframes microlabPulseSoft {
          0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(34,211,238,0.25); }
          70% { transform: scale(1.03); box-shadow: 0 0 0 14px rgba(34,211,238,0); }
          100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(34,211,238,0); }
        }
        @keyframes microlabFeedbackIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0px); }
        }
        .microlab-next-pulse { animation: microlabPulseSoft 1300ms ease-in-out infinite; }
      `}</style>
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
                onClick={() => {
                  if (quizMode === 'medical') startMedical()
                  else start()
                }}
                className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 hover:bg-emerald-400"
              >
                Iniciar
              </button>
            </div>
          </div>

          <div className="grid gap-2 md:grid-cols-2">
            <button
              type="button"
              onClick={() => setQuizMode('point')}
              className={`rounded-xl px-4 py-3 text-left text-sm font-semibold transition ${
                quizMode === 'point' ? 'bg-white/10 text-white ring-1 ring-white/20' : 'bg-black/20 text-slate-300 hover:bg-white/5'
              }`}
              style={{ animation: 'microlabGlassIn 200ms ease-out both' }}
            >
              <div className="text-xs font-semibold tracking-[0.22em] text-slate-500">MODO</div>
              <div className="mt-1 text-base font-extrabold">Identificar Punto</div>
              <div className="mt-1 text-xs text-slate-400">Tu modo actual: toca el punto correcto en la imagen.</div>
            </button>
            <button
              type="button"
              onClick={() => setQuizMode('medical')}
              className={`rounded-xl px-4 py-3 text-left text-sm font-semibold transition ${
                quizMode === 'medical' ? 'bg-white/10 text-white ring-1 ring-cyan-300/25' : 'bg-black/20 text-slate-300 hover:bg-white/5'
              }`}
              style={{ animation: 'microlabGlassIn 200ms ease-out both' }}
            >
              <div className="text-xs font-semibold tracking-[0.22em] text-slate-500">NUEVO</div>
              <div className="mt-1 text-base font-extrabold">Medical Quiz 2026</div>
              <div className="mt-1 text-xs text-slate-400">Pin “?” + opciones A-D con glassmorphism + feedback premium.</div>
            </button>
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

      {activeMedical && medicalDone && (
        <div className="grid gap-3 rounded-2xl border border-slate-800/60 bg-slate-900/20 p-4">
          <div className="text-sm font-semibold">Resultado</div>
          <div className="text-sm text-slate-300">
            Puntaje: <span className="font-semibold text-white">{medicalSession.correct}</span> / {medicalQuestions.length}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={startMedical}
              className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 hover:bg-emerald-400"
            >
              Repetir
            </button>
            <button
              type="button"
              onClick={stopMedical}
              className="rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
            >
              Volver a configuración
            </button>
          </div>
        </div>
      )}

      {activeMedical && !medicalDone && medicalSlide && medicalTarget && (
        <div className="grid gap-3 lg:grid-cols-[520px_1fr]">
          <div className="relative overflow-hidden rounded-2xl border border-slate-800/60 bg-slate-900/20">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/60 p-4">
              <div>
                <div className="text-xs text-slate-500">Pregunta {medicalIndex + 1} / {medicalQuestions.length}</div>
                <div className="text-sm font-semibold">Identifica la estructura</div>
                <div className="mt-1 text-xs text-slate-500">Diapositiva: {medicalSlide.title}</div>
              </div>
              <div className="text-sm text-slate-300">
                Correctas: <span className="font-semibold text-white">{medicalSession.correct}</span>
              </div>
            </div>

            <div className="relative h-[46vh]">
              <SlideViewer
                slide={medicalSlide}
                mode="study"
                immersive={false}
                showDetail={false}
                showHotspots={false}
                focusTarget={{ x: medicalTarget.x, y: medicalTarget.y, scale: 2.8 }}
                overlayPin={{
                  x: medicalTarget.x,
                  y: medicalTarget.y,
                  state: medicalReveal ? (medicalReveal === 'correct' ? 'correct' : 'incorrect') : 'pulse'
                }}
              />
            </div>
          </div>

          <div className="grid gap-3">
            <div
              className="rounded-2xl border border-white/10 bg-black/30 p-5 backdrop-blur-md"
              style={{
                background: 'linear-gradient(180deg, rgba(15,23,42,0.55), rgba(2,6,23,0.55))',
                boxShadow: '0 0 0 1px rgba(255,255,255,0.06), 0 30px 80px -50px rgba(0,0,0,0.9)'
              }}
            >
              <div className="text-xs font-semibold tracking-[0.22em] text-slate-500">OPCIONES</div>
              <div className="mt-3 grid gap-3">
                {medicalOptions.map((opt) => {
                  const picked = medicalAnswer?.id === opt.id
                  const locked = Boolean(medicalAnswer)
                  const isCorrectPick = picked && medicalAnswer?.isCorrect
                  const isWrongPick = picked && !medicalAnswer?.isCorrect

                  const baseRing = picked
                    ? isCorrectPick
                      ? 'ring-emerald-400/35'
                      : isWrongPick
                        ? 'ring-rose-400/35'
                        : 'ring-cyan-300/25'
                    : 'ring-white/10'

                  const baseBg = picked
                    ? isCorrectPick
                      ? 'bg-emerald-500/15'
                      : isWrongPick
                        ? 'bg-rose-500/15'
                        : 'bg-cyan-500/10'
                    : 'bg-white/5'

                  return (
                    <button
                      key={opt.letter}
                      type="button"
                      disabled={locked}
                      onClick={() => pickMedical(opt)}
                      className={`group w-full rounded-2xl px-5 py-5 text-left transition ${
                        locked ? 'opacity-90' : 'hover:bg-white/7 active:scale-[0.99]'
                      } ring-1 ${baseRing} ${baseBg}`}
                      style={{
                        backdropFilter: 'blur(10px)',
                        WebkitBackdropFilter: 'blur(10px)'
                      }}
                    >
                      <div className="flex items-start gap-3">
                        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-black/40 text-base font-extrabold text-cyan-100 ring-1 ring-white/10">
                          {opt.letter}
                        </div>
                        <div className="min-w-0">
                          <div className="text-base font-semibold text-white transition group-hover:text-white">
                            {opt.label}
                          </div>
                          <div className="mt-1 text-sm text-slate-300">Selecciona la mejor respuesta.</div>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>

              {medicalReveal ? (
                <div
                  className={`mt-3 rounded-2xl px-4 py-3 text-sm font-semibold ring-1`}
                  style={{
                    animation: 'microlabFeedbackIn 180ms ease-out both',
                    background: medicalReveal === 'correct' ? 'rgba(16,185,129,0.12)' : 'rgba(225,29,72,0.12)',
                    borderColor: medicalReveal === 'correct' ? 'rgba(16,185,129,0.28)' : 'rgba(225,29,72,0.28)',
                    color: medicalReveal === 'correct' ? 'rgb(167 243 208)' : 'rgb(253 164 175)'
                  }}
                >
                  {medicalReveal === 'correct' ? 'Correcto' : 'Incorrecto'}
                </div>
              ) : null}

              <button
                type="button"
                disabled={!medicalAnswer}
                onClick={nextMedical}
                className={`mt-3 w-full rounded-2xl px-4 py-3 text-base font-extrabold transition active:scale-[0.99] ${
                  medicalAnswer
                    ? 'bg-cyan-400 text-slate-950 hover:bg-cyan-300 microlab-next-pulse'
                    : 'bg-white/10 text-slate-500'
                }`}
              >
                Siguiente
              </button>

              <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-3">
                <div className="flex gap-1.5">
                  {medicalQuestions.map((_, i) => {
                    const doneSeg = i < medicalIndex
                    const activeSeg = i === medicalIndex
                    return (
                      <div
                        key={i}
                        className="h-2 flex-1 rounded-full"
                        style={{
                          background: doneSeg
                            ? 'linear-gradient(90deg, rgba(34,211,238,0.95), rgba(56,189,248,0.75))'
                            : activeSeg
                              ? 'linear-gradient(90deg, rgba(34,211,238,0.35), rgba(56,189,248,0.25))'
                              : 'rgba(255,255,255,0.06)',
                          boxShadow: doneSeg
                            ? '0 0 0 1px rgba(34,211,238,0.18), 0 0 18px rgba(34,211,238,0.25)'
                            : '0 0 0 1px rgba(255,255,255,0.06)'
                        }}
                      />
                    )
                  })}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={stopMedical}
              className="rounded-2xl bg-slate-900/40 px-4 py-3 text-sm font-semibold text-slate-200 ring-1 ring-slate-800/60 hover:bg-slate-900/60"
            >
              Salir del modo Medical
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
