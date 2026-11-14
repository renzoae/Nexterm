import clsx from 'clsx'
import { AlertTriangle, ArrowLeft, CheckCircle2, ChevronDown, CircleHelp, Copy, Info, RefreshCw, ShieldCheck, XCircle } from 'lucide-react'
import { useCallback, useEffect, useState, type ReactElement } from 'react'
import { formatDiagnosis } from '@shared/report'
import type { Finding, ProblemDef } from '@shared/troubleshoot'
import { Button, Card, ErrorNote, InfoNote, Spinner } from '@/components/ui'
import { useApp } from '@/stores/app'
import { useTroubleshoot } from '@/stores/troubleshoot'
import { ActionItem } from './ActionItem'

const CHECKS: Record<string, string[]> = {
  network: ['Network adapters and IP address', 'Router (default gateway)', 'Internet servers', 'DNS name lookups', 'Wi-Fi sign-in pages and proxy'],
  slow: ['Processor load (2-second sample)', 'Memory', 'Busiest programs', 'Free disk space and disk type', 'Startup programs, uptime and power plan'],
  update: ['Update services', 'Update history and error codes', 'Update errors in the event log', 'Free space and pending restart'],
  sound: ['Audio services', 'Sound hardware', 'Speakers and headphones', 'Volume and mute'],
  disk: ['Free space on every drive', 'Temporary files', 'Recycle Bin', 'Downloads and update cache'],
  hang: ['Programs not responding now', 'Freezes and crashes in the last 7 days'],
  startup: ['Startup programs', 'Last boot duration', 'Fast Startup'],
  printer: ['Print Spooler service', 'Installed printers and status', 'Print queue'],
  services: ['Automatic services that are stopped', 'Service errors in the last 7 days']
}

const STATUS_ICON: Record<Finding['status'], ReactElement> = {
  ok: <CheckCircle2 className="h-4 w-4 text-ok" />,
  info: <Info className="h-4 w-4 text-accent" />,
  warn: <AlertTriangle className="h-4 w-4 text-warn" />,
  fail: <XCircle className="h-4 w-4 text-danger" />,
  unknown: <CircleHelp className="h-4 w-4 text-muted" />
}

function FindingRow({ f }: { f: Finding }) {
  const [open, setOpen] = useState(f.status === 'fail')
  return (
    <li className="py-2.5">
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 shrink-0">{STATUS_ICON[f.status]}</span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-fg">{f.title}</div>
          <div className="text-xs text-muted">{f.detail}</div>
          {f.evidence && (
            <>
              <button onClick={() => setOpen((v) => !v)} className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted hover:text-accent">
                <ChevronDown className={clsx('h-3 w-3 transition-transform', open && 'rotate-180')} /> Details
              </button>
              {open && <pre className="selectable mt-1 max-h-48 overflow-auto rounded border border-line bg-bg p-2 font-mono text-[11px] whitespace-pre-wrap text-fg">{f.evidence}</pre>}
            </>
          )}
        </div>
      </div>
    </li>
  )
}

function Step({ n, label, state }: { n: number; label: string; state: 'done' | 'active' | 'todo' }) {
  return (
    <div className="flex items-center gap-2">
      <span className={clsx('flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold',
        state === 'done' ? 'bg-ok/20 text-ok' : state === 'active' ? 'bg-accent text-accent-fg' : 'bg-hover text-muted')}>{state === 'done' ? '✓' : n}</span>
      <span className={clsx('text-xs', state === 'todo' ? 'text-muted' : 'text-fg')}>{label}</span>
    </div>
  )
}

