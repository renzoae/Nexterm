import clsx from 'clsx'
import { ArrowLeft, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { CATEGORIES, COMMANDS } from '@shared/commands'
import type { CategoryId } from '@shared/types'
import { ToolList } from '@/components/ToolCard'
import { Button, PageHeader, inputCls } from '@/components/ui'

export function Toolkit() {
  const [cat, setCat] = useState<CategoryId | null>(null)
  const [q, setQ] = useState('')
  const counts = useMemo(() => Object.fromEntries(CATEGORIES.map((c) => [c.id, COMMANDS.filter((x) => x.category === c.id).length])), [])
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    return COMMANDS.filter((c) => (!cat || c.category === cat) && (!s || `${c.name} ${c.description} ${c.explain}`.toLowerCase().includes(s)))
  }, [cat, q])
  const current = CATEGORIES.find((c) => c.id === cat)

  return (
    <div>
      <PageHeader
        title={current ? current.name : 'IT Support Toolkit'}
        description={current ? current.description : `${COMMANDS.length} real Windows diagnostics. Read-only tools run immediately; anything that changes the system asks first.`}
        actions={cat && <Button variant="ghost" onClick={() => setCat(null)} icon={<ArrowLeft className="h-4 w-4" />}>All categories</Button>}
      />
      <div className="relative mb-4 max-w-md">
        <Search className="pointer-events-none absolute top-2 left-2.5 h-4 w-4 text-muted" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tools (e.g. dns, disk, printer)" className={clsx(inputCls, 'w-full pl-8')} />
      </div>
      {!cat && !q ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              onClick={() => setCat(c.id)}
              className="animate-in flex flex-col items-start rounded-lg border border-line bg-panel p-4 text-left transition-colors hover:border-accent/40 hover:bg-panel-2"
            >
              <span className="text-sm font-semibold text-fg">{c.name}</span>
              <span className="mt-1 text-xs text-muted">{c.description}</span>
              <span className="mt-3 text-[11px] font-medium text-accent">{counts[c.id]} tools</span>
            </button>
          ))}
        </div>
      ) : (
        <ToolList commands={filtered} />
      )}
    </div>
  )
}
