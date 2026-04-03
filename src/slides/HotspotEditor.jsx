import React, { useMemo, useRef, useState } from 'react'

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n))
}

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj))
}

export default function HotspotEditor({ slide, onChange, onAddHotspot }) {
  const containerRef = useRef(null)

  const [selectedId, setSelectedId] = useState(null)
  const [view, setView] = useState({ x: 0, y: 0, scale: 1 })

  const pointersRef = useRef(new Map())
  const dragRef = useRef({ draggingHotspotId: null })
  const lastRef = useRef({ x: 0, y: 0, scale: 1, pinchDist: null })

  const selected = useMemo(() => slide.hotspots.find((h) => h.id === selectedId) || null, [slide.hotspots, selectedId])

  function getImageRect() {
    const el = containerRef.current
    if (!el) return null
    const rect = el.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2

    const w = slide.naturalSize.width * view.scale
    const h = slide.naturalSize.height * view.scale

    const left = cx + view.x - w / 2
    const top = cy + view.y - h / 2

    return { left, top, width: w, height: h, rect }
  }

  function clientToNorm(clientX, clientY) {
    const img = getImageRect()
    if (!img) return null
    const nx = (clientX - img.left) / img.width
    const ny = (clientY - img.top) / img.height
    return { x: clamp(nx, 0, 1), y: clamp(ny, 0, 1) }
  }

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
    setView({ x: 0, y: 0, scale: 1 })
    lastRef.current = { x: 0, y: 0, scale: 1, pinchDist: null }
  }

  function onPointerDown(e) {
    e.currentTarget.setPointerCapture(e.pointerId)
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    lastRef.current = { ...lastRef.current, x: view.x, y: view.y, scale: view.scale, pinchDist: null }
  }

  function onPointerMove(e) {
    if (!pointersRef.current.has(e.pointerId)) return

    if (dragRef.current.draggingHotspotId) {
      const pos = clientToNorm(e.clientX, e.clientY)
      if (!pos) return

      const next = deepClone(slide)
      next.hotspots = next.hotspots.map((h) =>
        h.id === dragRef.current.draggingHotspotId ? { ...h, x: pos.x, y: pos.y } : h
      )
      onChange(next)
      return
    }

    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    const pts = Array.from(pointersRef.current.values())

    if (pts.length === 1) {
      const dx = e.movementX
      const dy = e.movementY
      setView((v) => ({ ...v, x: v.x + dx, y: v.y + dy }))
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
    dragRef.current.draggingHotspotId = null
    lastRef.current = { ...lastRef.current, x: view.x, y: view.y, scale: view.scale, pinchDist: null }
  }

  function onContainerClick(e) {
    if (dragRef.current.draggingHotspotId) return

    const pos = clientToNorm(e.clientX, e.clientY)
    if (!pos) return

    if (onAddHotspot) onAddHotspot(pos.x, pos.y)
  }

  function updateSelected(patch) {
    if (!selected) return
    const next = deepClone(slide)
    next.hotspots = next.hotspots.map((h) => (h.id === selected.id ? { ...h, ...patch } : h))
    onChange(next)
  }

  function deleteSelected() {
    if (!selected) return
    const next = deepClone(slide)
    next.hotspots = next.hotspots.filter((h) => h.id !== selected.id)
    onChange(next)
    setSelectedId(null)
  }

  return (
    <div className="grid gap-3 lg:grid-cols-[1fr_360px]">
      <div
        ref={containerRef}
        className="relative h-[62vh] w-full overflow-hidden rounded-2xl border border-slate-800/60 bg-slate-900/30 touch-none"
        onWheel={onWheel}
        onDoubleClick={onDoubleClick}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClick={onContainerClick}
      >
        <div
          className="absolute left-1/2 top-1/2"
          style={{
            transform: `translate(-50%, -50%) translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
            transformOrigin: 'center center'
          }}
        >
          <div className="relative">
            <img
              src={slide.imageUrl}
              alt={slide.title}
              draggable={false}
              className="select-none max-w-none"
              style={{ width: slide.naturalSize.width, height: slide.naturalSize.height }}
            />

            {slide.hotspots.map((h) => {
              const isSelected = selectedId === h.id
              return (
                <button
                  key={h.id}
                  type="button"
                  className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
                  style={{
                    width: isSelected ? 12 : 10,
                    height: isSelected ? 12 : 10,
                    background: isSelected ? '#0b2a5a' : '#081b3f',
                    left: `${h.x * 100}%`,
                    top: `${h.y * 100}%`
                  }}
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelectedId(h.id)
                  }}
                  onPointerDown={(e) => {
                    e.stopPropagation()
                    dragRef.current.draggingHotspotId = h.id
                  }}
                  aria-label={h.name || 'Hotspot'}
                />
              )
            })}
          </div>
        </div>
      </div>

      <div className="grid gap-3 rounded-2xl border border-slate-800/60 bg-slate-900/20 p-4">
        <div>
          <div className="text-sm font-semibold">Hotspots</div>
          <div className="mt-1 text-xs text-slate-500">Total: {slide.hotspots.length}</div>
        </div>

        {!selected ? (
          <div className="text-sm text-slate-300">Selecciona un punto para editar. Para crear uno nuevo, toca la imagen.</div>
        ) : (
          <div className="grid gap-2">
            <div className="text-xs text-slate-500">ID</div>
            <input
              value={selected.id}
              readOnly
              className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm text-slate-200"
            />

            <div className="text-xs text-slate-500">Nombre</div>
            <input
              value={selected.name}
              onChange={(e) => updateSelected({ name: e.target.value })}
              className="rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2 text-sm"
            />

            <div className="text-xs text-slate-500">Descripción</div>
            <textarea
              value={selected.description}
              onChange={(e) => updateSelected({ description: e.target.value })}
              className="h-24 resize-none rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2 text-sm"
            />

            <div className="text-xs text-slate-500">Función</div>
            <textarea
              value={selected.function}
              onChange={(e) => updateSelected({ function: e.target.value })}
              className="h-24 resize-none rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2 text-sm"
            />

            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-slate-800 bg-slate-950/30 px-3 py-2">
                <div className="text-[11px] text-slate-500">x</div>
                <div className="text-sm text-slate-200">{selected.x.toFixed(4)}</div>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/30 px-3 py-2">
                <div className="text-[11px] text-slate-500">y</div>
                <div className="text-sm text-slate-200">{selected.y.toFixed(4)}</div>
              </div>
            </div>

            <button
              type="button"
              onClick={deleteSelected}
              className="rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
            >
              Eliminar hotspot
            </button>
          </div>
        )}

        <div className="text-xs text-slate-500">
          Controles: rueda/pinch = zoom, arrastrar = pan, doble click = reset, arrastrar punto = mover.
        </div>
      </div>
    </div>
  )
}
