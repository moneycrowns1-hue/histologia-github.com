import React, { useEffect, useMemo, useRef, useState } from 'react'
import HotspotEditor from '../slides/HotspotEditor.jsx'
import { getSlides, subscribeSlides } from '../slides/slides.js'
import { getSavedImageBlob, idbUrlToKey, isIdbUrl } from '../utils/localImages.js'
import { useSearchParams } from 'react-router-dom'
import {
  cloudIsReady,
  cloudGetUser,
  cloudListSlides,
  cloudUpsertSlide
} from '../utils/supabaseSync.js'

function safeId(s) {
  return String(s)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-_]/g, '')
}

export default function HotspotEditorPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [allSlides, setAllSlides] = useState(() => getSlides())

  const [slideId, setSlideId] = useState(() => searchParams.get('slide') || allSlides[0]?.id)
  const baseSlide = useMemo(() => allSlides.find((s) => s.id === slideId) || allSlides[0] || null, [allSlides, slideId])

  const [draft, setDraft] = useState(null)
  const [saveStatus, setSaveStatus] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isDirty, setIsDirty] = useState(false)

  const [cloudReady, setCloudReady] = useState(false)
  const [isEditor, setIsEditor] = useState(false)

  const autosaveTimerRef = useRef(null)
  const lastSavedTextRef = useRef('')

  const activeSlide = draft && baseSlide && draft.id === baseSlide.id ? draft : baseSlide

  useEffect(() => {
    let alive = true

    const unsubSlides = subscribeSlides(() => {
      const next = getSlides()
      if (!alive) return
      setAllSlides(next)
    })

    cloudIsReady()
      .then((ready) => {
        if (!alive) return
        setCloudReady(Boolean(ready))
      })
      .catch(() => {
        if (!alive) return
        setCloudReady(false)
      })

    cloudGetUser()
      .then((u) => {
        if (!alive) return
        const role = String(u?.user_metadata?.role || '').trim().toLowerCase()
        setIsEditor(role === 'editor')
      })
      .catch(() => {
        if (!alive) return
        setIsEditor(false)
      })

    return () => {
      alive = false
      unsubSlides?.()
    }
  }, [])

  useEffect(() => {
    const requested = searchParams.get('slide')
    if (!requested) return
    if (requested === slideId) return
    setSlideId(requested)
    setDraft(null)
  }, [searchParams, slideId])

  useEffect(() => {
    if (!slideId) return
    const current = searchParams.get('slide')
    if (current === slideId) return
    setSearchParams({ slide: slideId }, { replace: true })
  }, [searchParams, setSearchParams, slideId])

  async function cloudUploadActive() {
    if (!isEditor) {
      setSaveStatus('No tienes permiso para usar la nube. Cambia tu rol a Editor en Perfil.')
      return
    }
    if (!cloudReady) {
      setSaveStatus('Configura Supabase (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).')
      return
    }
    if (!activeSlide) return

    try {
      setIsSaving(true)
      setSaveStatus('Subiendo a la nube…')
      const uploaded = await cloudUpsertSlide(activeSlide)
      saveLocalSlide(uploaded)
      setSaveStatus('Guardado en la nube.')
    } catch (e) {
      setSaveStatus(`No se pudo guardar en la nube: ${e?.message || 'error'}`)
    } finally {
      setIsSaving(false)
    }
  }

  async function cloudImportSlides() {
    if (!isEditor) {
      setSaveStatus('No tienes permiso para usar la nube. Cambia tu rol a Editor en Perfil.')
      return
    }
    if (!cloudReady) {
      setSaveStatus('Configura Supabase (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).')
      return
    }

    try {
      setIsSaving(true)
      setSaveStatus('Importando desde la nube…')
      const cloudSlides = await cloudListSlides()
      const raw = localStorage.getItem('microlab:local_slides')
      const prev = raw ? JSON.parse(raw) : []
      const arr = Array.isArray(prev) ? prev : []
      const map = new Map()
      for (const s of arr) if (s && typeof s === 'object' && typeof s.id === 'string') map.set(s.id, s)
      for (const s of cloudSlides) map.set(s.id, s)
      const next = Array.from(map.values())
      localStorage.setItem('microlab:local_slides', JSON.stringify(next))
      setSaveStatus('Importado. Recargando…')
      window.location.reload()
    } catch (e) {
      setSaveStatus(`No se pudo importar desde la nube: ${e?.message || 'error'}`)
    } finally {
      setIsSaving(false)
    }
  }

  function saveLocalSlide(slide) {
    try {
      const raw = localStorage.getItem('microlab:local_slides')
      const prev = raw ? JSON.parse(raw) : []
      const arr = Array.isArray(prev) ? prev : []
      const next = [...arr.filter((s) => s?.id !== slide.id), slide]
      localStorage.setItem('microlab:local_slides', JSON.stringify(next))
      setLocalSlidesList(next)
      try {
        window.dispatchEvent(new Event('microlab:slides-updated'))
      } catch {
        // ignore
      }
    } catch {
      // ignore
    }
  }

  function saveLocalOverride(slide) {
    try {
      const raw = localStorage.getItem('microlab:overrides_local')
      const prev = raw ? JSON.parse(raw) : {}
      const obj = prev && typeof prev === 'object' ? prev : {}
      obj[slide.id] = slide
      localStorage.setItem('microlab:overrides_local', JSON.stringify(obj))
      try {
        window.dispatchEvent(new Event('microlab:slides-updated'))
      } catch {
        // ignore
      }
    } catch {
      // ignore
    }
  }

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
      try {
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
          return
        }
        setSaveStatus(`No se pudo guardar: ${data?.error || 'error'}`)
      } catch {
        // Fallback (GitHub Pages / iPad): persistir localmente.
        saveLocalOverride(slide)
        lastSavedTextRef.current = text
        setIsDirty(false)
        setSaveStatus(isAuto ? 'Guardado automático (local)' : 'Guardado (local)')
      }
    } catch {
      setSaveStatus('No se pudo guardar')
    } finally {
      setIsSaving(false)
    }
  }

  async function getNaturalSize(url) {
    try {
      let src = url
      let tempObjectUrl = null

      if (isIdbUrl(url)) {
        const key = idbUrlToKey(url)
        if (key) {
          const blob = await getSavedImageBlob(key)
          if (blob) {
            tempObjectUrl = URL.createObjectURL(blob)
            src = tempObjectUrl
          }
        }
      }

      const img = new Image()
      img.src = src
      if (img.decode) await img.decode()
      if (img.naturalWidth && img.naturalHeight) return { width: img.naturalWidth, height: img.naturalHeight }
    } catch {
      // ignore
    } finally {
      try {
        if (tempObjectUrl) URL.revokeObjectURL(tempObjectUrl)
      } catch {
        // ignore
      }
    }
    return null
  }

  function resetToEmpty() {
    if (!baseSlide) return
    const cleared = {
      ...baseSlide,
      title: baseSlide.title || '',
      topic: baseSlide.topic || '',
      description: '',
      hotspots: []
    }
    saveLocalOverride(cleared)
    setDraft(null)
    setSaveStatus('Reset: hotspots y descripción borrados.')
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
              resetToEmpty()
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

      <HotspotEditor
        slide={activeSlide}
        onChange={(next) => {
          updateSlide(next)
          scheduleAutosave(next)
        }}
        onAddHotspot={addHotspotAt}
      />

      {saveStatus ? <div className="text-xs text-slate-500">{saveStatus}</div> : null}
    </div>
  )
}
