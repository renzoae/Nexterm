import clsx from 'clsx'
import { ArrowUpCircle, Download, RefreshCw, Search, Trash2 } from 'lucide-react'
import { useState } from 'react'
import type { WingetPackage, WingetResult } from '@shared/types'
import type { WingetAction } from '@shared/api'
import { OutputPanel } from '@/components/OutputPanel'
import { Badge, Button, Card, ErrorNote, InfoNote, PageHeader, Spinner, inputCls } from '@/components/ui'
import { useRuns } from '@/stores/runs'

type Tab = 'search' | 'installed' | 'upgrades'
const ACTION_KEY = 'winget:action'

export function Software() {
  const [tab, setTab] = useState<Tab>('search')
  const [query, setQuery] = useState('')
  const [result, setResult] = useState<Record<Tab, WingetResult<WingetPackage[]> | null>>({ search: null, installed: null, upgrades: null })
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState('')
  const run = useRuns((s) => s.byKey[ACTION_KEY])
  const busy = run?.status === 'running'

  const load = async (t: Tab) => {
    setLoading(true)
    try {
      const r =
        t === 'search' ? await window.nexterm.winget.search(query.trim())
          : t === 'installed' ? await window.nexterm.winget.installed()
            : await window.nexterm.winget.upgrades()
      setResult((s) => ({ ...s, [t]: r }))
    } finally {
      setLoading(false)
    }
  }

  const switchTab = (t: Tab) => {
    setTab(t)
    setFilter('')
    if (t !== 'search' && !result[t]) void load(t)
  }

  const act = (action: WingetAction, id: string) => void useRuns.getState().winget(ACTION_KEY, action, id)

  const r = result[tab]
  const rows = r?.ok ? r.data.filter((p) => !filter || `${p.name} ${p.id}`.toLowerCase().includes(filter.toLowerCase())) : []

  return (
    <div>
      <PageHeader title="Software Management" description="Search, install, update and remove apps with Windows Package Manager (winget). Every change asks for confirmation and shows the exact command." />
      <div className="mb-4 flex gap-1 rounded-md border border-line bg-panel p-1 text-sm" role="tablist">
        {(['search', 'installed', 'upgrades'] as const).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => switchTab(t)}
            className={clsx('rounded px-3 py-1.5 capitalize', tab === t ? 'bg-hover text-fg' : 'text-muted hover:text-fg')}>
            {t === 'upgrades' ? 'Updates' : t}
          </button>
        ))}
      </div>

      {run && run.status !== 'idle' && (
        <Card className="mb-4" title="Package operation" subtitle={run.display}>
          <OutputPanel run={run} onClear={() => useRuns.getState().clear(ACTION_KEY)} />
        </Card>
      )}

      <Card>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {tab === 'search' ? (
            <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (query.trim()) void load('search') }}>
              <div className="relative">
                <Search className="pointer-events-none absolute top-2 left-2.5 h-4 w-4 text-muted" />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search packages, e.g. 7zip, vscode, chrome" className={`${inputCls} w-80 pl-8`} />
              </div>
              <Button type="submit" variant="primary" disabled={!query.trim() || loading}>Search</Button>
            </form>
          ) : (
            <>
              <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter" className={`${inputCls} w-64`} />
              <Button onClick={() => void load(tab)} disabled={loading} icon={<RefreshCw className="h-4 w-4" />}>Refresh</Button>
            </>
          )}
          {loading && <Spinner />}
          {r?.ok && <span className="ml-auto text-xs text-muted">{rows.length} packages</span>}
        </div>

        {r && !r.ok && <ErrorNote>{r.error}</ErrorNote>}
        {!r && tab === 'search' && <InfoNote>Search the winget community repository. Results come straight from winget on this PC.</InfoNote>}
        {r?.ok && (
          <div className="max-h-[60vh] overflow-auto">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-panel text-muted">
                <tr className="border-b border-line">
                  <th className="py-2 font-medium">Name</th><th className="font-medium">Id</th><th className="font-medium">Version</th>
                  {tab === 'upgrades' && <th className="font-medium">Available</th>}
                  {tab !== 'search' && <th className="font-medium">Source</th>}
                  <th className="text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id + p.version} className="border-b border-line/50 text-fg">
                    <td className="py-1.5 pr-3">{p.name}</td>
                    <td className="selectable pr-3 font-mono text-muted">{p.id}</td>
                    <td className="pr-3 font-mono">{p.version}</td>
                    {tab === 'upgrades' && <td className="pr-3 font-mono text-accent">{p.available}</td>}
                    {tab !== 'search' && <td className="pr-3">{p.source ? <Badge>{p.source}</Badge> : <span className="text-muted">—</span>}</td>}
                    <td className="py-1 text-right">
                      {tab === 'search' && <Button size="sm" disabled={busy} onClick={() => act('install', p.id)} icon={<Download className="h-3.5 w-3.5" />}>Install</Button>}
                      {tab === 'upgrades' && <Button size="sm" disabled={busy} onClick={() => act('upgrade', p.id)} icon={<ArrowUpCircle className="h-3.5 w-3.5" />}>Update</Button>}
                      {tab === 'installed' && (
                        <Button size="sm" variant="ghost" disabled={busy || !p.source} title={p.source ? 'Uninstall' : 'Not managed by a winget source; uninstall from Programs and Features'} onClick={() => act('uninstall', p.id)} icon={<Trash2 className="h-3.5 w-3.5" />}>Uninstall</Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!rows.length && <p className="py-4 text-center text-sm text-muted">No packages found.</p>}
          </div>
        )}
      </Card>
    </div>
  )
}
