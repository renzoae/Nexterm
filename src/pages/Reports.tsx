import { Copy, FileText, Save } from 'lucide-react'
import { useState } from 'react'
import { PROBLEMS } from '@shared/troubleshoot'
import { Badge, Button, Card, ErrorNote, InfoNote, PageHeader, Spinner } from '@/components/ui'
import { useAsync } from '@/hooks/useAsync'

export function Reports() {
  const [identity, setIdentity] = useState(false)
  const [text, setText] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const history = useAsync(() => window.nexterm.troubleshoot.history())

  const generate = async () => {
    setBusy(true)
    setErr(null)
    setMsg(null)
    try {
      setText(await window.nexterm.troubleshoot.report(identity))
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-5xl">
      <PageHeader title="Support Report" description="A device and health summary built from live data, ready to paste into a ticket or send to a technician." />
      <Card className="mb-4">
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-fg">
            <input type="checkbox" checked={identity} onChange={(e) => setIdentity(e.target.checked)} className="accent-[var(--accent)]" />
            Include computer name, user name and full MAC/IPv6 addresses
          </label>
          <Button variant="primary" className="ml-auto" onClick={() => void generate()} disabled={busy} icon={busy ? <Spinner /> : <FileText className="h-4 w-4" />}>
            {busy ? 'Collecting…' : text ? 'Regenerate' : 'Generate report'}
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted">Never included: passwords, keys, browsing data or file contents. Identifying details are off by default. Results of any checks you ran in “Fix a Problem” are added automatically.</p>
      </Card>
      {err && <ErrorNote>{err}</ErrorNote>}
      {text && (
        <Card
          className="mb-4"
          title="Report preview"
          actions={
            <>
              {msg && <span className="text-xs text-muted">{msg}</span>}
              <Button size="sm" onClick={() => { void window.nexterm.clipboard.write(text); setMsg('Copied to clipboard.') }} icon={<Copy className="h-3.5 w-3.5" />}>Copy</Button>
              <Button size="sm" onClick={async () => { const r = await window.nexterm.troubleshoot.saveReport(text); if (r.ok) setMsg(`Saved to ${r.path}`) }} icon={<Save className="h-3.5 w-3.5" />}>Save…</Button>
            </>
          }
        >
          <pre className="selectable max-h-[55vh] overflow-auto rounded-md border border-line bg-bg p-3 font-mono text-xs whitespace-pre-wrap text-fg">{text}</pre>
        </Card>
      )}
      {!text && !busy && <InfoNote>Generating takes a few seconds: it reads system information, network status, update history and recent errors.</InfoNote>}

      <Card className="mt-4" title="Troubleshooting history" subtitle="Every check and verification run on this PC">
        {history.data?.length ? (
          <ul className="max-h-80 divide-y divide-line overflow-auto text-xs">
            {history.data.map((h, i) => (
              <li key={i} className="flex flex-wrap items-center gap-2 py-1.5">
                <span className="w-36 shrink-0 text-muted">{new Date(h.ts).toLocaleString()}</span>
                <Badge tone={h.status === 'ok' ? 'ok' : h.status === 'problem' ? 'warn' : 'neutral'}>{h.status}</Badge>
                <span className="font-medium text-fg">{PROBLEMS.find((p) => p.diagnosis === h.diagnosisId)?.title ?? h.diagnosisId}</span>
                <span className="min-w-0 flex-1 truncate text-muted" title={h.headline}>{h.afterActions.length ? `Verification after ${h.afterActions.join(', ')}: ` : ''}{h.headline}</span>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-muted">No troubleshooting has been run yet.</p>}
      </Card>
    </div>
  )
}
