import clsx from 'clsx'
import { AppWindow, Cog, Gauge, Globe, HardDrive, Power, Printer, RefreshCw, Star, Volume2, Wifi, type LucideIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { getCommand } from '@shared/commands'
import { PROBLEMS, type ProblemDef } from '@shared/troubleshoot'
import { ToolCard } from '@/components/ToolCard'
import { Badge, Card, PageHeader } from '@/components/ui'
import { Workflow } from '@/features/troubleshoot/Workflow'
import { useAsync } from '@/hooks/useAsync'
import { useApp } from '@/stores/app'
import { useSettings } from '@/stores/settings'
import { useTroubleshoot } from '@/stores/troubleshoot'

const ICONS: Record<ProblemDef['icon'], LucideIcon> = {
  wifi: Wifi, globe: Globe, gauge: Gauge, refresh: RefreshCw, volume: Volume2, 'hard-drive': HardDrive, app: AppWindow, power: Power, printer: Printer, cog: Cog
}

export function FixProblem() {
  const [selected, setSelected] = useState<ProblemDef | null>(() => {
    const id = useApp.getState().takePendingProblem()
    return PROBLEMS.find((p) => p.id === id) ?? null
  })
  const pending = useApp((s) => s.pendingProblem)
  useEffect(() => {
    if (!pending) return
    const p = PROBLEMS.find((x) => x.id === useApp.getState().takePendingProblem())
    if (p) setSelected(p)
  }, [pending])
  const favorites = useSettings((s) => s.favorites)
  const byId = useTroubleshoot((s) => s.byId)
  const history = useAsync(() => window.nexterm.troubleshoot.history(), { enabled: !selected })

  if (selected) return <Workflow problem={selected} onBack={() => setSelected(null)} />

  const favCommands = favorites.map((id) => getCommand(id)).filter((c) => !!c)

  return (
    <div>
      <PageHeader title="What’s wrong?" description="Pick a problem. NEXTERM runs safe, read-only checks, explains what it found, and suggests fixes that you approve." />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {PROBLEMS.map((p) => {
          const Icon = ICONS[p.icon]
          const last = byId[p.diagnosis]?.current
          return (
            <button key={p.id} onClick={() => setSelected(p)}
              className="animate-in flex items-start gap-3 rounded-lg border border-line bg-panel p-4 text-left transition-colors hover:border-accent/50 hover:bg-panel-2">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/12"><Icon className="h-5 w-5 text-accent" /></span>
              <span className="min-w-0">
                <span className="flex items-center gap-2 text-sm font-semibold text-fg">
                  {p.title}
                  {last && <Badge tone={last.status === 'ok' ? 'ok' : last.status === 'problem' ? 'warn' : 'neutral'}>{last.status === 'ok' ? 'OK' : last.status === 'problem' ? 'Needs attention' : 'Unknown'}</Badge>}
                </span>
                <span className="mt-1 block text-xs text-muted">{p.description}</span>
              </span>
            </button>
          )
        })}
      </div>

      {favCommands.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-fg"><Star className="h-4 w-4 text-warn" fill="currentColor" />Favorite tools</h2>
          <div className="flex flex-col gap-3">{favCommands.map((c) => <ToolCard key={c.id} cmd={c} />)}</div>
        </div>
      )}

      {!!history.data?.length && (
        <Card className="mt-8" title="Recent troubleshooting" subtitle="Stored on this PC only">
          <ul className="divide-y divide-line text-xs">
            {history.data.slice(0, 8).map((h, i) => {
              const p = PROBLEMS.find((x) => x.diagnosis === h.diagnosisId)
              return (
                <li key={i} className="flex flex-wrap items-center gap-2 py-2">
                  <Badge tone={h.status === 'ok' ? 'ok' : h.status === 'problem' ? 'warn' : 'neutral'}>{h.status === 'ok' ? 'OK' : h.status === 'problem' ? `${h.problems} issue(s)` : '?'}</Badge>
                  <span className="font-medium text-fg">{p?.title ?? h.diagnosisId}</span>
                  <span className={clsx('min-w-0 flex-1 truncate text-muted')}>{h.afterActions.length ? `Verified after: ${h.afterActions.join(', ')}. ` : ''}{h.headline}</span>
                  <span className="text-muted">{new Date(h.ts).toLocaleString()}</span>
                </li>
              )
            })}
          </ul>
        </Card>
      )}
    </div>
  )
}
