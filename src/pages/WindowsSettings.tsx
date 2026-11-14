import { ArrowRight, ExternalLink, Search, Wrench } from 'lucide-react'
import { useMemo, useState } from 'react'
import { SETTINGS, searchSettings } from '@shared/settings-catalog'
import { PROBLEMS } from '@shared/troubleshoot'
import { Button, PageHeader, inputCls } from '@/components/ui'
import { useApp } from '@/stores/app'

export function WindowsSettings() {
  const [q, setQ] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const openProblem = useApp((s) => s.openProblem)
  const results = useMemo(() => searchSettings(q), [q])
  const sections = useMemo(() => [...new Set(SETTINGS.map((s) => s.section))], [])

  const open = async (id: string, title: string) => {
    const r = await window.nexterm.troubleshoot.openSetting(id)
    setMsg(r.ok ? `Opened ${title}.` : r.error ?? 'Could not open.')
  }

  const grouped = q.trim() ? [{ section: `${results.length} result(s)`, items: results }] : sections.map((s) => ({ section: s, items: SETTINGS.filter((x) => x.section === s) }))

  return (
    <div className="max-w-4xl">
      <PageHeader title="Windows Settings" description="Type what you want to change. NEXTERM opens the exact Windows Settings page." />
      <div className="relative mb-2">
        <Search className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-muted" />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && results[0]) void open(results[0].id, results[0].title) }}
          placeholder="e.g. change DNS, bluetooth, brightness, startup apps, microphone…"
          className={`${inputCls} h-10 w-full pl-9 text-base`}
        />
      </div>
      <p className="mb-4 h-4 text-xs text-muted">{msg ?? 'Press Enter to open the top result.'}</p>
      {grouped.map((g) => (
        <div key={g.section} className="mb-5">
          <h2 className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">{g.section}</h2>
          <div className="overflow-hidden rounded-lg border border-line bg-panel">
            {g.items.map((s) => {
              const problem = s.problem ? PROBLEMS.find((p) => p.id === s.problem) : undefined
              return (
                <div key={s.id} className="flex items-center gap-3 border-b border-line px-4 py-2.5 last:border-b-0 hover:bg-panel-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-fg">{s.title}</div>
                    {q && <div className="text-[11px] text-muted">{s.section}</div>}
                  </div>
                  {problem && (
                    <Button size="sm" variant="ghost" onClick={() => openProblem(problem.id)} icon={<Wrench className="h-3.5 w-3.5" />} title={`Guided troubleshooting: ${problem.title}`}>
                      Troubleshoot
                    </Button>
                  )}
                  <Button size="sm" onClick={() => void open(s.id, s.title)} icon={<ExternalLink className="h-3.5 w-3.5" />}>Open</Button>
                </div>
              )
            })}
            {!g.items.length && (
              <div className="px-4 py-6 text-center text-sm text-muted">
                No setting matches “{q}”. <button className="inline-flex items-center gap-1 text-accent" onClick={() => setQ('')}>Show all <ArrowRight className="h-3 w-3" /></button>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
