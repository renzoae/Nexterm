import { Bot, Check } from 'lucide-react'
import { Badge, Card, PageHeader } from '@/components/ui'

const PLANNED = [
  'Explain terminal commands and diagnostic output',
  'Explain Windows and PowerShell errors',
  'Suggest troubleshooting steps for DNS, Windows Update, services and more',
  'Help write PowerShell and Python scripts',
  'Bring your own provider and API key, stored with Windows Credential Manager'
]

const RULES = [
  'AI suggestions are always labelled separately from verified diagnostic results',
  'AI-generated commands are never executed automatically',
  'Running commands, editing files or changing settings always requires your explicit approval',
  'The assistant is optional and off by default'
]

export function AIAssistant() {
  return (
    <div>
      <PageHeader title="AI Assistant" description="An optional assistant for IT support and scripting." />
      <Card className="mb-4" title={<span className="flex items-center gap-2"><Bot className="h-4 w-4 text-accent" />Status <Badge tone="warn">Planned: Phase 4</Badge></span>}>
        <p className="text-sm text-muted">
          The assistant is not part of this release. Nothing on this page sends data anywhere. It will arrive in a later version, with the safety rules below.
        </p>
      </Card>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="What it will do">
          <ul className="space-y-2 text-sm text-fg">{PLANNED.map((p) => <li key={p} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" />{p}</li>)}</ul>
        </Card>
        <Card title="Safety rules">
          <ul className="space-y-2 text-sm text-fg">{RULES.map((p) => <li key={p} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-ok" />{p}</li>)}</ul>
        </Card>
      </div>
    </div>
  )
}
