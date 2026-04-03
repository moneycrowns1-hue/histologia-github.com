import { getCatalog } from '../slides/slides.js'

function fromHotspots() {
  const catalog = getCatalog()
  const slides = catalog.flatMap((c) => c.items)
  const cards = []

  for (const s of slides) {
    const slideTags = s.tags || []
    for (const h of s.hotspots) {
      cards.push({
        id: `card-${s.id}-${h.id}`,
        deckId: s.id,
        deckTitle: s.title,
        tags: [...slideTags],
        prompt: `¿Cuál estructura corresponde a: ${h.name}?`,
        correctAnswer: h.name,
        explainCorrect: `${h.name}: ${h.description} Función: ${h.function}`,
        explainIncorrect: 'La selección no corresponde con la estructura indicada. Revisa la forma, ubicación relativa y función típica en la diapositiva.',
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
