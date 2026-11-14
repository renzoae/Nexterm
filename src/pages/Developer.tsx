import { Braces, Check, Copy, RefreshCw, SquareTerminal, X } from 'lucide-react'
import { useState } from 'react'
import { commandsIn } from '@shared/commands'
import { ToolList } from '@/components/ToolCard'
import { Badge, Button, Card, InfoNote, PageHeader, Spinner } from '@/components/ui'
import { openDefaultTerminal } from '@/features/terminal/TerminalWorkspace'
import { useAsync } from '@/hooks/useAsync'
import { useApp } from '@/stores/app'

function JsonFormatter() {
  const [input, setInput] = useState('')
  const [out, setOut] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const apply = (indent: number) => {
    try {
      setOut(JSON.stringify(JSON.parse(input), null, indent || undefined))
      setErr(null)
    } catch (e) {
      setErr((e as Error).message)
      setOut('')
    }
  }
  return (
    <Card title={<span className="flex items-center gap-2"><Braces className="h-4 w-4 text-accent" />JSON formatter</span>} subtitle="Runs locally; nothing is sent anywhere">
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <textarea value={input} onChange={(e) => setInput(e.target.value)} placeholder='{"paste": "json here"}' spellCheck={false}
          className="h-56 resize-y rounded-md border border-line bg-bg p-2 font-mono text-xs text-fg focus:border-accent focus:outline-none" />
        <pre className="selectable h-56 overflow-auto rounded-md border border-line bg-bg p-2 font-mono text-xs text-fg">{err ? <span className="text-danger">{err}</span> : out}</pre>
      </div>
      <div className="mt-3 flex gap-2">
        <Button variant="primary" onClick={() => apply(2)} disabled={!input.trim()}>Format</Button>
        <Button onClick={() => apply(0)} disabled={!input.trim()}>Minify</Button>
        <Button variant="ghost" onClick={() => void window.nexterm.clipboard.write(out)} disabled={!out} icon={<Copy className="h-3.5 w-3.5" />}>Copy result</Button>
      </div>
    </Card>
  )
}

export function Developer() {
  const tools = useAsync(() => window.nexterm.system.devTools())
  const setPage = useApp((s) => s.setPage)
  return (
    <div>
      <PageHeader
        title="Developer Workspace"
        description="Detected development tools, setup help and utilities."
        actions={<Button onClick={() => { setPage('terminal'); void openDefaultTerminal() }} icon={<SquareTerminal className="h-4 w-4" />}>Open terminal</Button>}
      />
      <Card
        className="mb-4"
        title="Installed tools"
        subtitle="Detected by running each tool's version command"
        actions={<Button size="sm" variant="ghost" onClick={() => void tools.reload()} disabled={tools.loading} icon={tools.loading ? <Spinner className="h-3.5 w-3.5" /> : <RefreshCw className="h-3.5 w-3.5" />}>Re-scan</Button>}
      >
        {!tools.data ? <Spinner /> : (
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
            {tools.data.map((t) => (
              <div key={t.id} className="rounded-md border border-line bg-panel-2 p-3">
                <div className="flex items-center gap-2">
                  {t.found ? <Check className="h-4 w-4 text-ok" /> : <X className="h-4 w-4 text-muted" />}
                  <span className="text-sm font-medium text-fg">{t.name}</span>
                  {t.found ? <Badge tone="ok">{t.version.slice(0, 40)}</Badge> : <Badge>Not found</Badge>}
                </div>
                {!t.found && (
                  <div className="mt-2 flex items-center gap-2">
                    <code className="selectable min-w-0 flex-1 truncate rounded bg-bg px-2 py-1 font-mono text-[11px] text-muted" title={t.hint}>{t.hint}</code>
                    <Button size="sm" variant="ghost" onClick={() => void window.nexterm.clipboard.write(t.hint)} icon={<Copy className="h-3 w-3" />} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
      <div className="mb-4"><JsonFormatter /></div>
      <div className="mb-4">
        <InfoNote>Planned for the next phase: Monaco code editor, project file explorer, Git status and operations, and script management.</InfoNote>
      </div>
      <h2 className="mb-3 text-sm font-semibold text-fg">Development commands</h2>
      <ToolList commands={[...commandsIn('development'), ...commandsIn('git'), ...commandsIn('docker')]} />
    </div>
  )
}
