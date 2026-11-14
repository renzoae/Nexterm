import { Copy, Eraser, Search } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { cleanOutput } from '@shared/text'
import { formatDuration } from '@/lib/format'
import type { RunState } from '@/stores/runs'
import { Badge, Button, Spinner, inputCls } from './ui'

export function StatusBadge({ run }: { run: RunState }) {
  switch (run.status) {
    case 'running':
      return <Badge tone="accent"><Spinner className="h-3 w-3" /> Running</Badge>
    case 'success':
      return <Badge tone="ok">Completed{run.durationMs !== undefined ? ` · ${formatDuration(run.durationMs)}` : ''}</Badge>
    case 'failed':
      return <Badge tone="danger">Failed{run.exitCode != null ? ` (exit ${run.exitCode})` : ''}</Badge>
    case 'cancelled':
      return <Badge tone="warn">Cancelled</Badge>
    case 'blocked':
      return <Badge tone="warn">Not run</Badge>
    default:
      return null
  }
}

export function OutputPanel({ run, onClear, maxHeight = 360 }: { run: RunState; onClear?: () => void; maxHeight?: number }) {
  const ref = useRef<HTMLPreElement>(null)
  const [filter, setFilter] = useState('')
  const text = useMemo(() => cleanOutput(run.output), [run.output])
  const shown = useMemo(() => {
    if (!filter.trim()) return text
    const f = filter.toLowerCase()
    return text.split('\n').filter((l) => l.toLowerCase().includes(f)).join('\n')
  }, [text, filter])

  useEffect(() => {
    if (run.status === 'running' && ref.current) ref.current.scrollTop = ref.current.scrollHeight
  }, [shown, run.status])

  const copy = () => void window.nexterm.clipboard.write(text)

  return (
    <div className="mt-3 overflow-hidden rounded-md border border-line bg-bg">
      <div className="flex items-center gap-2 border-b border-line px-2 py-1.5">
        <StatusBadge run={run} />
        {run.message && run.status !== 'running' && <span className="truncate text-xs text-muted">{run.message}</span>}
        {run.status === 'running' && run.message && !run.runId && <span className="text-xs text-muted">{run.message}</span>}
        <div className="ml-auto flex items-center gap-1">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1.5 left-2 h-3.5 w-3.5 text-muted" />
            <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter lines" className={`${inputCls} h-6 w-36 pl-7 text-xs`} />
          </div>
          <Button size="sm" variant="ghost" onClick={copy} disabled={!text} icon={<Copy className="h-3.5 w-3.5" />}>Copy</Button>
          {onClear && run.status !== 'running' && (
            <Button size="sm" variant="ghost" onClick={onClear} icon={<Eraser className="h-3.5 w-3.5" />}>Clear</Button>
          )}
        </div>
      </div>
      <pre ref={ref} className="selectable overflow-auto px-3 py-2 font-mono text-xs leading-relaxed text-fg" style={{ maxHeight }}>
        {shown || (run.status === 'running' ? 'Waiting for output…' : run.status === 'success' ? '(no output)' : '')}
      </pre>
    </div>
  )
}
