function safeParse(raw, fallback) {
  try {
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function nowId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

const KEY = 'microlab:notifications'

export function listNotifications() {
  if (typeof localStorage === 'undefined') return []
  const raw = localStorage.getItem(KEY)
  const list = safeParse(raw, [])
  return Array.isArray(list) ? list : []
}

export function writeNotifications(list) {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch {
    // ignore
  }
  try {
    window.dispatchEvent(new Event('microlab:notifications-updated'))
  } catch {
    // ignore
  }
}

export function pushNotification(input) {
  const item = {
    id: nowId(),
    at: Date.now(),
    read: false,
    type: input?.type || 'info',
    title: String(input?.title || ''),
    message: String(input?.message || ''),
    meta: input?.meta && typeof input.meta === 'object' ? input.meta : null
  }

  const prev = listNotifications()
  const next = [item, ...prev].slice(0, 120)
  writeNotifications(next)
  return item
}

export function markRead(id, read = true) {
  const prev = listNotifications()
  const next = prev.map((n) => (n.id === id ? { ...n, read: Boolean(read) } : n))
  writeNotifications(next)
}

export function markAllRead() {
  const prev = listNotifications()
  const next = prev.map((n) => ({ ...n, read: true }))
  writeNotifications(next)
}

export function clearNotifications() {
  writeNotifications([])
}
