import React, { useEffect, useMemo, useRef, useState } from 'react'
import useResolvedImageUrl from '../utils/useResolvedImageUrl.js'

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n))
}

function norm01(v) {
  if (Number.isNaN(v)) return 0
  return clamp(v, 0, 1)
}

export default function SlideViewer({ slide, mode, onHotspotSelect, showDetail = true, immersive = false }) {
  const containerRef = useRef(null)
  const imgRef = useRef(null)

  const resolvedImageUrl = useResolvedImageUrl(slide.imageUrl)
  const [selectedHotspotId, setSelectedHotspotId] = useState(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const lastTapRef = useRef({ id: null, t: 0 })

  const [labelsEnabled, setLabelsEnabled] = useState(true)
  const [visibilityMode, setVisibilityMode] = useState('all')
  const [hudEnabled, setHudEnabled] = useState(true)

  const [imageNatural, setImageNatural] = useState({ width: 0, height: 0 })

  const [view, setView] = useState({ x: 0, y: 0, scale: 1 })
  const pointersRef = useRef(new Map())
  const lastRef = useRef({ x: 0, y: 0, scale: 1, pinchDist: null })

  const selectedHotspot = useMemo(
    () => slide.hotspots.find((h) => h.id === selectedHotspotId) || null,
    [slide.hotspots, selectedHotspotId]
  )

  useEffect(() => {
    setSelectedHotspotId(null)
    setDetailOpen(false)
    setView({ x: 0, y: 0, scale: 1 })
    lastRef.current = { x: 0, y: 0, scale: 1, pinchDist: null }
    setImageNatural({ width: 0, height: 0 })
  }, [slide.id])

  const imageSize = useMemo(() => {
    const w = imageNatural.width || slide?.naturalSize?.width || 0
    const h = imageNatural.height || slide?.naturalSize?.height || 0
    return {
      width: w > 0 ? w : 1,
      height: h > 0 ? h : 1
    }
  }, [imageNatural.height, imageNatural.width, slide?.naturalSize?.height, slide?.naturalSize?.width])

  const zoomUiScale = useMemo(() => {
    // Escala final en pantalla para UI (etiquetas/lineas) basada en zoom.
    // A mayor zoom, más pequeña la UI para no tapar detalles.
    const s = 1 / Math.pow(Math.max(1, view.scale), 0.65)
    return clamp(s, 0.42, 1)
  }, [view.scale])

  const lineWidth = useMemo(() => {
    return clamp(2.2 * zoomUiScale, 1.2, 2.4)
  }, [zoomUiScale])

  const hudText = useMemo(() => {
    const z = Math.round(view.scale * 100)
    const px = Math.round(view.x)
    const py = Math.round(view.y)
    return `Z ${z}%   X ${px}   Y ${py}`
  }, [view.scale, view.x, view.y])

  // UI en overlay (pixeles) NO debe escalar con zoom.
  // Usamos el zoom solo para decidir densidad/visibilidad, no para tamaño.
  const showLabelsFar = useMemo(() => {
    // cuando estás muy alejado, ocultar la mayoría para evitar solapamiento
    return view.scale >= 1.6
  }, [view.scale])

  function getSelectedIndex() {
    if (!selectedHotspotId) return -1
    return slide.hotspots.findIndex((h) => h.id === selectedHotspotId)
  }

  function getLabelPlacement(h) {
    const p = getHotspotScreenPos(h)
    if (!p) return null

    const { rect, x, y } = p
    const pad = 10

    // Distancia prudente del punto (en px) para no tapar el tejido.
    const dx = 56
    const dy = -26

    const preferredRight = x + dx
    const labelW = rect.width < 420 ? Math.min(rect.width - 24, 220) : 240
    const labelH = 34

    let left = preferredRight
    let top = y + dy

    // Si se sale por la derecha, poner a la izquierda.
    if (left + labelW + pad > rect.width) left = x - dx - labelW

    left = clamp(left, pad, rect.width - labelW - pad)
    top = clamp(top, pad, rect.height - labelH - pad)

    // Anchor (punto) queda en (x,y). Label box arriba.
    return { x, y, left, top, width: labelW }
  }

  function selectHotspotByIndex(idx) {
    if (!slide.hotspots.length) return
    const safe = ((idx % slide.hotspots.length) + slide.hotspots.length) % slide.hotspots.length
    const h = slide.hotspots[safe]
    setSelectedHotspotId(h.id)
    if (onHotspotSelect) onHotspotSelect(h)
  }

  function focusHotspot(h, nextScale) {
    if (!h) return
    const W = imageSize.width
    const H = imageSize.height
    const posX = norm01(h.x) * W - W / 2
    const posY = norm01(h.y) * H - H / 2
    const scale = clamp(nextScale ?? view.scale, 1, 12)
    const x = -posX * scale
    const y = -posY * scale
    setView({ x, y, scale })
    lastRef.current = { ...lastRef.current, x, y, scale, pinchDist: null }
  }

  function getHotspotScreenPos(h) {
    const el = containerRef.current
    if (!el) return null

    const rect = el.getBoundingClientRect()
    const W = imageSize.width
    const H = imageSize.height
    const px = (norm01(h.x) * W - W / 2) * view.scale + view.x
    const py = (norm01(h.y) * H - H / 2) * view.scale + view.y
    return {
      rect,
      x: rect.width / 2 + px,
      y: rect.height / 2 + py
    }
  }

  function getPopoverPlacement(h) {
    const p = getHotspotScreenPos(h)
    if (!p) return null

    const { rect, x, y } = p
    const popW = rect.width < 420 ? Math.min(rect.width - 24, 320) : 360
    const popH = 220
    const pad = 12
    const offset = 14

    // Preferencia: a la derecha y ligeramente arriba.
    let left = x + offset
    let top = y - 18

    // Si se sale por la derecha, ponerlo a la izquierda.
    if (left + popW + pad > rect.width) left = x - offset - popW

    // Clamp a bordes.
    left = clamp(left, pad, rect.width - popW - pad)
    top = clamp(top, pad, rect.height - popH - pad)

    return { left, top, width: popW }
  }

  useEffect(() => {
    if (!immersive) return

    function onKeyDown(e) {
      if (e.key === 'Escape') {
        setDetailOpen(false)
        return
      }

      if (e.key === 'h' || e.key === 'H') {
        setHudEnabled((v) => !v)
        return
      }

      if (e.key === 'l' || e.key === 'L') {
        setLabelsEnabled((v) => !v)
        return
      }

      if (e.key === '1') {
        setVisibilityMode('all')
        return
      }

      if (e.key === '2') {
        setVisibilityMode('points')
        return
      }

      if (e.key === '3') {
        setVisibilityMode('selected')
        return
      }

      if (e.key === 'Enter') {
        if (selectedHotspot) setDetailOpen(true)
        return
      }

    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [immersive, selectedHotspotId, selectedHotspot, slide.id])

  function applyZoom(nextScale, originClientX, originClientY) {
    const el = containerRef.current
    if (!el) return

    const rect = el.getBoundingClientRect()
    const ox = originClientX - rect.left - rect.width / 2
    const oy = originClientY - rect.top - rect.height / 2

    setView((v) => {
      const newScale = clamp(nextScale, 1, 12)
      const ratio = newScale / v.scale
      return {
        scale: newScale,
        x: v.x - ox * (ratio - 1),
        y: v.y - oy * (ratio - 1)
      }
    })
  }

  function onWheel(e) {
    e.preventDefault()
    const delta = -e.deltaY
    const zoomIntensity = 0.0015
    const nextScale = view.scale * (1 + delta * zoomIntensity)
    applyZoom(nextScale, e.clientX, e.clientY)
  }

  function onDoubleClick(e) {
    e.preventDefault()
    // Solo resetea si el doble click fue en el "lienzo" (no en un hotspot)
    if (e.target?.closest?.('button[data-hotspot]')) return
    setView({ x: 0, y: 0, scale: 1 })
    lastRef.current = { x: 0, y: 0, scale: 1, pinchDist: null }
  }

  function openHotspotDetail(hotspotId, hotspotObj) {
    setSelectedHotspotId(hotspotId)
    setDetailOpen(true)
    if (onHotspotSelect) onHotspotSelect(hotspotObj || null)
  }

  function onPointerDown(e) {
    // Si el usuario toca un hotspot, no capturamos el pointer en el contenedor
    // para permitir que el botón reciba eventos (especialmente pointerup para doble-tap).
    if (e.target?.closest?.('button[data-hotspot]')) return

    e.currentTarget.setPointerCapture(e.pointerId)
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    setView((v) => {
      lastRef.current = { ...lastRef.current, x: v.x, y: v.y, scale: v.scale, pinchDist: null }
      return v
    })
  }

  function onPointerMove(e) {
    if (!pointersRef.current.has(e.pointerId)) return
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    const pts = Array.from(pointersRef.current.values())

    if (pts.length === 1) {
      const dx = e.movementX
      const dy = e.movementY

      setView((v) => {
        const next = { ...v, x: v.x + dx, y: v.y + dy }
        lastRef.current = { ...lastRef.current, x: next.x, y: next.y, scale: next.scale, pinchDist: null }
        return next
      })
      return
    }

    if (pts.length >= 2) {
      const [a, b] = pts
      const dist = Math.hypot(a.x - b.x, a.y - b.y)
      const midX = (a.x + b.x) / 2
      const midY = (a.y + b.y) / 2

      const prev = lastRef.current
      if (prev.pinchDist == null) {
        lastRef.current = { ...prev, pinchDist: dist }
        return
      }

      const ratio = dist / prev.pinchDist
      const nextScale = prev.scale * ratio
      applyZoom(nextScale, midX, midY)
    }
  }

  function onPointerUp(e) {
    pointersRef.current.delete(e.pointerId)
    setView((v) => {
      lastRef.current = { ...lastRef.current, x: v.x, y: v.y, scale: v.scale, pinchDist: null }
      return v
    })
  }

  return (
    <div className={immersive ? 'grid gap-0' : 'grid gap-3'}>
      {immersive ? (
        <style>{`
          @keyframes microlabPop {
            from { opacity: 0; transform: translateY(6px) scale(0.96); }
            to { opacity: 1; transform: translateY(0px) scale(1); }
          }
        `}</style>
      ) : null}
      <div
        ref={containerRef}
        className={
          immersive
            ? 'relative h-[100dvh] w-full overflow-hidden bg-black touch-none'
            : 'relative h-[62vh] w-full overflow-hidden rounded-2xl border border-slate-800/60 bg-slate-900/30 touch-none'
        }
        onWheel={onWheel}
        onDoubleClick={onDoubleClick}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClick={(e) => {
          if (!immersive) return
          if (!detailOpen) return
          if (e.target?.closest?.('[data-popover]')) return
          if (e.target?.closest?.('button[data-hotspot]')) return
          setDetailOpen(false)
        }}
      >
        {/* Popover flotante (anclado a punto) */}
        {immersive && showDetail && detailOpen && selectedHotspot ? (
          (() => {
            const placement = getPopoverPlacement(selectedHotspot)
            if (!placement) return null

            const confidence = clamp(
              0.55 + (selectedHotspot.description ? 0.15 : 0) + (selectedHotspot.function ? 0.15 : 0) + (selectedHotspot.name ? 0.1 : 0),
              0.4,
              0.98
            )

            const idx = getSelectedIndex()
            const total = slide.hotspots.length

            return (
              <div
                data-popover
                className="pointer-events-none absolute inset-0 z-30"
                style={{ contain: 'layout paint' }}
              >
                <div
                  data-popover
                  className="pointer-events-auto absolute origin-top-left rounded-3xl border border-cyan-300/30 bg-black/45 p-4 text-slate-100 shadow-2xl ring-1 ring-cyan-400/15 backdrop-blur-md"
                  style={{ left: placement.left, top: placement.top, width: placement.width, animation: 'microlabPop 140ms ease-out' }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-mono text-[11px] text-cyan-200/90">ANALYSIS NODE</div>
                      <div className="mt-1 truncate text-sm font-semibold text-white">
                        {selectedHotspot.name || 'Estructura'}
                      </div>
                      <div className="mt-1 font-mono text-[11px] text-slate-300">
                        {idx >= 0 ? `#${idx + 1}/${total}` : ''}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDetailOpen(false)}
                      className="rounded-2xl bg-black/30 px-3 py-2 text-xs font-semibold text-slate-200 ring-1 ring-cyan-300/20 hover:bg-black/40"
                    >
                      Cerrar
                    </button>
                  </div>

                  <div className="mt-3 grid gap-2">
                    <div className="grid gap-2 rounded-2xl border border-white/10 bg-black/20 p-3">
                      <div className="flex items-start gap-2">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="mt-0.5 text-cyan-200">
                          <path d="M12 21s7-4.35 7-10a7 7 0 0 0-14 0c0 5.65 7 10 7 10Z" stroke="currentColor" strokeWidth="2" />
                          <path d="M12 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" stroke="currentColor" strokeWidth="2" />
                        </svg>
                        <div>
                          <div className="font-mono text-[11px] text-slate-300">Descripción</div>
                          <div className="mt-0.5 text-sm text-slate-100/90">{selectedHotspot.description || 'Sin descripción.'}</div>
                        </div>
                      </div>

                      <div className="flex items-start gap-2">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="mt-0.5 text-cyan-200">
                          <path d="M4 20h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                          <path d="M7 16V8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                          <path d="M12 16V4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                          <path d="M17 16v-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                        <div>
                          <div className="font-mono text-[11px] text-slate-300">Función</div>
                          <div className="mt-0.5 text-sm text-slate-100/90">{selectedHotspot.function || 'Sin función.'}</div>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-2 rounded-2xl border border-white/10 bg-black/20 p-3">
                      <div className="flex items-center justify-between">
                        <div className="font-mono text-[11px] text-slate-300">Confianza</div>
                        <div className="rounded-full border border-cyan-300/20 bg-black/30 px-2 py-1 font-mono text-[11px] text-cyan-200">
                          {Math.round(confidence * 100)}%
                        </div>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400 transition-[width] duration-200"
                          style={{ width: `${Math.round(confidence * 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )
          })()
        ) : null}

        {/* Imagen (zoom/pan) */}
        <div
          className="absolute left-1/2 top-1/2"
          style={{
            transform: `translate(-50%, -50%) translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
            transformOrigin: 'center center',
            transition: 'transform 40ms linear'
          }}
        >
          <img
            ref={imgRef}
            src={resolvedImageUrl}
            alt={slide.title}
            className="select-none max-w-none"
            draggable={false}
            style={{ width: imageSize.width, height: imageSize.height }}
            onLoad={(e) => {
              const img = e.currentTarget
              const w = img?.naturalWidth || 0
              const h = img?.naturalHeight || 0
              if (w > 0 && h > 0) setImageNatural({ width: w, height: h })
            }}
          />
        </div>

        {/* Overlay UI en píxeles (NO escala con zoom) */}
        <div className="pointer-events-none absolute inset-0 z-20">
          {(() => {
            const items = slide.hotspots
              .map((h) => {
                const p = getLabelPlacement(h)
                if (!p) return null
                const isSelected = selectedHotspotId === h.id
                return { h, p, isSelected }
              })
              .filter(Boolean)

            const allowLabels = labelsEnabled && mode === 'study'
            const wantLabels = allowLabels && showLabelsFar
            const labelCandidates = items
              .filter(({ h, isSelected }) => {
                if (!h?.name) return false
                if (visibilityMode === 'points') return false
                if (visibilityMode === 'selected') return isSelected
                if (isSelected) return true
                return wantLabels
              })
              .map(({ h, p, isSelected }) => {
                const labelW = p.width
                const labelH = 26
                return {
                  h,
                  p,
                  isSelected,
                  rect: { x: p.left, y: p.top, w: labelW, h: labelH }
                }
              })

            labelCandidates.sort((a, b) => {
              if (a.isSelected !== b.isSelected) return a.isSelected ? -1 : 1
              if (a.rect.y !== b.rect.y) return a.rect.y - b.rect.y
              return a.rect.x - b.rect.x
            })

            const accepted = []
            const hidden = new Set()
            for (const cand of labelCandidates) {
              const r = cand.rect
              let ok = true
              for (const prev of accepted) {
                const pr = prev.rect
                const overlap = r.x < pr.x + pr.w && r.x + r.w > pr.x && r.y < pr.y + pr.h && r.y + r.h > pr.y
                if (overlap) {
                  ok = false
                  break
                }
              }
              if (ok) accepted.push(cand)
              else if (!cand.isSelected) hidden.add(cand.h.id)
            }

            return items.map(({ h, p, isSelected }) => {
              const canShowLabel =
                allowLabels &&
                !!h.name &&
                visibilityMode !== 'points' &&
                (visibilityMode === 'selected' ? isSelected : !hidden.has(h.id))

              const showLabel = canShowLabel

              const lineX2 = p.left > p.x ? p.left : p.left + p.width
              const lineY2 = p.top + 13

              const anchorColor = isSelected ? '#0b2a5a' : '#081b3f'
              const labelBg = '#081b3f'
              const lineStroke = '#0b2a5a'

              return (
                <div key={h.id} className="absolute inset-0">
                  {showLabel ? (
                    <svg className="absolute inset-0" style={{ overflow: 'visible' }} width="100%" height="100%">
                      <line
                        x1={p.x}
                        y1={p.y}
                        x2={lineX2}
                        y2={lineY2}
                        stroke={lineStroke}
                        strokeWidth={lineWidth}
                        strokeLinecap="round"
                        style={{ transition: 'all 120ms ease' }}
                      />
                    </svg>
                  ) : null}

                  <button
                    type="button"
                    data-hotspot
                    className="pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 rounded-full transition"
                    style={{
                      left: p.x,
                      top: p.y,
                      width: 10,
                      height: 10,
                      background: anchorColor
                    }}
                    onClick={(e) => {
                      e.stopPropagation()
                      if (immersive) openHotspotDetail(h.id, h)
                      else {
                        setSelectedHotspotId(h.id)
                        if (onHotspotSelect) onHotspotSelect(h)
                      }
                    }}
                    onDoubleClick={(e) => {
                      e.stopPropagation()
                      openHotspotDetail(h.id, h)
                    }}
                    onPointerUp={(e) => {
                      const now = Date.now()
                      const last = lastTapRef.current
                      const isDoubleTap = last.id === h.id && now - last.t < 320
                      lastTapRef.current = { id: h.id, t: now }
                      if (isDoubleTap) {
                        e.stopPropagation()
                        openHotspotDetail(h.id, h)
                      }
                    }}
                    aria-label={h.name || 'Hotspot'}
                  />

                  {showLabel ? (
                    <div className="pointer-events-none absolute" style={{ left: p.left, top: p.top, width: p.width, transition: 'all 120ms ease' }}>
                      <div
                        className="inline-flex max-w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-[12px] font-semibold text-white shadow-lg"
                        style={{ background: labelBg }}
                      >
                        {h.name}
                      </div>
                    </div>
                  ) : null}
                </div>
              )
            })
          })()}

          {immersive && hudEnabled ? (
            <div className="pointer-events-none absolute left-3 top-3 rounded-xl bg-black/55 px-3 py-2 text-[11px] font-semibold text-white backdrop-blur-sm">
              {hudText}
            </div>
          ) : null}

          {immersive ? (
            <div className="pointer-events-none absolute bottom-3 right-3 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setLabelsEnabled((v) => !v)}
                className={`pointer-events-auto rounded-xl px-3 py-2 text-xs font-semibold backdrop-blur transition ${
                  labelsEnabled ? 'bg-black/60 text-white hover:bg-black/70' : 'bg-black/30 text-slate-400 hover:bg-black/40'
                }`}
              >
                Labels
              </button>
              <button
                type="button"
                onClick={() => setVisibilityMode((m) => (m === 'all' ? 'points' : m === 'points' ? 'selected' : 'all'))}
                className="pointer-events-auto rounded-xl bg-black/60 px-3 py-2 text-xs font-semibold text-white backdrop-blur hover:bg-black/70"
                title="Modo: 1=Todo, 2=Solo puntos, 3=Solo seleccionado"
              >
                {visibilityMode === 'all' ? 'Todo' : visibilityMode === 'points' ? 'Puntos' : 'Sel.'}
              </button>
              <button
                type="button"
                onClick={() => setHudEnabled((v) => !v)}
                className={`pointer-events-auto rounded-xl px-3 py-2 text-xs font-semibold backdrop-blur transition ${
                  hudEnabled ? 'bg-black/60 text-white hover:bg-black/70' : 'bg-black/30 text-slate-400 hover:bg-black/40'
                }`}
              >
                HUD
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {showDetail && !immersive && (
        <div className="grid gap-2 rounded-2xl border border-slate-800/60 bg-slate-900/20 p-4">
          <div className="text-sm font-semibold">Detalle</div>
          {!selectedHotspot ? (
            <div className="text-sm text-slate-300">Toca un punto para ver información.</div>
          ) : (
            <div className="grid gap-2">
              <div className="text-sm font-semibold">{mode === 'quiz' ? 'Estructura seleccionada' : selectedHotspot.name}</div>
              <div className="text-sm text-slate-300">{selectedHotspot.description}</div>
              <div className="text-sm text-slate-300">
                <span className="text-slate-400">Función: </span>
                {selectedHotspot.function}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
