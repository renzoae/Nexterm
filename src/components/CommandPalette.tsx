import clsx from 'clsx'
import { CornerDownLeft, Search, SquareTerminal, Wrench, type LucideIcon } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { CATEGORIES, COMMANDS } from '@shared/commands'
import { NAV } from '@/data/nav'
import { getProfiles } from '@/features/terminal/TerminalWorkspace'
import { useApp } from '@/stores/app'
import { useSettings } from '@/stores/settings'
import { useTerminals } from '@/stores/terminal'
import type { TerminalProfile } from '@shared/types'

interface Item {
  id: string
  label: string
  hint: string
  group: string
  icon: LucideIcon
  keywords: string
  run: () => void
}

function score(item: Item, q: string): number {
  if (!q) return 1
  const hay = `${item.label} ${item.keywords}`.toLowerCase()
  const words = q.toLowerCase().split(/\s+/).filter(Boolean)
  let s = 0
  for (const w of words) {
    const i = hay.indexOf(w)
    if (i < 0) return 0
    s += i === 0 ? 3 : item.label.toLowerCase().includes(w) ? 2 : 1
  }
  return s
}

export function CommandPalette() {
  const { paletteOpen, setPalette, setPage, setLibraryQuery } = useApp()
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(0)
  const [profiles, setProfiles] = useState<TerminalProfile[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (paletteOpen) {
      setQ('')
      setSel(0)
      void getProfiles().then(setProfiles)
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [paletteOpen])

  const items = useMemo<Item[]>(() => {
    const close = () => setPalette(false)
    const pages: Item[] = NAV.map((n) => ({
      id: `page:${n.id}`, label: n.label, hint: n.description, group: 'Pages', icon: n.icon, keywords: n.description,
      run: () => { setPage(n.id); close() }
    }))
    const terms: Item[] = profiles.map((p) => ({
      id: `term:${p.id}`, label: `New ${p.name} terminal`, hint: 'Terminal', group: 'Actions', icon: SquareTerminal, keywords: 'shell open tab',
      run: () => { useTerminals.getState().openTab({ profileId: p.id, title: p.name }); setPage('terminal'); close() }
    }))
    const s = useSettings.getState()
    const actions: Item[] = [
      { id: 'act:mode', label: `Switch to ${s.mode === 'easy' ? 'Advanced' : 'Easy'} Mode`, hint: 'Ctrl+Shift+E', group: 'Actions', icon: Wrench, keywords: 'mode easy advanced', run: () => { s.set({ mode: s.mode === 'easy' ? 'advanced' : 'easy' }); close() } },
      { id: 'act:theme', label: `Switch to ${s.theme === 'dark' ? 'light' : 'dark'} theme`, hint: 'Appearance', group: 'Actions', icon: Wrench, keywords: 'theme dark light', run: () => { s.set({ theme: s.theme === 'dark' ? 'light' : 'dark' }); close() } }
    ]
    const cmds: Item[] = COMMANDS.map((c) => ({
      id: `cmd:${c.id}`, label: c.name, hint: CATEGORIES.find((x) => x.id === c.category)?.name ?? '', group: 'Tools', icon: Wrench,
      keywords: `${c.description} ${c.category} ${c.exec.kind === 'exe' ? c.exec.file : c.exec.kind === 'cmd' ? c.exec.line : c.exec.script.slice(0, 80)}`,
      run: () => { setLibraryQuery(c.name); setPage('library'); if (s.mode === 'easy') s.set({ mode: 'advanced' }); close() }
    }))
    return [...pages, ...actions, ...terms, ...cmds]
  }, [profiles, setPage, setPalette, setLibraryQuery])

  const results = useMemo(
    () => items.map((i) => ({ i, s: score(i, q) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s).slice(0, 40).map((x) => x.i),
    [items, q]
  )

  if (!paletteOpen) return null
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-24" onMouseDown={() => setPalette(false)}>
      <div className="animate-in w-[640px] max-w-[90vw] overflow-hidden rounded-xl border border-line bg-panel shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-line px-3">
          <Search className="h-4 w-4 text-muted" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => { setQ(e.target.value); setSel(0) }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setPalette(false)
              if (e.key === 'ArrowDown') { e.preventDefault(); setSel((v) => Math.min(results.length - 1, v + 1)) }
              if (e.key === 'ArrowUp') { e.preventDefault(); setSel((v) => Math.max(0, v - 1)) }
              if (e.key === 'Enter') results[sel]?.run()
            }}
            placeholder="Type a page, tool or command…"
            className="h-12 flex-1 bg-transparent text-sm text-fg placeholder:text-muted focus:outline-none"
          />
          <kbd className="rounded border border-line px-1.5 py-0.5 font-mono text-[10px] text-muted">Esc</kbd>
        </div>
        <div className="max-h-[420px] overflow-y-auto p-1">
          {results.map((r, idx) => {
            const Icon = r.icon
            return (
              <button
                key={r.id}
                onMouseEnter={() => setSel(idx)}
                onClick={r.run}
                className={clsx('flex w-full items-center gap-3 rounded-md px-3 py-2 text-left', idx === sel ? 'bg-hover' : '')}
              >
                <Icon className="h-4 w-4 shrink-0 text-accent" />
                <span className="truncate text-sm text-fg">{r.label}</span>
                <span className="ml-auto truncate text-xs text-muted">{r.group} · {r.hint}</span>
                {idx === sel && <CornerDownLeft className="h-3.5 w-3.5 text-muted" />}
              </button>
            )
          })}
          {!results.length && <p className="px-3 py-6 text-center text-sm text-muted">No results</p>}
        </div>
      </div>
    </div>
  )
}
