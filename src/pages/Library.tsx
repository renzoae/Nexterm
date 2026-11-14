import clsx from 'clsx'
import { Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { CATEGORIES, COMMANDS } from '@shared/commands'
import type { CategoryId, Risk, ShellName } from '@shared/types'
import { displayCommand } from '@shared/validation'
import { ToolList } from '@/components/ToolCard'
import { PageHeader, inputCls } from '@/components/ui'
import { useApp } from '@/stores/app'

export function Library() {
  const { libraryQuery, setLibraryQuery } = useApp()
  const [q, setQ] = useState(libraryQuery)
  const [cat, setCat] = useState<CategoryId | 'all'>('all')
  const [shell, setShell] = useState<ShellName | 'all'>('all')
  const [risk, setRisk] = useState<Risk | 'all'>('all')
  const [adminOnly, setAdminOnly] = useState<'all' | 'admin' | 'standard'>('all')

  useEffect(() => {
    if (libraryQuery) {
      setQ(libraryQuery)
      setLibraryQuery('')
    }
  }, [libraryQuery, setLibraryQuery])

  const results = useMemo(() => {
    const s = q.trim().toLowerCase()
    return COMMANDS.filter((c) => {
      if (cat !== 'all' && c.category !== cat) return false
      if (shell !== 'all' && !c.shells.includes(shell)) return false
      if (risk !== 'all' && c.risk !== risk) return false
      if (adminOnly === 'admin' && !c.admin) return false
      if (adminOnly === 'standard' && c.admin) return false
      if (!s) return true
      return `${c.name} ${c.description} ${c.id} ${displayCommand(c)}`.toLowerCase().includes(s)
    })
  }, [q, cat, shell, risk, adminOnly])

  const sel = clsx(inputCls, 'w-auto')
  return (
    <div>
      <PageHeader title="Command Library" description={`${COMMANDS.length} commands with shell compatibility, admin requirement and risk level.`} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute top-2 left-2.5 h-4 w-4 text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, description or command" className={clsx(inputCls, 'w-80 pl-8')} />
        </div>
        <select className={sel} value={cat} onChange={(e) => setCat(e.target.value as CategoryId | 'all')}>
          <option value="all">All categories</option>
          {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className={sel} value={shell} onChange={(e) => setShell(e.target.value as ShellName | 'all')}>
          <option value="all">Any shell</option><option value="powershell">PowerShell</option><option value="cmd">CMD</option>
        </select>
        <select className={sel} value={risk} onChange={(e) => setRisk(e.target.value as Risk | 'all')}>
          <option value="all">Any risk</option><option value="safe">Read-only</option><option value="caution">Caution</option><option value="high">High risk</option>
        </select>
        <select className={sel} value={adminOnly} onChange={(e) => setAdminOnly(e.target.value as 'all' | 'admin' | 'standard')}>
          <option value="all">Any privilege</option><option value="standard">No admin needed</option><option value="admin">Requires admin</option>
        </select>
        <span className="ml-auto text-xs text-muted">{results.length} results</span>
      </div>
      <ToolList commands={results} />
    </div>
  )
}
