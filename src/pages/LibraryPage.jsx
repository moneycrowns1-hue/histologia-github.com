import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getCatalog, subscribeSlides } from '../slides/slides.js'
import useResolvedImageUrl from '../utils/useResolvedImageUrl.js'
import { saveImageFile } from '../utils/localImages.js'

function slideThumb(s) {
  return s.thumbnailUrl || s.imageUrl
}

function addDeletedId(id) {
  try {
    const key = 'microlab:deleted_slide_ids'
    const raw = localStorage.getItem(key)
    const arr = raw ? JSON.parse(raw) : []
    const list = Array.isArray(arr) ? arr : []
    if (!list.includes(id)) list.push(id)
    localStorage.setItem(key, JSON.stringify(list))
  } catch {
    // ignore
  }
}

function removeLocalSlideAndOverrides(id) {
  try {
    const raw = localStorage.getItem('microlab:local_slides')
    const prev = raw ? JSON.parse(raw) : []
    const arr = Array.isArray(prev) ? prev : []
    const next = arr.filter((s) => s?.id !== id)
    localStorage.setItem('microlab:local_slides', JSON.stringify(next))
  } catch {
    // ignore
  }

  try {
    const raw = localStorage.getItem('microlab:overrides_local')
    const prev = raw ? JSON.parse(raw) : {}
    const obj = prev && typeof prev === 'object' ? prev : {}
    if (obj[id]) delete obj[id]
    localStorage.setItem('microlab:overrides_local', JSON.stringify(obj))
  } catch {
    // ignore
  }

  addDeletedId(id)
  try {
    window.dispatchEvent(new Event('microlab:slides-updated'))
  } catch {
    // ignore
  }
}

