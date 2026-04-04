import overrides from './overrides.json'

function getLocalOverrides() {
  try {
    if (typeof window === 'undefined') return null
    const raw = window.localStorage.getItem('microlab:overrides_local')
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    return parsed
  } catch {
    return null
  }
}

function getLocalSlides() {
  try {
    if (typeof window === 'undefined') return []
    const raw = window.localStorage.getItem('microlab:local_slides')
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((s) => s && typeof s === 'object' && typeof s.id === 'string')
  } catch {
    return []
  }
}

function getDeletedSlideIds() {
  try {
    if (typeof window === 'undefined') return new Set()
    const raw = window.localStorage.getItem('microlab:deleted_slide_ids')
    const parsed = raw ? JSON.parse(raw) : []
    const arr = Array.isArray(parsed) ? parsed : []
    return new Set(arr.filter((x) => typeof x === 'string'))
  } catch {
    return new Set()
  }
}

function applyOverrides(item, localOverrides) {
  const o = overrides?.[item.id]
  const lo = localOverrides?.[item.id]
  const merged = !o && !lo ? item : { ...item, ...(o || {}), ...(lo || {}) }
  return {
    ...merged,
    imageUrl: normalizeSlideUrl(merged.imageUrl),
    thumbnailUrl: normalizeSlideUrl(merged.thumbnailUrl)
  }
}

function normalizeSlideUrl(url) {
  const u = String(url || '')
  if (!u) return u
  if (u.startsWith('/slides/')) return u.slice(1)
  return u
}

function safeId(s) {
  return String(s)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-_]/g, '')
}

function getGroupFromTopic(topic) {
  const t = String(topic || '').trim()
  if (!t) return { id: 'sin-tema', title: 'Sin tema' }

  return { id: safeId(t), title: t }
}

function buildCatalog(slidesList) {
  const byGroup = new Map()
  for (const s of slidesList) {
    const g = getGroupFromTopic(s.topic)
    const prev = byGroup.get(g.id) || { id: g.id, title: g.title, items: [] }
    prev.items.push(s)
    byGroup.set(g.id, prev)
  }

  return Array.from(byGroup.values()).sort((a, b) => a.title.localeCompare(b.title, 'es'))
}

const baseSlides = [
  {
    id: 'epitelio-simple-demo',
    title: 'Epitelio simple (demo)',
    topic: 'Tejidos',
    tags: ['tejidos', 'básico'],
    difficulty: 1,
    description: '',
    imageUrl: 'slides/placeholder.svg',
    thumbnailUrl: 'slides/placeholder.svg',
    naturalSize: { width: 1600, height: 900 },
    hotspots: []
  },
  {
    id: 'conectivo-laxo-demo',
    title: 'Conectivo laxo (demo)',
    topic: 'Tejidos',
    tags: ['tejidos', 'básico'],
    difficulty: 1,
    description: '',
    imageUrl: 'slides/placeholder.svg',
    thumbnailUrl: 'slides/placeholder.svg',
    naturalSize: { width: 1600, height: 900 },
    hotspots: []
  },
  {
    id: 'musculo-estriado-demo',
    title: 'Músculo estriado (demo)',
    topic: 'Tejidos',
    tags: ['tejidos', 'básico'],
    difficulty: 1,
    description: '',
    imageUrl: 'slides/placeholder.svg',
    thumbnailUrl: 'slides/placeholder.svg',
    naturalSize: { width: 1600, height: 900 },
    hotspots: []
  },
  {
    id: 'neurona-demo',
    title: 'Neurona (demo)',
    topic: 'Tejidos',
    tags: ['tejidos', 'básico'],
    difficulty: 1,
    description: '',
    imageUrl: 'slides/placeholder.svg',
    thumbnailUrl: 'slides/placeholder.svg',
    naturalSize: { width: 1600, height: 900 },
    hotspots: []
  }
]

export function getSlides() {
  const localOverrides = getLocalOverrides()
  const localSlides = getLocalSlides()
  const deleted = getDeletedSlideIds()

  const map = new Map()
  for (const s of baseSlides) map.set(s.id, s)
  for (const s of localSlides) map.set(s.id, s)
  return Array.from(map.values())
    .filter((s) => !deleted.has(s.id))
    .map((s) => applyOverrides(s, localOverrides))
}

export function getCatalog() {
  return buildCatalog(getSlides())
}

export function subscribeSlides(onChange) {
  if (typeof window === 'undefined') return () => {}

  const handler = () => {
    try {
      onChange?.()
    } catch {
      // ignore
    }
  }

  window.addEventListener('storage', handler)
  window.addEventListener('microlab:slides-updated', handler)

  return () => {
    window.removeEventListener('storage', handler)
    window.removeEventListener('microlab:slides-updated', handler)
  }
}

export const slides = getSlides()

export const catalog = getCatalog()
