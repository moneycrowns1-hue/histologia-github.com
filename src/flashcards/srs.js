function nowMs() {
  return Date.now()
}

function daysToMs(days) {
  return Math.max(0, days) * 24 * 60 * 60 * 1000
}

export function defaultSrsState() {
  return {
    reps: 0,
    lapses: 0,
    ease: 2.5,
    intervalDays: 0,
    dueAt: nowMs()
  }
}

// quality: 0..5 (SM-2). We map UI buttons to these values.
export function schedule(prev, quality) {
  const p = { ...prev }
  const q = Math.max(0, Math.min(5, quality))

  if (q < 3) {
    p.lapses += 1
    p.reps = 0
    p.intervalDays = 0
    p.dueAt = nowMs() + daysToMs(0)
    p.ease = Math.max(1.3, p.ease - 0.2)
    return p
  }

  // correct
  p.reps += 1
  if (p.reps === 1) p.intervalDays = 1
  else if (p.reps === 2) p.intervalDays = 3
  else p.intervalDays = Math.max(1, Math.round(p.intervalDays * p.ease))

  // ease update
  p.ease = p.ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
  p.ease = Math.max(1.3, Math.min(3.2, p.ease))

  p.dueAt = nowMs() + daysToMs(p.intervalDays)
  return p
}

export function isDue(state) {
  return (state?.dueAt ?? 0) <= nowMs()
}
