import clsx from 'clsx'
import { ChevronDown, Code, Copy, Play, ShieldAlert, Square, SquareTerminal, Star } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { CommandDef, ParamValues } from '@shared/types'
import { defaultParams, displayCommand, validateParams } from '@shared/validation'
import { useApp } from '@/stores/app'
import { useRuns } from '@/stores/runs'
import { useSettings } from '@/stores/settings'
import { useTerminals } from '@/stores/terminal'
import { OutputPanel } from './OutputPanel'
import { Badge, Button, inputCls } from './ui'

export function RiskBadge({ risk }: { risk: CommandDef['risk'] }) {
  return risk === 'safe' ? (
    <Badge tone="ok" title="Read-only diagnostic">Read-only</Badge>
  ) : risk === 'caution' ? (
    <Badge tone="warn" title="Changes system state; asks for confirmation">Caution</Badge>
  ) : (
    <Badge tone="danger" title="May disrupt the system; asks for confirmation">High risk</Badge>
  )
}

const REQ_LABEL: Record<string, string> = {
  domain: 'Domain-joined PC', rsat: 'RSAT', git: 'Git', docker: 'Docker', node: 'Node.js', python: 'Python', wsl: 'WSL', winget: 'winget'
}

export function ToolCard({ cmd }: { cmd: CommandDef }) {
  const mode = useSettings((s) => s.mode)
  const favorite = useSettings((s) => s.favorites.includes(cmd.id))
  const info = useApp((s) => s.info)
  const run = useRuns((s) => s.byKey[cmd.id])
  const { run: start, runElevated, cancel, clear } = useRuns.getState()
  const [values, setValues] = useState<ParamValues>(() => defaultParams(cmd))
  const [showCmd, setShowCmd] = useState(false)

  const validation = useMemo(() => validateParams(cmd, values), [cmd, values])
  const preview = useMemo(() => {
    try { return displayCommand(cmd, validation.ok ? validation.values : defaultParams(cmd)) } catch { return '' }
  }, [cmd, validation])

  const advanced = mode === 'advanced'
  const running = run?.status === 'running'
  const isAdmin = !!info?.isAdmin
  const needsElevation = cmd.admin && !isAdmin
  const supported = info?.isWindows !== false

  const doRun = () => validation.ok && void start(cmd.id, cmd.id, validation.values)
  const doElevated = () => validation.ok && void runElevated(cmd.id, cmd.id, validation.values)

  const sendToTerminal = () => {
    useTerminals.getState().openTab({ profileId: cmd.shells.includes('powershell') ? 'powershell' : 'cmd', title: cmd.name, initialInput: preview })
    useApp.getState().setPage('terminal')
  }

  return (
    <div className="animate-in rounded-lg border border-line bg-panel p-4 transition-colors hover:border-accent/30">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-fg">{cmd.name}</h3>
            <button
              onClick={() => useSettings.getState().toggleFavorite(cmd.id)}
              className={clsx('rounded p-0.5', favorite ? 'text-warn' : 'text-muted/50 hover:text-warn')}
              title={favorite ? 'Remove from favorites' : 'Add to favorites'}
              aria-pressed={favorite}
            >
              <Star className="h-3.5 w-3.5" fill={favorite ? 'currentColor' : 'none'} />
            </button>
            <RiskBadge risk={cmd.risk} />
            {cmd.admin && <Badge tone={isAdmin ? 'neutral' : 'warn'} title="Requires administrator privileges"><ShieldAlert className="h-3 w-3" />Admin</Badge>}
            {cmd.requires && <Badge title="Requirement">{REQ_LABEL[cmd.requires]}</Badge>}
            {advanced && cmd.shells.map((s) => <Badge key={s}>{s === 'powershell' ? 'PowerShell' : 'CMD'}</Badge>)}
            {cmd.longRunning && <Badge>Long-running</Badge>}
          </div>
          <p className="mt-1 text-sm text-muted">{advanced ? cmd.description : cmd.explain}</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {running ? (
            <Button variant="danger" onClick={() => void cancel(cmd.id)} disabled={!run?.runId} icon={<Square className="h-3.5 w-3.5" />}>Stop</Button>
          ) : needsElevation ? (
            <Button variant="primary" onClick={doElevated} disabled={!validation.ok || !supported} icon={<ShieldAlert className="h-3.5 w-3.5" />} title="Opens an elevated PowerShell window after a UAC prompt">
              Run as admin
            </Button>
          ) : (
            <Button variant="primary" onClick={doRun} disabled={!validation.ok || !supported} icon={<Play className="h-3.5 w-3.5" />}>Run</Button>
          )}
        </div>
      </div>

      {cmd.params && cmd.params.length > 0 && (
        <div className="mt-3 flex flex-wrap items-end gap-3">
          {cmd.params.map((p) => (
            <label key={p.name} className="flex flex-col gap-1 text-xs text-muted">
              <span className="font-medium">{p.label}</span>
              {p.type === 'choice' ? (
                <select className={inputCls} value={String(values[p.name])} onChange={(e) => setValues({ ...values, [p.name]: e.target.value })}>
                  {p.choices.map((c) => <option key={c}>{c}</option>)}
                </select>
              ) : (
                <input
                  className={clsx(inputCls, p.type === 'int' || p.type === 'drive' ? 'w-24' : 'w-56')}
                  value={String(values[p.name] ?? '')}
                  placeholder={p.type === 'host' ? p.placeholder : undefined}
                  inputMode={p.type === 'int' ? 'numeric' : undefined}
                  onChange={(e) => setValues({ ...values, [p.name]: p.type === 'int' ? e.target.value.replace(/\D/g, '') : e.target.value })}
                  onKeyDown={(e) => e.key === 'Enter' && !running && (needsElevation ? doElevated() : doRun())}
                />
              )}
            </label>
          ))}
          {!validation.ok && <span className="pb-2 text-xs text-danger">{validation.error}</span>}
        </div>
      )}

      {(advanced || showCmd) && (
        <div className="mt-3 flex items-center gap-2 rounded-md border border-line bg-bg px-2.5 py-1.5">
          <Code className="h-3.5 w-3.5 shrink-0 text-accent" />
          <code className="selectable min-w-0 flex-1 truncate font-mono text-xs text-fg" title={preview}>{preview}</code>
          <Button size="sm" variant="ghost" onClick={() => void window.nexterm.clipboard.write(preview)} icon={<Copy className="h-3.5 w-3.5" />}>Copy</Button>
          {advanced && supported && (
            <Button size="sm" variant="ghost" onClick={sendToTerminal} title="Open a terminal tab with this command typed in (not executed)" icon={<SquareTerminal className="h-3.5 w-3.5" />}>
              To terminal
            </Button>
          )}
        </div>
      )}
      {!advanced && (
        <button onClick={() => setShowCmd((v) => !v)} className="mt-2 inline-flex items-center gap-1 text-xs text-muted hover:text-accent">
          <ChevronDown className={clsx('h-3 w-3 transition-transform', showCmd && 'rotate-180')} />
          {showCmd ? 'Hide command' : 'Show command'}
        </button>
      )}

      {!supported && <p className="mt-2 text-xs text-muted">Windows only: this tool runs when NEXTERM is used on Windows.</p>}
      {run && run.status === 'blocked' && run.needsAdmin && (
        <p className="mt-2 text-xs text-warn">NEXTERM is not running as administrator. Use “Run as admin” to open an elevated window (Windows will ask for permission).</p>
      )}
      {run && run.status !== 'idle' && (run.output || run.status !== 'blocked' || run.message) && !(run.status === 'blocked' && !run.output && run.needsAdmin) && (
        <OutputPanel run={run} onClear={() => clear(cmd.id)} />
      )}
    </div>
  )
}

export function ToolList({ commands, empty }: { commands: CommandDef[]; empty?: string }) {
  if (!commands.length) return <p className="text-sm text-muted">{empty ?? 'No tools match.'}</p>
  return <div className="flex flex-col gap-3">{commands.map((c) => <ToolCard key={c.id} cmd={c} />)}</div>
}
