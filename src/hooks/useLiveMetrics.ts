import { useEffect, useState } from 'react'
import type { LiveMetrics } from '@shared/types'

const HISTORY = 60

/** Poll real CPU and memory metrics (cheap: read from the OS, no processes spawned) and keep a short history. */
export function useLiveMetrics() {
  const [live, setLive] = useState<LiveMetrics | null>(null)
  const [cpuHistory, setCpuHistory] = useState<number[]>([])
  const [memHistory, setMemHistory] = useState<number[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    let busy = false
    const tick = async () => {
      if (busy) return
      busy = true
      try {
        const m = await window.nexterm.system.live()
        if (!alive) return
        setLive(m)
        setError(null)
        setCpuHistory((h) => [...h, m.cpuLoad].slice(-HISTORY))
        setMemHistory((h) => [...h, (m.memUsed / m.memTotal) * 100].slice(-HISTORY))
      } catch (e) {
        if (alive) setError((e as Error).message)
      } finally {
        busy = false
      }
    }
    void tick()
    // 3 s while the window is visible; nothing at all while it is minimised or hidden.
    const t = setInterval(() => { if (!document.hidden) void tick() }, 3000)
    return () => {
      alive = false
      clearInterval(t)
    }
  }, [])

  return { live, cpuHistory, memHistory, error }
}
