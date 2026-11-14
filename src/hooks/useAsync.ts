import { useCallback, useEffect, useRef, useState } from 'react'

/** Load data once (and on demand), optionally polling while mounted. */
export function useAsync<T>(fn: () => Promise<T>, opts: { intervalMs?: number; enabled?: boolean } = {}) {
  const { intervalMs, enabled = true } = opts
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const fnRef = useRef(fn)
  fnRef.current = fn
  const inflight = useRef(false)

  const reload = useCallback(async () => {
    if (inflight.current) return
    inflight.current = true
    setLoading(true)
    try {
      setData(await fnRef.current())
      setError(null)
    } catch (e) {
      setError((e as Error).message.replace(/^Error invoking remote method '[^']+': (Error: )?/, ''))
    } finally {
      inflight.current = false
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!enabled) return
    void reload()
    if (!intervalMs) return
    const t = setInterval(() => { if (!document.hidden) void reload() }, intervalMs)
    return () => clearInterval(t)
  }, [enabled, intervalMs, reload])

  return { data, error, loading, reload }
}