function RecentStory({ slide, isFavorite }) {
  const [loaded, setLoaded] = useState(false)
  const thumb = useResolvedImageUrl(slideThumb(slide))

  return (
    <Link
      to={`/visor?slide=${encodeURIComponent(slide.id)}`}
      className="group grid w-[78px] shrink-0 justify-items-center gap-2 md:w-[88px]"
    >
      <div className="relative">
        <div
          className={`grid h-[56px] w-[56px] place-items-center rounded-full bg-gradient-to-tr from-fuchsia-500 via-cyan-400 to-emerald-400 p-[2px] transition group-active:scale-[0.98] md:h-[62px] md:w-[62px] ${
            isFavorite ? 'opacity-100' : 'opacity-90'
          }`}
        >
          <div className="relative h-full w-full overflow-hidden rounded-full bg-black">
            {!loaded ? <div className="absolute inset-0 animate-pulse bg-white/5" /> : null}
            <img
              src={thumb}
              alt={slide.title}
              className={`h-full w-full object-cover transition duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
              loading="lazy"
              onLoad={() => setLoaded(true)}
              draggable={false}
            />
          </div>
        </div>
      </div>
      <div className="w-full px-1 text-center text-[11px] font-semibold text-slate-200 md:text-[12px]">
        <div className="truncate">{slide.title}</div>
      </div>
    </Link>
  )
}

function SlideCard({ slide, isFavorite, onToggleFavorite, priority = false }) {
  const [loaded, setLoaded] = useState(false)
  const thumb = useResolvedImageUrl(slideThumb(slide))

  const subtitle = useMemo(() => {
    const t = (slide?.topic || '').trim()
    if (!t) return ''
    const first = t.split('·')[0]?.trim() || ''
    return first
  }, [slide?.topic])

  return (
    <div
      className="group relative overflow-hidden rounded-[22px] bg-black shadow-[0_0_0_1px_rgba(255,255,255,0.06)] transition will-change-transform hover:-translate-y-0.5 hover:shadow-[0_18px_50px_-22px_rgba(0,0,0,0.95)] active:translate-y-0"
      style={{ animation: 'microlabFadeUp 240ms ease-out both' }}
    >
      <Link to={`/visor?slide=${encodeURIComponent(slide.id)}`} className="block active:scale-[0.99] transition">
        <div className="relative aspect-[3/4]">
          {!loaded ? (
            <div className="absolute inset-0 animate-pulse bg-white/5" />
          ) : null}
          <img
            src={thumb}
            alt={slide.title}
            className={`absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-[1.02] ${
              loaded ? 'opacity-100' : 'opacity-0'
            }`}
            draggable={false}
            loading={priority ? 'eager' : 'lazy'}
            onLoad={() => setLoaded(true)}
          />
          <div className="absolute inset-x-0 bottom-0 h-[54%] bg-gradient-to-t from-black via-black/60 to-transparent" />
          <div className="absolute bottom-0 left-0 p-3 md:p-3.5">
            {subtitle ? (
              <div className="text-[12px] font-bold tracking-wide text-slate-200/95 md:text-[13px]">{subtitle}</div>
            ) : null}
            <div className="mt-0.5 text-[17px] font-extrabold leading-[1.15] text-white drop-shadow-sm line-clamp-2 transition group-hover:-translate-y-0.5 md:text-[18px]">
              {slide.title}
            </div>
          </div>
        </div>
      </Link>

      <button
        type="button"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          onToggleFavorite(slide.id)
        }}
        aria-label={isFavorite ? 'Quitar favorito' : 'Marcar favorito'}
        className="absolute right-2.5 top-2.5 grid h-9 w-9 place-items-center rounded-2xl bg-black/60 backdrop-blur-sm transition hover:bg-black/70 active:scale-[0.98]"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill={isFavorite ? 'white' : 'none'} xmlns="http://www.w3.org/2000/svg">
          <path
            d="M12 21s-7.5-4.35-9.5-8.5C.8 8.4 3.2 5 6.9 5c2 0 3.2 1 4.1 2.1C11.9 6 13.1 5 15.1 5c3.7 0 6.1 3.4 4.4 7.5C19.5 16.65 12 21 12 21Z"
            stroke="white"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  )
}

export default function LibraryPage() {
  const navigate = useNavigate()
  const [catalog, setCatalog] = useState(() => getCatalog())

  const [deletingIds, setDeletingIds] = useState(() => new Set())

  const [createOpen, setCreateOpen] = useState(false)
  const [createTitle, setCreateTitle] = useState('')
  const [createTopic, setCreateTopic] = useState('')
  const [createBusy, setCreateBusy] = useState(false)
  const createFileRef = useRef(null)

  const [menuSlide, setMenuSlide] = useState(null)

  useEffect(() => {
    const unsub = subscribeSlides(() => {
      setCatalog(getCatalog())
    })
    return () => {
      unsub?.()
    }
  }, [])

  const [query, setQuery] = useState(() => {
    try {
      return localStorage.getItem('microlab:library:query') || ''
    } catch {
      return ''
    }
  })

  const [showOnlyFavorites, setShowOnlyFavorites] = useState(() => {
    try {
      return localStorage.getItem('microlab:library:favoritesOnly') === '1'
    } catch {
      return false
    }
  })

  const [favorites, setFavorites] = useState(() => {
    try {
      const raw = localStorage.getItem('microlab:favorites')
      const arr = raw ? JSON.parse(raw) : []
      return new Set(Array.isArray(arr) ? arr : [])
    } catch {
      return new Set()
    }
  })
  const [categoryId, setCategoryId] = useState(() => {
    try {
      return localStorage.getItem('microlab:library:category') || 'all'
    } catch {
      return 'all'
    }
  })

  const scrollSaveTimerRef = useRef(null)

  const normalizedQuery = query.trim().toLowerCase()

  const filteredCatalog = useMemo(() => {
    const cats = categoryId === 'all' ? catalog : catalog.filter((c) => c.id === categoryId)
    if (!normalizedQuery) return cats

    return cats
      .map((c) => {
        const items = c.items.filter((s) => {
          const hay = `${s.title} ${s.topic} ${s.description} ${(s.tags || []).join(' ')}`.toLowerCase()
          return hay.includes(normalizedQuery)
        })
        return { ...c, items }
      })
      .filter((c) => c.items.length > 0)
  }, [categoryId, normalizedQuery])

  const visibleCatalog = useMemo(() => {
    if (!showOnlyFavorites) return filteredCatalog
    const next = filteredCatalog
      .map((c) => ({
        ...c,
        items: c.items.filter((s) => favorites.has(s.id))
      }))
      .filter((c) => c.items.length > 0)

    if (next.length > 0) return next
    return [{ id: 'favoritos', title: 'Favoritos', items: [] }]
  }, [filteredCatalog, favorites, showOnlyFavorites])

  const recents = useMemo(() => {
    try {
      const raw = localStorage.getItem('microlab:recents')
      const arr = raw ? JSON.parse(raw) : []
      const ids = (Array.isArray(arr) ? arr : [])
        .filter((x) => x && typeof x === 'object')
        .map((x) => x.id)
        .filter((id) => typeof id === 'string')

      const map = new Map()
      for (const c of catalog) {
        for (const s of c.items) map.set(s.id, s)
      }

      const out = []
      const seen = new Set()
      for (const id of ids) {
        if (seen.has(id)) continue
        const s = map.get(id)
        if (!s) continue
        seen.add(id)
        out.push(s)
        if (out.length >= 16) break
      }
      return out
    } catch {
      return []
    }
  }, [catalog])

  function toggleFavorite(id) {
    setFavorites((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      try {
        localStorage.setItem('microlab:favorites', JSON.stringify(Array.from(next)))
      } catch {
        // ignore
      }
      return next
    })
  }

  useEffect(() => {
    try {
      localStorage.setItem('microlab:library:query', query)
    } catch {
      // ignore
    }
  }, [query])

  useEffect(() => {
    try {
      localStorage.setItem('microlab:library:category', categoryId)
    } catch {
      // ignore
    }
  }, [categoryId])

  useEffect(() => {
    try {
      localStorage.setItem('microlab:library:favoritesOnly', showOnlyFavorites ? '1' : '0')
    } catch {
      // ignore
    }
  }, [showOnlyFavorites])

  useEffect(() => {
    let restored = false
    try {
      const raw = sessionStorage.getItem('microlab:library:scrollY')
      const y = raw ? Number(raw) : 0
      if (Number.isFinite(y) && y > 0) {
        restored = true
        requestAnimationFrame(() => window.scrollTo(0, y))
      }
    } catch {
      // ignore
    }

    function onScroll() {
      if (scrollSaveTimerRef.current) clearTimeout(scrollSaveTimerRef.current)
      scrollSaveTimerRef.current = setTimeout(() => {
        try {
          sessionStorage.setItem('microlab:library:scrollY', String(window.scrollY || 0))
        } catch {
          // ignore
        }
      }, 120)
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    if (!restored) onScroll()

    return () => {
      window.removeEventListener('scroll', onScroll)
      if (scrollSaveTimerRef.current) clearTimeout(scrollSaveTimerRef.current)
    }
  }, [])

  return (
    <div className="-mx-4 -my-6 min-h-[100dvh] bg-black px-4 pb-10 pt-5 text-white md:px-6 md:pt-6">
      <style>{`
        @keyframes microlabFadeUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0px); }
        }

        @keyframes microlabDeleteOut {
          from { opacity: 1; transform: scale(1); filter: blur(0px); }
          to { opacity: 0; transform: scale(0.96); filter: blur(2px); }
        }

        .microlab-card-deleting {
          animation: microlabDeleteOut 180ms ease-in both;
          pointer-events: none;
        }
      `}</style>
      <div className="mb-5">
        <div className="px-1">
          <div className="text-2xl font-bold tracking-tight text-white">Biblioteca</div>
          <div className="mt-0.5 text-[13px] font-semibold tracking-[0.22em] text-slate-400">HISTOLOGIA</div>
        </div>

        <div className="mt-4 grid gap-2 md:grid-cols-[1fr_auto_auto] md:items-end">
          <div className="grid gap-2 sm:grid-cols-[1fr_240px]">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar..."
              className="h-11 w-full rounded-2xl border border-white/10 bg-black px-4 text-[15px] font-semibold text-white placeholder:text-slate-600 md:h-12 md:text-base"
            />
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="h-11 rounded-2xl border border-white/10 bg-black px-4 text-[15px] font-semibold text-white md:h-12 md:text-base"
            >
              <option value="all">Todos</option>
              {catalog.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => setShowOnlyFavorites((v) => !v)}
            className={`inline-flex h-11 items-center justify-center gap-2 rounded-2xl px-4 text-[15px] font-bold transition active:scale-[0.99] md:h-12 md:text-base ${
              showOnlyFavorites ? 'bg-white text-black' : 'bg-white/10 text-white hover:bg-white/15'
            }`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill={showOnlyFavorites ? 'black' : 'none'} xmlns="http://www.w3.org/2000/svg">
              <path
                d="M12 21s-7.5-4.35-9.5-8.5C.8 8.4 3.2 5 6.9 5c2 0 3.2 1 4.1 2.1C11.9 6 13.1 5 15.1 5c3.7 0 6.1 3.4 4.4 7.5C19.5 16.65 12 21 12 21Z"
                stroke={showOnlyFavorites ? 'black' : 'white'}
                strokeWidth="2"
                strokeLinejoin="round"
              />
            </svg>
            Favoritos
          </button>

          <button
            type="button"
            onClick={() => {
              setCreateTitle('')
              setCreateTopic('')
              setCreateOpen(true)
            }}
            className="inline-flex h-11 items-center justify-center rounded-2xl bg-emerald-500 px-4 text-[15px] font-extrabold text-emerald-950 transition active:scale-[0.99] hover:bg-emerald-400 md:h-12 md:text-base"
          >
            + Nueva diapositiva
          </button>
        </div>
      </div>

      {recents.length ? (
        <section className="mb-8 grid gap-2">
          <div className="px-1">
            <div className="text-lg font-bold text-white">Recientes</div>
          </div>
          <div className="-mx-4 overflow-x-auto px-4">
            <div className="flex gap-3 pb-1 md:gap-4">
              {recents.map((s) => (
                <RecentStory key={s.id} slide={s} isFavorite={favorites.has(s.id)} />
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <div className="grid gap-8">
        {visibleCatalog.map((c) => (
          <section key={c.id} className="grid gap-2">
            <div className="px-1">
              <div className="text-lg font-bold text-white">{c.title}</div>
            </div>

            <div className="grid grid-cols-[repeat(auto-fill,minmax(148px,1fr))] gap-3 sm:grid-cols-[repeat(auto-fill,minmax(160px,1fr))] md:grid-cols-[repeat(auto-fill,minmax(172px,1fr))]">
              {c.items.map((s) => (
                <div
                  key={s.id}
                  className={deletingIds.has(s.id) ? 'microlab-card-deleting' : ''}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    setMenuSlide(s)
                  }}
                  onTouchStart={() => {
                    // long press
                    const t = setTimeout(() => setMenuSlide(s), 420)
                    const clear = () => clearTimeout(t)
                    window.addEventListener('touchend', clear, { once: true })
                    window.addEventListener('touchmove', clear, { once: true })
                  }}
                >
                  <SlideCard slide={s} isFavorite={favorites.has(s.id)} onToggleFavorite={toggleFavorite} />
                </div>
              ))}

              {showOnlyFavorites && c.items.length === 0 ? (
                <div className="col-span-full rounded-2xl bg-white/5 p-4 text-base font-semibold text-slate-300">
                  Aún no tienes favoritos.
                </div>
              ) : null}
            </div>
          </section>
        ))}

        {visibleCatalog.length === 0 && (
          <div className="rounded-2xl bg-white/5 p-4 text-base font-semibold text-slate-300">
            No hay resultados con ese filtro.
          </div>
        )}
      </div>

      <input
        ref={createFileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const files = Array.from(e.target.files || []).filter(Boolean)
          if (!files.length) return
          const file = files[0]
          try {
            setCreateBusy(true)
            const saved = await saveImageFile(file)
            const id = `slide-${Date.now()}`
            const slide = {
              id,
              title: (createTitle || file.name || 'Nueva diapositiva').replace(/\.[^.]+$/, ''),
              topic: createTopic || 'Sin tema',
              tags: [],
              difficulty: 1,
              description: '',
              imageUrl: saved.url,
              thumbnailUrl: saved.url,
              naturalSize: { width: 1, height: 1 },
              hotspots: []
            }

            try {
              const raw = localStorage.getItem('microlab:local_slides')
              const prev = raw ? JSON.parse(raw) : []
              const arr = Array.isArray(prev) ? prev : []
              const next = [...arr.filter((s) => s?.id !== slide.id), slide]
              localStorage.setItem('microlab:local_slides', JSON.stringify(next))
              window.dispatchEvent(new Event('microlab:slides-updated'))
            } catch {
              // ignore
            }

            setCreateOpen(false)
            navigate(`/editor?slide=${encodeURIComponent(id)}`)
          } catch {
            // ignore
          } finally {
            setCreateBusy(false)
            try {
              if (createFileRef.current) createFileRef.current.value = ''
            } catch {
              // ignore
            }
          }
        }}
      />

      {createOpen ? (
        <div className="fixed inset-0 z-[90] grid place-items-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-950 p-5 text-white shadow-[0_30px_80px_-50px_rgba(0,0,0,0.9)]">
            <div className="text-lg font-extrabold">Nueva diapositiva</div>
            <div className="mt-4 grid gap-2">
              <div className="text-xs font-semibold text-slate-400">Título</div>
              <input
                value={createTitle}
                onChange={(e) => setCreateTitle(e.target.value)}
                className="h-12 w-full rounded-2xl border border-white/10 bg-black px-4 text-base font-semibold text-white"
                placeholder="Ej: Tejido conectivo"
              />

              <div className="mt-2 text-xs font-semibold text-slate-400">Sección (categoría)</div>
              <input
                value={createTopic}
                onChange={(e) => setCreateTopic(e.target.value)}
                className="h-12 w-full rounded-2xl border border-white/10 bg-black px-4 text-base font-semibold text-white"
                placeholder="Ej: Tejidos"
              />
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={createBusy}
                onClick={() => createFileRef.current?.click()}
                className={`h-12 flex-1 rounded-2xl px-4 text-base font-extrabold transition active:scale-[0.99] ${
                  createBusy ? 'bg-white/10 text-slate-400' : 'bg-emerald-500 text-emerald-950 hover:bg-emerald-400'
                }`}
              >
                Elegir imagen
              </button>
              <button
                type="button"
                disabled={createBusy}
                onClick={() => setCreateOpen(false)}
                className="h-12 rounded-2xl bg-white/10 px-4 text-base font-extrabold text-white hover:bg-white/15"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {menuSlide ? (
        <div className="fixed inset-0 z-[95] bg-black/70" onClick={() => setMenuSlide(null)}>
          <div className="absolute inset-x-4 bottom-4 mx-auto max-w-md rounded-3xl border border-white/10 bg-slate-950 p-3 shadow-[0_30px_80px_-50px_rgba(0,0,0,0.9)]">
            <div className="px-3 py-2 text-sm font-bold text-white truncate">{menuSlide.title}</div>
            <button
              type="button"
              onClick={() => {
                const id = menuSlide.id
                setMenuSlide(null)
                navigate(`/editor?slide=${encodeURIComponent(id)}`)
              }}
              className="w-full rounded-2xl px-3 py-3 text-left text-base font-extrabold text-white hover:bg-white/10"
            >
              Editar puntos
            </button>
            <button
              type="button"
              onClick={() => {
                const id = menuSlide.id
                setMenuSlide(null)
                setDeletingIds((prev) => {
                  const next = new Set(prev)
                  next.add(id)
                  return next
                })

                window.setTimeout(() => {
                  removeLocalSlideAndOverrides(id)
                  setCatalog(getCatalog())
                  setDeletingIds((prev) => {
                    const next = new Set(prev)
                    next.delete(id)
                    return next
                  })
                }, 190)
              }}
              className="w-full rounded-2xl px-3 py-3 text-left text-base font-extrabold text-red-300 hover:bg-red-500/10"
            >
              Borrar
            </button>
            <button
              type="button"
              onClick={() => setMenuSlide(null)}
              className="mt-1 w-full rounded-2xl bg-white/10 px-3 py-3 text-left text-base font-extrabold text-white hover:bg-white/15"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
