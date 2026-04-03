const DB_NAME = 'microlab'
const DB_VERSION = 1
const STORE = 'images'

function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not available'))
      return
    }

    const req = indexedDB.open(DB_NAME, DB_VERSION)

    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'key' })
      }
    }

    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error || new Error('Failed to open IndexedDB'))
  })
}

export function isIdbUrl(url) {
  return typeof url === 'string' && url.startsWith('idb:')
}

export function idbUrlToKey(url) {
  if (!isIdbUrl(url)) return null
  return url.slice('idb:'.length)
}

export async function saveImageFile(file) {
  const db = await openDb()
  const key = `${Date.now()}-${Math.random().toString(16).slice(2)}`
  const item = {
    key,
    name: file?.name || 'imagen',
    type: file?.type || 'application/octet-stream',
    size: file?.size || 0,
    createdAt: Date.now(),
    blob: file
  }

  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error || new Error('Failed to save image'))
    tx.objectStore(STORE).put(item)
  })

  db.close()
  return { key, url: `idb:${key}` }
}

export async function listSavedImages() {
  const db = await openDb()
  const items = await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).getAll()
    req.onsuccess = () => resolve(req.result || [])
    req.onerror = () => reject(req.error || new Error('Failed to list images'))
  })
  db.close()

  return items
    .map((it) => ({
      key: it.key,
      name: it.name,
      type: it.type,
      size: it.size,
      createdAt: it.createdAt,
      url: `idb:${it.key}`
    }))
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
}

export async function getSavedImageBlob(key) {
  const db = await openDb()
  const item = await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).get(key)
    req.onsuccess = () => resolve(req.result || null)
    req.onerror = () => reject(req.error || new Error('Failed to read image'))
  })
  db.close()
  return item?.blob || null
}
