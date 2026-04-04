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
  const data = readJSON(KEY, { cards: {}, stats: { reviews: 0, qualitySum: 0 }, events: [] })
  if (!data.cards) data.cards = {}
  if (!data.stats) data.stats = { reviews: 0, qualitySum: 0 }
  if (typeof data.stats.reviews !== 'number') data.stats.reviews = 0
  if (typeof data.stats.qualitySum !== 'number') data.stats.qualitySum = 0

  // Backward compat: old schema had {correct}
  if (typeof data.stats.correct === 'number' && data.stats.qualitySum === 0 && data.stats.reviews > 0) {
    // approximate: treat correct as quality 4, incorrect as quality 1
    const correct = data.stats.correct
    const wrong = Math.max(0, data.stats.reviews - correct)
    data.stats.qualitySum = correct * 4 + wrong * 1
    try {
      delete data.stats.correct
    } catch {
      // ignore
    }
  }
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

export function bumpGlobalStats(progress, quality) {
  const q = Math.max(0, Math.min(5, Number(quality)))
  return {
    ...progress,
    stats: {
      reviews: (progress.stats?.reviews || 0) + 1,
      qualitySum: (progress.stats?.qualitySum || 0) + q
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
    const q = Number(ev.quality)
    const quality = Number.isFinite(q) ? q : ev.correct === true ? 4 : ev.correct === false ? 1 : 0
    const cur = map.get(ev.cardId) || { reviews: 0, lapses: 0, qualitySum: 0, lastAt: 0 }
    const reviews = cur.reviews + 1
    const lapses = cur.lapses + (quality < 3 ? 1 : 0)
    const qualitySum = cur.qualitySum + Math.max(0, Math.min(5, quality))
    const lastAt = Math.max(cur.lastAt, ev.at || 0)
    map.set(ev.cardId, { reviews, lapses, qualitySum, lastAt })
  }
  return map
}
