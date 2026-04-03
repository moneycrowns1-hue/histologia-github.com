import React, { useEffect, useMemo, useRef, useState } from 'react'
import HotspotEditor from '../slides/HotspotEditor.jsx'
import { slides } from '../slides/slides.js'
import useResolvedImageUrl from '../utils/useResolvedImageUrl.js'
import { getSavedImageBlob, idbUrlToKey, isIdbUrl, listSavedImages, saveImageFile } from '../utils/localImages.js'
import {
  cloudGetUser,
  cloudIsReady,
  cloudListSlides,
  cloudOnAuthStateChange,
  cloudSendLoginEmail,
  cloudSignOut,
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
  const [localSlidesList, setLocalSlidesList] = useState(() => {
    try {
      const raw = localStorage.getItem('microlab:local_slides')
      const arr = raw ? JSON.parse(raw) : []
      return Array.isArray(arr) ? arr.filter((s) => s && typeof s === 'object' && typeof s.id === 'string') : []
    } catch {
      return []
    }
  })

  const allSlides = useMemo(() => {
    const map = new Map()
    for (const s of slides) map.set(s.id, s)
    for (const s of localSlidesList) map.set(s.id, s)
    return Array.from(map.values())
  }, [localSlidesList])

  const [slideId, setSlideId] = useState(allSlides[0]?.id)
  const baseSlide = useMemo(() => allSlides.find((s) => s.id === slideId) || allSlides[0] || null, [allSlides, slideId])

  const [draft, setDraft] = useState(null)
  const [saveStatus, setSaveStatus] = useState('')
  const [images, setImages] = useState([])
  const [localImages, setLocalImages] = useState([])
  const [isSaving, setIsSaving] = useState(false)
  const [isDirty, setIsDirty] = useState(false)

  const [cloudReady, setCloudReady] = useState(false)
  const [cloudUser, setCloudUser] = useState(null)
  const [cloudEmail, setCloudEmail] = useState('')

  const fileInputRef = useRef(null)
  const uploadModeRef = useRef('new')

  const autosaveTimerRef = useRef(null)
  const lastSavedTextRef = useRef('')

  const activeSlide = draft && baseSlide && draft.id === baseSlide.id ? draft : baseSlide

  useEffect(() => {
    let alive = true

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
        setCloudUser(u)
      })
      .catch(() => {
        if (!alive) return
        setCloudUser(null)
      })

    const unsubscribe = cloudOnAuthStateChange((u) => {
      if (!alive) return
      setCloudUser(u)
    })

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

    async function loadLocalImages() {
      try {
        const items = await listSavedImages()
        if (!alive) return
        setLocalImages(items)
      } catch {
        if (!alive) return
        setLocalImages([])
      }
    }

    loadImages()
    loadLocalImages()

    if (import.meta.hot) {
      import.meta.hot.on('microlab:slides-changed', () => {
        loadImages()
      })
    }

    return () => {
      alive = false
      unsubscribe?.()
    }
  }, [])

  async function cloudLogin() {
    if (!cloudReady) {
      setSaveStatus('Configura Supabase (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).')
      return
    }

    const email = String(cloudEmail || '').trim()
    if (!email || !email.includes('@')) {
      setSaveStatus('Ingresa un email válido.')
      return
    }

    try {
      setIsSaving(true)
      setSaveStatus('Enviando link/código al email…')
      const redirectTo = `${window.location.origin}${window.location.pathname}#/editor`
      await cloudSendLoginEmail(email, redirectTo)
      setSaveStatus('Listo. Revisa tu correo y abre el link para iniciar sesión.')
    } catch (e) {
      setSaveStatus(`No se pudo enviar el login: ${e?.message || 'error'}`)
    } finally {
      setIsSaving(false)
    }
  }

  async function cloudLogout() {
    if (!cloudReady) return
    try {
      setIsSaving(true)
      await cloudSignOut()
      setCloudUser(null)
      setSaveStatus('Sesión cerrada.')
    } catch (e) {
      setSaveStatus(`No se pudo cerrar sesión: ${e?.message || 'error'}`)
    } finally {
      setIsSaving(false)
    }
  }

  async function cloudUploadActive() {
    if (!cloudReady) {
      setSaveStatus('Configura Supabase (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).')
      return
    }
    if (!cloudUser) {
      setSaveStatus('Inicia sesión (email) para usar la nube.')
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
    if (!cloudReady) {
      setSaveStatus('Configura Supabase (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).')
      return
    }
    if (!cloudUser) {
      setSaveStatus('Inicia sesión (email) para usar la nube.')
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

  async function onUploadFiles(fileList) {
    const files = Array.from(fileList || []).filter(Boolean)
    if (!files.length) return

    setSaveStatus('Subiendo imagen…')
    try {
      const file = files[0]
      const saved = await saveImageFile(file)

      setLocalImages(await listSavedImages())

      if (uploadModeRef.current === 'replace') {
        setSlideImages(saved.url)
        setSaveStatus('Imagen reemplazada. Ahora puedes agregar hotspots.')
        return
      }

      const nextId = `subida-${Date.now()}`
      const nextSlide = {
        id: nextId,
        title: file.name?.replace(/\.[^.]+$/, '') || 'Nueva diapositiva',
        topic: 'Subidas',
        tags: [],
        difficulty: 1,
        description: '',
        imageUrl: saved.url,
        thumbnailUrl: saved.url,
        naturalSize: { width: 1, height: 1 },
        hotspots: []
      }

      saveLocalSlide(nextSlide)

      setSlideId(nextSlide.id)
      setDraft(nextSlide)
      lastSavedTextRef.current = JSON.stringify(nextSlide, null, 2)
      setIsDirty(false)
      setSaveStatus('Imagen subida. Edita y agrega hotspots.')
    } catch {
      setSaveStatus('No se pudo subir la imagen (¿Safari con modo privado?)')
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function ImageTile({ url, label, selected, onSelect }) {
    const resolved = useResolvedImageUrl(url)

    return (
      <button
        type="button"
        onClick={onSelect}
        className={`group overflow-hidden rounded-2xl border bg-slate-950/30 text-left transition hover:bg-slate-950/50 ${
          selected ? 'border-emerald-400/60' : 'border-slate-800/60'
        }`}
      >
        <div className="relative aspect-[16/10]">
          {resolved ? (
            <img src={resolved} alt={label} className="absolute inset-0 h-full w-full object-cover" draggable={false} loading="lazy" />
          ) : (
            <div className="absolute inset-0 animate-pulse bg-white/5" />
          )}
          <div className="absolute inset-x-0 bottom-0 h-[70%] bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-3">
            <div className="text-xs font-semibold text-white line-clamp-2 drop-shadow-sm">{label}</div>
          </div>
        </div>
      </button>
    )
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
            {allSlides.map((s) => (
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

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => onUploadFiles(e.target.files)}
          />

          <button
            type="button"
            onClick={() => {
              uploadModeRef.current = 'new'
              fileInputRef.current?.click()
            }}
            className="rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
          >
            Subir (nueva)
          </button>

          <button
            type="button"
            disabled={!activeSlide}
            onClick={() => {
              uploadModeRef.current = 'replace'
              fileInputRef.current?.click()
            }}
            className={`rounded-xl px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 ${
              !activeSlide ? 'bg-slate-900/50 text-slate-500 ring-1 ring-slate-800' : 'bg-slate-800'
            }`}
          >
            Reemplazar imagen
          </button>

          {cloudReady ? (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-800/60 bg-slate-900/30 px-3 py-2">
              {cloudUser ? (
                <>
                  <div className="text-xs text-slate-300">Sesión: {cloudUser?.email || cloudUser?.id}</div>
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={cloudLogout}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 ${
                      isSaving ? 'bg-slate-900/50 text-slate-500 ring-1 ring-slate-800' : 'bg-slate-800'
                    }`}
                  >
                    Cerrar sesión
                  </button>
                </>
              ) : (
                <>
                  <input
                    value={cloudEmail}
                    onChange={(e) => setCloudEmail(e.target.value)}
                    placeholder="tu@email.com"
                    className="w-48 rounded-lg border border-slate-800 bg-slate-950/40 px-2 py-1 text-xs placeholder:text-slate-600"
                  />
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={cloudLogin}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 ${
                      isSaving ? 'bg-slate-900/50 text-slate-500 ring-1 ring-slate-800' : 'bg-slate-800'
                    }`}
                  >
                    Enviar link/código
                  </button>
                </>
              )}
            </div>
          ) : null}

          <button
            type="button"
            disabled={!activeSlide || isSaving || !cloudUser}
            onClick={cloudUploadActive}
            className={`rounded-xl px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 ${
              !activeSlide || isSaving || !cloudUser
                ? 'bg-slate-900/50 text-slate-500 ring-1 ring-slate-800'
                : 'bg-slate-800'
            }`}
            title={
              !cloudReady
                ? 'Configura Supabase en variables de entorno'
                : !cloudUser
                  ? 'Inicia sesión para usar la nube'
                  : 'Subir diapositiva a Supabase'
            }
          >
            Nube: subir
          </button>

          <button
            type="button"
            disabled={isSaving || !cloudUser}
            onClick={cloudImportSlides}
            className={`rounded-xl px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 ${
              isSaving || !cloudUser ? 'bg-slate-900/50 text-slate-500 ring-1 ring-slate-800' : 'bg-slate-800'
            }`}
            title={
              !cloudReady
                ? 'Configura Supabase en variables de entorno'
                : !cloudUser
                  ? 'Inicia sesión para usar la nube'
                  : 'Importar tus diapositivas desde Supabase'
            }
          >
            Nube: importar
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
            <div className="text-sm font-semibold">Imágenes</div>
            <div className="text-xs text-slate-500">
              Puedes usar imágenes de <code>public/slides</code> (solo en desarrollo) o subir desde tu iPad (se guardan en este dispositivo).
            </div>
          </div>
          <div className="text-xs text-slate-500">
            {isSaving ? 'Guardando…' : isDirty ? 'Cambios sin guardar' : 'Guardado'}
          </div>
        </div>

        {localImages.length ? (
          <div className="grid gap-2">
            <div className="text-xs font-semibold text-slate-300">Subidas (este dispositivo)</div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {localImages.map((it) => (
                <ImageTile
                  key={it.key}
                  url={it.url}
                  label={it.name || it.url}
                  selected={activeSlide?.imageUrl === it.url}
                  onSelect={() => setSlideImages(it.url)}
                />
              ))}
            </div>
          </div>
        ) : null}

        {images.length > 0 ? (
          <div className="grid gap-2">
            <div className="text-xs font-semibold text-slate-300">public/slides (desarrollo)</div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {images.map((url) => (
                <ImageTile
                  key={url}
                  url={url}
                  label={url.replace('/slides/', '')}
                  selected={activeSlide?.imageUrl === url}
                  onSelect={() => setSlideImages(url)}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="text-sm text-slate-300">
            En GitHub Pages este listado no aparece. Usa <b>Subir imagen</b> para agregar desde el iPad.
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
