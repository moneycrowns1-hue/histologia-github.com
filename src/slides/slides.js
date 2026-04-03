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

const localOverrides = getLocalOverrides()

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

const localSlides = getLocalSlides()

function applyOverrides(item) {
  const o = overrides?.[item.id]
  const lo = localOverrides?.[item.id]
  if (!o && !lo) return item
  return { ...item, ...(o || {}), ...(lo || {}) }
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

  const parts = t.split('·').map((p) => p.trim()).filter(Boolean)
  const groupTitle = parts[1] || parts[0] || 'Sin tema'
  return { id: safeId(groupTitle), title: groupTitle }
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
    topic: 'Tejidos · Epitelial',
    tags: ['epitelial', 'tejidos', 'básico'],
    difficulty: 1,
    description: 'Diapositiva de ejemplo con hotspots. Reemplaza esta imagen por una real en public/slides.',
    imageUrl: '/slides/placeholder.svg',
    thumbnailUrl: '/slides/placeholder.svg',
    naturalSize: { width: 1600, height: 900 },
    hotspots: [
      {
        id: 'hs-nucleo',
        x: 0.28,
        y: 0.42,
        name: 'Núcleo',
        description: 'Estructura que contiene el material genético.',
        function: 'Regula la expresión génica y la división celular.'
      },
      {
        id: 'hs-epitelio',
        x: 0.62,
        y: 0.58,
        name: 'Capa epitelial',
        description: 'Conjunto de células que recubre una superficie.',
        function: 'Protección, absorción y secreción (según el tipo de epitelio).'
      }
    ]
  },
  {
    id: 'conectivo-laxo-demo',
    title: 'Conectivo laxo (demo)',
    topic: 'Tejidos · Conectivo',
    tags: ['conectivo', 'tejidos', 'básico'],
    difficulty: 1,
    description: 'Plantilla para practicar identificación de fibras y células en conectivo.',
    imageUrl: '/slides/placeholder.svg',
    thumbnailUrl: '/slides/placeholder.svg',
    naturalSize: { width: 1600, height: 900 },
    hotspots: [
      {
        id: 'hs-fibra',
        x: 0.4,
        y: 0.62,
        name: 'Fibras (ejemplo)',
        description: 'Elementos del tejido conectivo que aportan soporte.',
        function: 'Resistencia mecánica y estructura del estroma.'
      },
      {
        id: 'hs-celula',
        x: 0.68,
        y: 0.35,
        name: 'Célula (ejemplo)',
        description: 'Célula del conectivo (p. ej. fibroblasto) en este demo.',
        function: 'Síntesis y mantenimiento de matriz extracelular.'
      }
    ]
  },
  {
    id: 'musculo-estriado-demo',
    title: 'Músculo estriado (demo)',
    topic: 'Tejidos · Muscular',
    tags: ['muscular', 'tejidos', 'básico'],
    difficulty: 1,
    description: 'Plantilla para practicar bandas, fibras y núcleos periféricos.',
    imageUrl: '/slides/placeholder.svg',
    thumbnailUrl: '/slides/placeholder.svg',
    naturalSize: { width: 1600, height: 900 },
    hotspots: [
      {
        id: 'hs-bandas',
        x: 0.52,
        y: 0.52,
        name: 'Bandas (ejemplo)',
        description: 'Patrón repetitivo característico del músculo estriado.',
        function: 'Organización sarcomérica asociada a contracción.'
      }
    ]
  },
  {
    id: 'neurona-demo',
    title: 'Neurona (demo)',
    topic: 'Tejidos · Nervioso',
    tags: ['nervioso', 'tejidos', 'básico'],
    difficulty: 1,
    description: 'Plantilla para practicar soma, núcleo y prolongaciones.',
    imageUrl: '/slides/placeholder.svg',
    thumbnailUrl: '/slides/placeholder.svg',
    naturalSize: { width: 1600, height: 900 },
    hotspots: [
      {
        id: 'hs-soma',
        x: 0.33,
        y: 0.48,
        name: 'Soma (ejemplo)',
        description: 'Cuerpo celular de la neurona.',
        function: 'Integra señales y mantiene el metabolismo celular.'
      }
    ]
  }
]

export const slides = [...baseSlides, ...localSlides].map(applyOverrides)

export const catalog = buildCatalog(slides)
