import { useEffect, useState } from 'react'
import { getSavedImageBlob, idbUrlToKey, isIdbUrl } from './localImages.js'

export default function useResolvedImageUrl(url) {
  const [resolved, setResolved] = useState(url)

  useEffect(() => {
    let alive = true
    let objectUrl = null

    async function run() {
      if (!isIdbUrl(url)) {
        setResolved(url)
        return
      }

      const key = idbUrlToKey(url)
      if (!key) {
        setResolved(url)
        return
      }

      try {
        const blob = await getSavedImageBlob(key)
        if (!alive) return
        if (!blob) {
          setResolved('')
          return
        }
        objectUrl = URL.createObjectURL(blob)
        setResolved(objectUrl)
      } catch {
        if (!alive) return
        setResolved('')
      }
    }

    run()

    return () => {
      alive = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [url])

  return resolved
}
