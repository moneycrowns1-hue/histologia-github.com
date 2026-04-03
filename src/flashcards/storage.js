import { defaultSrsState } from './srs.js'

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // ignore
  }
}

const KEY = 'microlab_flashcards_v1'

export function loadProgress() {
  const data = readJSON(KEY, { cards: {}, stats: { reviews: 0, correct: 0 }, events: [] })
  if (!data.cards) data.cards = {}
  if (!data.stats) data.stats = { reviews: 0, correct: 0 }
  if (!data.events) data.events = []
  return data
}

export function saveProgress(data) {
  writeJSON(KEY, data)
}

export function getCardState(progress, cardId) {
  return progress.cards[cardId] || defaultSrsState()
}

export function setCardState(progress, cardId, state) {
  return {
    ...progress,
    cards: {
      ...progress.cards,
      [cardId]: state
    }
  }
}

export function bumpGlobalStats(progress, wasCorrect) {
  return {
    ...progress,
    stats: {
      reviews: (progress.stats?.reviews || 0) + 1,
      correct: (progress.stats?.correct || 0) + (wasCorrect ? 1 : 0)
    }
  }
}

export function addReviewEvent(progress, event) {
  const next = {
    ...progress,
    events: [...(progress.events || []), event]
  }
  return next
}

export function computeCardStats(progress) {
  const map = new Map()
  for (const ev of progress.events || []) {
    const cur = map.get(ev.cardId) || { reviews: 0, wrong: 0, lastAt: 0 }
    const reviews = cur.reviews + 1
    const wrong = cur.wrong + (ev.correct ? 0 : 1)
    const lastAt = Math.max(cur.lastAt, ev.at || 0)
    map.set(ev.cardId, { reviews, wrong, lastAt })
  }
  return map
}
