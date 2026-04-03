import React, { useEffect, useMemo, useRef, useState } from 'react'
import HotspotEditor from '../slides/HotspotEditor.jsx'
import { slides } from '../slides/slides.js'

function safeId(s) {
  return String(s)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-_]/g, '')
}

export default function HotspotEditorPage() {
  const [slideId, setSlideId] = useState(slides[0]?.id)
  const baseSlide = useMemo(() => slides.find((s) => s.id === slideId) || slides[0] || null, [slideId])

  const [draft, setDraft] = useState(null)
  const [saveStatus, setSaveStatus] = useState('')
  const [images, setImages] = useState([])
  const [isSaving, setIsSaving] = useState(false)
  const [isDirty, setIsDirty] = useState(false)

  const autosaveTimerRef = useRef(null)
  const lastSavedTextRef = useRef('')

  const activeSlide = draft && baseSlide && draft.id === baseSlide.id ? draft : baseSlide

  useEffect(() => {
    let alive = true

    async function loadImages() {
      try {
        const res = await fetch('/__slides_manifest')
        const data = await res.json()
        if (!alive) return
        setImages(Array.isArray(data?.images) ? data.images : [])
      } catch {
        if (!alive) return
        setImages([])
      }
    }

    loadImages()

    if (import.meta.hot) {
      import.meta.hot.on('microlab:slides-changed', () => {
        loadImages()
      })
    }

    return () => {
      alive = false
    }
  }, [])

  function ensureDraft() {
    if (!baseSlide) return
    if (draft && draft.id === baseSlide.id) return
    setDraft(JSON.parse(JSON.stringify(baseSlide)))
  }

  function updateSlide(next) {
    setDraft(next)
  }

  function scheduleAutosave(nextSlide) {
    if (!nextSlide) return
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current)
    autosaveTimerRef.current = setTimeout(async () => {
      await saveNow(nextSlide, true)
    }, 600)
  }

  async function saveNow(slide, isAuto) {
    if (!slide) return
    const text = JSON.stringify(slide, null, 2)
    if (text === lastSavedTextRef.current) {
      if (!isAuto) setSaveStatus('Sin cambios para guardar.')
      return
    }

    try {
      setIsSaving(true)
      setSaveStatus(isAuto ? 'Guardando…' : 'Guardando…')
      const res = await fetch('/__editor_save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slideId: slide.id, slide })
      })
      const data = await res.json().catch(() => ({}))
      if (data?.ok) {
        lastSavedTextRef.current = text
        setIsDirty(false)
        setSaveStatus(isAuto ? 'Guardado automático (overrides.json)' : 'Guardado (overrides.json)')
      } else {
        setSaveStatus(`No se pudo guardar: ${data?.error || 'error'}`)
      }
    } catch {
      setSaveStatus('No se pudo guardar (¿estás en npm run dev?)')
    } finally {
      setIsSaving(false)
    }
  }

  async function getNaturalSize(url) {
    try {
      const img = new Image()
      img.src = url
      if (img.decode) await img.decode()
      if (img.naturalWidth && img.naturalHeight) return { width: img.naturalWidth, height: img.naturalHeight }
    } catch {
      // ignore
    }
    return null
  }

  function setSlideImages(url) {
    ensureDraft()

    setDraft((prev) => {
      const s = prev && baseSlide && prev.id === baseSlide.id ? prev : JSON.parse(JSON.stringify(baseSlide))
      const next = {
        ...s,
        imageUrl: url,
        thumbnailUrl: url
      }
      scheduleAutosave(next)
      return next
    })

    ;(async () => {
      const size = await getNaturalSize(url)
      if (!size) return

      setDraft((prev) => {
        const s = prev && baseSlide && prev.id === baseSlide.id ? prev : JSON.parse(JSON.stringify(baseSlide))
        const next = {
          ...s,
          imageUrl: url,
          thumbnailUrl: url,
          naturalSize: size
        }
        scheduleAutosave(next)
        return next
      })
    })()
  }

  function addHotspotAt(x, y) {
    ensureDraft()
    setDraft((prev) => {
      const s = prev && baseSlide && prev.id === baseSlide.id ? prev : JSON.parse(JSON.stringify(baseSlide))
      const nextIndex = (s.hotspots?.length || 0) + 1
      const id = `hs-${safeId(s.id)}-${nextIndex}`
      const next = {
        ...s,
        hotspots: [
          ...(s.hotspots || []),
          {
            id,
            x,
            y,
            name: `Estructura ${nextIndex}`,
            description: '',
            function: ''
          }
        ]
      }
      scheduleAutosave(next)
      return next
    })
  }

  const exportText = useMemo(() => {
    if (!activeSlide) return ''
    return JSON.stringify(activeSlide, null, 2)
  }, [activeSlide])

  useEffect(() => {
    setIsDirty(exportText !== lastSavedTextRef.current)
  }, [exportText])

  useEffect(() => {
    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current)
    }
  }, [])

  function downloadJSON() {
    if (!activeSlide) return
    const filename = `slide-${activeSlide.id}.json`
    const blob = new Blob([exportText], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
    setSaveStatus(`Descargado: ${filename}`)
  }

  async function saveToFile() {
    if (!activeSlide) return
    const api = window.showSaveFilePicker
    if (!api) {
      setSaveStatus('Tu navegador no soporta guardado directo. Usa Descargar.')
      return
    }

    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: `slide-${activeSlide.id}.json`,
        types: [
          {
            description: 'JSON',
            accept: { 'application/json': ['.json'] }
          }
        ]
      })
      const writable = await handle.createWritable()
      await writable.write(exportText)
      await writable.close()
      setSaveStatus('Guardado en archivo seleccionado.')
    } catch {
      setSaveStatus('Guardado cancelado o falló.')
    }
  }

  async function copyExport() {
    try {
      await navigator.clipboard.writeText(exportText)
    } catch {
      // ignore
    }
  }

  if (!baseSlide) {
    return (
      <div className="rounded-2xl border border-slate-800/60 bg-slate-900/20 p-4 text-sm text-slate-300">
        No hay diapositivas cargadas.
      </div>
    )
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-lg font-semibold">Editor de hotspots</div>
          <div className="text-sm text-slate-400">
            Toca/clic en la imagen para crear un punto. Selecciona un punto para editarlo y arrástralo para ajustar su posición.
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={baseSlide.id}
            onChange={(e) => {
              setSlideId(e.target.value)
              setDraft(null)
            }}
            className="rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2 text-sm"
          >
            {slides.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => {
              ensureDraft()
            }}
            className="rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
          >
            Editar
          </button>

          <button
            type="button"
            disabled={!activeSlide || isSaving || !isDirty}
            onClick={() => {
              ensureDraft()
              const s = draft && baseSlide && draft.id === baseSlide.id ? draft : activeSlide
              saveNow(s, false)
            }}
            className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${
              !activeSlide || isSaving || !isDirty
                ? 'bg-slate-900/50 text-slate-500 ring-1 ring-slate-800'
                : 'bg-emerald-500 text-emerald-950 hover:bg-emerald-400'
            }`}
            title={isDirty ? 'Guardar cambios' : 'Sin cambios'}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M5 3h12l2 2v16a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinejoin="round"
              />
              <path d="M7 3v6h10V3" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
              <path d="M7 21v-8h10v8" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
            </svg>
            Guardar
          </button>

          <button
            type="button"
            onClick={() => {
              setDraft(null)
            }}
            className="rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
          >
            Reset
          </button>
        </div>
      </div>

      <div className="grid gap-3 rounded-2xl border border-slate-800/60 bg-slate-900/20 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-sm font-semibold">Datos de la diapositiva</div>
            <div className="text-xs text-slate-500">El campo "topic" controla la categoría de Biblioteca (ej: "Tejidos · Conectivo").</div>
          </div>
        </div>

        <div className="grid gap-2">
          <div className="text-xs text-slate-500">Título</div>
          <input
            value={activeSlide?.title || ''}
            onChange={(e) => {
              ensureDraft()
              setDraft((prev) => {
                const s = prev && baseSlide && prev.id === baseSlide.id ? prev : JSON.parse(JSON.stringify(baseSlide))
                const next = { ...s, title: e.target.value }
                scheduleAutosave(next)
                return next
              })
            }}
            className="rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2 text-sm"
          />

          <div className="text-xs text-slate-500">Topic (categoría)</div>
          <input
            value={activeSlide?.topic || ''}
            onChange={(e) => {
              ensureDraft()
              setDraft((prev) => {
                const s = prev && baseSlide && prev.id === baseSlide.id ? prev : JSON.parse(JSON.stringify(baseSlide))
                const next = { ...s, topic: e.target.value }
                scheduleAutosave(next)
                return next
              })
            }}
            placeholder="Tejidos · Conectivo"
            className="rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2 text-sm placeholder:text-slate-600"
          />

          <div className="text-xs text-slate-500">Descripción</div>
          <textarea
            value={activeSlide?.description || ''}
            onChange={(e) => {
              ensureDraft()
              setDraft((prev) => {
                const s = prev && baseSlide && prev.id === baseSlide.id ? prev : JSON.parse(JSON.stringify(baseSlide))
                const next = { ...s, description: e.target.value }
                scheduleAutosave(next)
                return next
              })
            }}
            className="h-20 resize-none rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="grid gap-3 rounded-2xl border border-slate-800/60 bg-slate-900/20 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-sm font-semibold">Imágenes en public/slides</div>
            <div className="text-xs text-slate-500">
              Selecciona una imagen para asignarla a la diapositiva. {images.length ? `${images.length} encontrada(s).` : 'No se detectaron imágenes.'}
            </div>
          </div>
          <div className="text-xs text-slate-500">
            {isSaving ? 'Guardando…' : isDirty ? 'Cambios sin guardar' : 'Guardado'}
          </div>
        </div>

        {images.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {images.map((url) => (
              <button
                key={url}
                type="button"
                onClick={() => setSlideImages(url)}
                className={`group overflow-hidden rounded-2xl border bg-slate-950/30 text-left transition hover:bg-slate-950/50 ${
                  activeSlide?.imageUrl === url ? 'border-emerald-400/60' : 'border-slate-800/60'
                }`}
              >
                <div className="relative aspect-[16/10]">
                  <img src={url} alt={url} className="absolute inset-0 h-full w-full object-cover" draggable={false} loading="lazy" />
                  <div className="absolute inset-x-0 bottom-0 h-[70%] bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-3">
                    <div className="text-xs font-semibold text-white line-clamp-2 drop-shadow-sm">
                      {url.replace('/slides/', '')}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="text-sm text-slate-300">
            Coloca archivos en <code>public/slides</code> (png/jpg/webp/svg) y el menú se llenará automáticamente.
          </div>
        )}
      </div>

      <HotspotEditor
        slide={activeSlide}
        onChange={(next) => {
          updateSlide(next)
          scheduleAutosave(next)
        }}
        onAddHotspot={addHotspotAt}
      />

      <div className="grid gap-2 rounded-2xl border border-slate-800/60 bg-slate-900/20 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm font-semibold">Exportar JSON</div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={copyExport}
              className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 hover:bg-emerald-400"
            >
              Copiar
            </button>
            <button
              type="button"
              onClick={downloadJSON}
              className="rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
            >
              Descargar
            </button>
            <button
              type="button"
              onClick={saveToFile}
              className="rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
            >
              Guardar en archivo
            </button>
          </div>
        </div>
        {saveStatus ? <div className="text-xs text-slate-500">{saveStatus}</div> : null}
        <textarea
          value={exportText}
          readOnly
          className="h-56 w-full resize-none rounded-xl border border-slate-800 bg-slate-950/40 p-3 text-xs text-slate-200"
        />
        <div className="text-xs text-slate-500">
          Pega este objeto dentro de <code>src/slides/slides.js</code> (en el item correspondiente) para guardar los hotspots.
        </div>
      </div>
    </div>
  )
}
