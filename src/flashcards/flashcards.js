import { getCatalog } from '../slides/slides.js'

function fromHotspots() {
  const catalog = getCatalog()
  const slides = catalog.flatMap((c) => c.items)
  const cards = []

  for (const s of slides) {
    const slideTags = s.tags || []
    for (const h of s.hotspots) {
      const desc = String(h.description || '').trim()
      const fn = String(h.function || '').trim()
      const backParts = [desc, fn ? `Función: ${fn}` : ''].filter(Boolean)
      cards.push({
        id: `card-${s.id}-${h.id}`,
        deckId: s.id,
        deckTitle: s.title,
        tags: [...slideTags],
        front: String(h.name || '').trim() || 'Estructura',
        back: backParts.join('\n\n') || 'Sin descripción todavía.',
        source: { slideId: s.id, hotspotId: h.id }
      })
    }
  }

  return cards
}

export function getDecks() {
  const catalog = getCatalog()
  return catalog.map((c) => ({ id: c.id, title: c.title }))
}

export function getCards() {
  return fromHotspots()
}

export const decks = getDecks()

export const cards = getCards()
