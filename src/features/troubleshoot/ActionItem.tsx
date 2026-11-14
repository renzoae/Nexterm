import clsx from 'clsx'
import { ChevronDown, ExternalLink, Play, RotateCcw, ShieldAlert, Square, Wrench } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { getCommand } from '@shared/commands'
import { SETTINGS } from '@shared/settings-catalog'
import type { ActionRef, DiagnosisId } from '@shared/troubleshoot'
import { displayCommand, validateParams } from '@shared/validation'
import { OutputPanel } from '@/components/OutputPanel'
import { RiskBadge } from '@/components/ToolCard'
import { Badge, Button } from '@/components/ui'
import { useApp } from '@/stores/app'
import { useRuns } from '@/stores/runs'
import { useTroubleshoot } from '@/stores/troubleshoot'

function actionKey(diag: DiagnosisId, a: ActionRef): string {
  return `fix:${diag}:${a.kind === 'url' ? a.url : `${a.kind}:${a.id}:${a.kind === 'repair' ? JSON.stringify(a.params ?? {}) : ''}`}`
}

/** One recommended step: a repair (confirmed and run by the main process) or a page/tool to open. */
export function ActionItem({ diag, action, onFinished }: { diag: DiagnosisId; action: ActionRef; onFinished: () => void }) {
  const info = useApp((s) => s.info)
  const key = actionKey(diag, action)
  const run = useRuns((s) => s.byKey[key])
  const [open, setOpen] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const wasRunning = useRef(false)

  const def = action.kind === 'repair' ? getCommand(action.id) : undefined
  const label = action.label ?? (def ? def.name : action.kind === 'settings' ? `Open ${SETTINGS.find((s) => s.id === action.id)?.title ?? 'settings'}` : action.kind === 'url' ? action.label : `Open ${action.id}`)

  // Tell the workflow when a repair finishes so it can offer verification.
  useEffect(() => {
    if (run?.status === 'running') wasRunning.current = true
    else if (wasRunning.current && run && ['success', 'failed'].includes(run.status)) {
      wasRunning.current = false
      useTroubleshoot.getState().noteAction(diag, run.status === 'success' ? label : `${label} (failed)`)
      onFinished()
    }
  }, [run, diag, label, onFinished])

  if (action.kind !== 'repair') {
    const openIt = async () => {
      const r =
        action.kind === 'settings' ? await window.nexterm.troubleshoot.openSetting(action.id)
          : action.kind === 'tool' ? await window.nexterm.launch.tool(action.id)
            : { ok: await window.nexterm.launch.openExternal(action.url) }
      setMsg(r.ok ? 'Opened.' : ('error' in r && r.error) || 'Could not open.')
    }
    return (
      <div className="flex items-center gap-3 rounded-md border border-line bg-panel-2 px-3 py-2">
        <ExternalLink className="h-4 w-4 shrink-0 text-accent" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-fg">{label}</div>
          <div className="text-xs text-muted">{action.reason}</div>
        </div>
        {msg && <span className="text-xs text-muted">{msg}</span>}
        <Button size="sm" onClick={() => void openIt()}>Open</Button>
      </div>
    )
  }

  if (!def) return null
  const params = action.params ?? {}
  const valid = validateParams(def, params)
  const preview = valid.ok ? displayCommand(def, valid.values) : ''
  const needsElevation = def.admin && !info?.isAdmin
  const running = run?.status === 'running'

  const start = () => {
    if (!valid.ok) return
    // Both paths are confirmed by the main process; elevated runs also show the UAC prompt.
    if (needsElevation) void useRuns.getState().runElevated(key, def.id, valid.values)
    else void useRuns.getState().run(key, def.id, valid.values)
  }

  return (
    <div className={clsx('rounded-md border bg-panel-2 p-3', def.risk === 'high' ? 'border-danger/30' : 'border-line')}>
      <div className="flex flex-wrap items-start gap-3">
        <Wrench className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-fg">{label}</span>
            <RiskBadge risk={def.risk} />
            {def.admin && <Badge tone={info?.isAdmin ? 'neutral' : 'warn'}><ShieldAlert className="h-3 w-3" />Admin</Badge>}
          </div>
          <p className="mt-0.5 text-xs text-muted">{action.reason} {def.explain}</p>
        </div>
        {running ? (
          <Button size="sm" variant="danger" disabled={!run?.runId} onClick={() => void useRuns.getState().cancel(key)} icon={<Square className="h-3.5 w-3.5" />}>Stop</Button>
        ) : (
          <Button size="sm" variant={def.risk === 'high' ? 'secondary' : 'primary'} disabled={!valid.ok} onClick={start} icon={needsElevation ? <ShieldAlert className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}>
            {needsElevation ? 'Run as admin' : 'Run'}
          </Button>
        )}
      </div>
      <button onClick={() => setOpen((v) => !v)} className="mt-2 inline-flex items-center gap-1 text-xs text-muted hover:text-accent">
        <ChevronDown className={clsx('h-3 w-3 transition-transform', open && 'rotate-180')} /> Impact, undo and exact command
      </button>
      {open && (
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
          <dt className="text-muted">Impact</dt><dd className="text-fg">{def.repair?.impact ?? def.description}</dd>
          <dt className="text-muted">Undo</dt>
          <dd className="text-fg">{def.repair ? (def.repair.rollback ?? 'Cannot be undone.') : def.risk === 'safe' ? 'Nothing to undo (read-only).' : 'Cannot be undone automatically.'}</dd>
          <dt className="text-muted">Permission</dt><dd className="text-fg">{def.admin ? (info?.isAdmin ? 'Administrator (NEXTERM is elevated)' : 'Administrator: opens an elevated PowerShell window after a UAC prompt') : 'Standard user'}</dd>
          <dt className="text-muted">Command</dt><dd><code className="selectable font-mono text-[11px] text-fg break-all">{preview}</code></dd>
        </dl>
      )}
      {run && run.status !== 'idle' && (
        <>
          <OutputPanel run={run} onClear={() => useRuns.getState().clear(key)} maxHeight={220} />
          {run.status === 'success' && !needsElevation && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-muted"><RotateCcw className="h-3 w-3" />The command finished. Use “Check again” to verify whether the problem is solved.</p>
          )}
        </>
      )}
    </div>
  )
}