export function Workflow({ problem, onBack }: { problem: ProblemDef; onBack: () => void }) {
  const id = problem.diagnosis
  const st = useTroubleshoot((s) => s.byId[id])
  const isWindows = useApp((s) => s.info?.isWindows !== false)
  const [repairDone, setRepairDone] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    // Diagnostics are read-only, so they start as soon as the problem is opened.
    if (!useTroubleshoot.getState().byId[id]?.current) void useTroubleshoot.getState().run(id)
  }, [id])

  const onFinished = useCallback(() => setRepairDone(true), [])
  const verify = () => { setRepairDone(false); void useTroubleshoot.getState().run(id, true) }

  const d = st?.current
  const running = !!st?.running
  const stepState = (n: number): 'done' | 'active' | 'todo' => {
    const at = running && !st?.verifying ? 1 : !d ? 1 : st?.before || st?.verifying ? 4 : repairDone || (st?.actionsRun.length ?? 0) > 0 ? 4 : d.status === 'problem' ? 3 : 2
    return n < at ? 'done' : n === at ? 'active' : 'todo'
  }

  const problems = d?.findings.filter((f) => f.status === 'fail' || f.status === 'warn') ?? []
  const repairs = d?.actions.filter((a) => a.kind === 'repair') ?? []
  const opens = d?.actions.filter((a) => a.kind !== 'repair') ?? []
  const beforeProblems = st?.before?.findings.filter((f) => f.status === 'fail' || f.status === 'warn').length

  return (
    <div className="max-w-4xl">
      <button onClick={onBack} className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-accent"><ArrowLeft className="h-4 w-4" /> All problems</button>
      <h1 className="text-xl font-semibold tracking-tight text-fg">{problem.title}</h1>
      <p className="mt-1 text-sm text-muted">{problem.description}</p>

      <div className="my-5 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-line bg-panel px-4 py-3">
        <Step n={1} label="Check (read-only)" state={stepState(1)} />
        <Step n={2} label="Results & cause" state={stepState(2)} />
        <Step n={3} label="Fix (you approve)" state={stepState(3)} />
        <Step n={4} label="Verify" state={stepState(4)} />
      </div>

      {!isWindows && <div className="mb-4"><InfoNote>Guided troubleshooting reads Windows settings and logs, so it runs on Windows only.</InfoNote></div>}
      {st?.error && <div className="mb-4"><ErrorNote>{st.error}</ErrorNote></div>}

      {running && (
        <Card className="mb-4">
          <div className="flex items-center gap-3">
            <Spinner className="h-5 w-5 text-accent" />
            <div>
              <div className="text-sm font-medium text-fg">{st?.verifying ? 'Checking again to verify…' : 'Running read-only checks…'}</div>
              <div className="text-xs text-muted">Nothing on your PC is changed during checks.</div>
            </div>
          </div>
          <ul className="mt-3 grid grid-cols-1 gap-1 text-xs text-muted md:grid-cols-2">
            {(CHECKS[id] ?? []).map((c) => <li key={c} className="flex items-center gap-2"><ShieldCheck className="h-3.5 w-3.5 text-accent" />{c}</li>)}
          </ul>
        </Card>
      )}

      {d && !running && (
        <>
          {st?.before && (
            <div className={clsx('mb-4 rounded-lg border px-4 py-3', d.status === 'ok' ? 'border-ok/40 bg-ok/10' : 'border-warn/40 bg-warn/10')}>
              <div className="text-sm font-semibold text-fg">
                {d.status === 'ok' ? 'Verified: the checks pass now.' : d.status === 'unknown' ? 'Could not verify: the checks did not complete.' : `Not solved yet: ${problems.length} issue(s) remain${beforeProblems !== undefined ? ` (was ${beforeProblems})` : ''}.`}
              </div>
              <div className="text-xs text-muted">
                {d.status === 'ok' ? 'NEXTERM re-ran every check after your changes and found no problems.' : 'Try the next recommended step below, or create a support report for a technician.'}
              </div>
            </div>
          )}

          <div className={clsx('mb-4 rounded-lg border p-4',
            d.status === 'ok' ? 'border-ok/40 bg-ok/5' : d.status === 'problem' ? 'border-warn/40 bg-warn/5' : 'border-line bg-panel')}>
            <div className="flex flex-wrap items-start gap-3">
              <span className="mt-0.5">{d.status === 'ok' ? <CheckCircle2 className="h-5 w-5 text-ok" /> : d.status === 'problem' ? <AlertTriangle className="h-5 w-5 text-warn" /> : <CircleHelp className="h-5 w-5 text-muted" />}</span>
              <div className="min-w-0 flex-1">
                <div className="text-base font-semibold text-fg">{d.headline}</div>
                <div className="mt-0.5 text-sm text-muted">{d.cause}</div>
                <div className="mt-1 text-[11px] text-muted">Checked {new Date(d.ranAt).toLocaleTimeString()} in {(d.durationMs / 1000).toFixed(1)} s{d.elevated ? ' · as administrator' : ''}</div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={verify} icon={<RefreshCw className="h-3.5 w-3.5" />}>Check again</Button>
                <Button size="sm" variant="ghost" onClick={() => { void window.nexterm.clipboard.write(formatDiagnosis(d, problem.title)); setCopied(true); setTimeout(() => setCopied(false), 1500) }} icon={<Copy className="h-3.5 w-3.5" />}>{copied ? 'Copied' : 'Copy results'}</Button>
              </div>
            </div>
            {d.errors.length > 0 && <pre className="selectable mt-3 overflow-auto rounded border border-danger/30 bg-bg p-2 text-[11px] whitespace-pre-wrap text-danger">{d.errors.join('\n')}</pre>}
          </div>

          {repairDone && !st?.before && (
            <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-accent/40 bg-accent/10 px-4 py-3">
              <div className="flex-1 text-sm text-fg">A fix was run. Check again to see whether the problem is actually solved.</div>
              <Button variant="primary" onClick={verify} icon={<RefreshCw className="h-4 w-4" />}>Verify now</Button>
            </div>
          )}

          {d.findings.length > 0 && (
            <Card className="mb-4" title="What NEXTERM found" subtitle={`${d.findings.length} checks · ${problems.length} need attention`}>
              <ul className="divide-y divide-line">{d.findings.map((f) => <FindingRow key={f.id} f={f} />)}</ul>
            </Card>
          )}

          {repairs.length > 0 && (
            <Card className="mb-4" title="Recommended fixes" subtitle="Nothing runs until you click it and confirm. Read-only checks are separate from these changes.">
              <div className="flex flex-col gap-2">{repairs.map((a, i) => <ActionItem key={i} diag={id} action={a} onFinished={onFinished} />)}</div>
            </Card>
          )}

          {(opens.length > 0 || d.advice.length > 0) && (
            <Card className="mb-4" title={repairs.length ? 'More steps' : 'Next steps'}>
              {d.advice.length > 0 && (
                <ul className="mb-3 list-disc space-y-1 pl-5 text-sm text-fg">{d.advice.map((a) => <li key={a}>{a}</li>)}</ul>
              )}
              <div className="flex flex-col gap-2">{opens.map((a, i) => <ActionItem key={i} diag={id} action={a} onFinished={onFinished} />)}</div>
            </Card>
          )}

          {d.status === 'problem' && st?.before && (
            <Card title="Still not working?">
              <p className="text-sm text-muted">Create a support report with these results and your device details, then send it to your IT support or technician.</p>
              <Button className="mt-3" onClick={() => useApp.getState().setPage('reports')}>Create support report</Button>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
