import { ExternalLink, ShieldAlert } from 'lucide-react'
import { useState } from 'react'
import { useAsync } from '@/hooks/useAsync'
import { Card } from './ui'

export function LaunchGrid({ ids, title = 'Windows management tools' }: { ids?: string[]; title?: string }) {
  const { data } = useAsync(() => window.nexterm.launch.tools())
  const [msg, setMsg] = useState<string | null>(null)
  const tools = (data ?? []).filter((t) => !ids || ids.includes(t.id))
  if (!tools.length) return null
  return (
    <Card title={title} subtitle="Opens the built-in Windows console" className="mb-4">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-5">
        {tools.map((t) => (
          <button
            key={t.id}
            onClick={async () => {
              const r = await window.nexterm.launch.tool(t.id)
              setMsg(r.ok ? null : `${t.name}: ${r.error}`)
            }}
            className="group flex flex-col items-start gap-0.5 rounded-md border border-line bg-panel-2 px-3 py-2 text-left hover:border-accent/40 hover:bg-hover"
            title={t.description}
          >
            <span className="flex w-full items-center gap-1.5 text-sm font-medium text-fg">
              {t.name}
              {t.admin && <ShieldAlert className="h-3 w-3 text-warn" aria-label="Requires administrator" />}
              <ExternalLink className="ml-auto h-3 w-3 text-muted opacity-0 group-hover:opacity-100" />
            </span>
            <span className="text-[11px] text-muted">{t.description}</span>
          </button>
        ))}
      </div>
      {msg && <p className="mt-2 text-xs text-danger">{msg}</p>}
    </Card>
  )
}
