let started = false
let observers = []

function safeObserve(type, handler) {
  try {
    const obs = new PerformanceObserver((list) => {
      try {
        handler(list.getEntries())
      } catch {
        // ignore
      }
    })
    obs.observe({ type, buffered: true })
    observers.push(obs)
    return true
  } catch {
    return false
  }
}

export function isPerfEnabled() {
  try {
    return localStorage.getItem('microlab:perf') === '1'
  } catch {
    return false
  }
}

export function setPerfEnabled(enabled) {
  try {
    localStorage.setItem('microlab:perf', enabled ? '1' : '0')
  } catch {
    // ignore
  }
}

export function startPerfMonitoring() {
  if (started) return
  started = true

  safeObserve('largest-contentful-paint', (entries) => {
    const last = entries[entries.length - 1]
    if (!last) return
    console.log('[perf] LCP', Math.round(last.startTime), last)
  })

  safeObserve('layout-shift', (entries) => {
    const score = entries.reduce((sum, e) => sum + (e.value || 0), 0)
    if (score <= 0) return
    console.log('[perf] CLS chunk', score.toFixed(4), entries)
  })

  safeObserve('longtask', (entries) => {
    for (const e of entries) {
      console.log('[perf] longtask', Math.round(e.duration), 'ms', e)
    }
  })

  safeObserve('resource', (entries) => {
    const heavy = entries.filter((e) => (e.transferSize || 0) > 1024 * 250)
    if (heavy.length) console.log('[perf] heavy resources', heavy)
  })
}

export function stopPerfMonitoring() {
  for (const o of observers) {
    try {
      o.disconnect()
    } catch {
      // ignore
    }
  }
  observers = []
  started = false
}
