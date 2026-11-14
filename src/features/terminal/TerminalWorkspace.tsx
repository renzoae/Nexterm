import clsx from 'clsx'
import { ChevronDown, Columns2, Plus, Rows2, SquareTerminal, X } from 'lucide-react'
import { Fragment, useEffect, useRef, useState } from 'react'
import { Group, Panel, Separator } from 'react-resizable-panels'
import { Button } from '@/components/ui'
import { useApp } from '@/stores/app'
import { MAX_PANES, useTerminals } from '@/stores/terminal'
import { TerminalPane } from './TerminalPane'
import { openDefaultTerminal, useProfiles } from './profiles'

export function TerminalWorkspace() {
  const visible = useApp((s) => s.page === 'terminal')
  const { tabs, activeTab, setActive, closeTab, split, openTab } = useTerminals()
  const profiles = useProfiles()
  const [menu, setMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Open a first tab the first time the terminal page is shown.
  const opened = useRef(false)
  useEffect(() => {
    if (visible && !opened.current && tabs.length === 0 && profiles.length) {
      opened.current = true
      void openDefaultTerminal()
    }
  }, [visible, tabs.length, profiles.length])

  useEffect(() => {
    if (!menu) return
    const close = (e: MouseEvent) => !menuRef.current?.contains(e.target as Node) && setMenu(false)
    window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [menu])

  const active = tabs.find((t) => t.id === activeTab)

  return (
    <div className={clsx('absolute inset-0 flex flex-col bg-bg', !visible && 'invisible pointer-events-none')} aria-hidden={!visible}>
      <div className="flex h-10 shrink-0 items-center gap-1 border-b border-line bg-panel px-2">
        <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
          {tabs.map((t) => {
            const title = t.panes.find((p) => p.paneId === t.activePane)?.title ?? t.panes[0]?.title ?? 'Terminal'
            return (
              <div
                key={t.id}
                onClick={() => setActive(t.id)}
                onAuxClick={(e) => e.button === 1 && closeTab(t.id)}
                className={clsx(
                  'group flex h-7 max-w-52 shrink-0 cursor-pointer items-center gap-1.5 rounded-md px-2 text-xs',
                  t.id === activeTab ? 'bg-hover text-fg' : 'text-muted hover:bg-hover/60 hover:text-fg'
                )}
              >
                <SquareTerminal className="h-3.5 w-3.5 shrink-0 text-accent" />
                <span className="truncate">{title}</span>
                {t.panes.length > 1 && <span className="text-[10px] text-muted">×{t.panes.length}</span>}
                <button
                  className="ml-1 rounded p-0.5 opacity-60 hover:bg-line hover:opacity-100"
                  onClick={(e) => { e.stopPropagation(); closeTab(t.id) }}
                  title="Close tab (Ctrl+Shift+W)"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )
          })}
          <div className="relative" ref={menuRef}>
            <div className="flex">
              <button className="rounded-l-md p-1.5 text-muted hover:bg-hover hover:text-fg" onClick={() => void openDefaultTerminal()} title="New tab (Ctrl+Shift+T)">
                <Plus className="h-4 w-4" />
              </button>
              <button className="rounded-r-md p-1.5 text-muted hover:bg-hover hover:text-fg" onClick={() => setMenu((m) => !m)} title="Choose shell">
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
            </div>
            {menu && (
              <div className="fixed z-50 mt-1 w-56 rounded-md border border-line bg-panel p-1 shadow-xl">
                {profiles.map((p) => (
                  <button
                    key={p.id}
                    className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-fg hover:bg-hover"
                    onClick={() => { openTab({ profileId: p.id, title: p.name }); setMenu(false) }}
                  >
                    <SquareTerminal className="h-4 w-4 text-accent" /> {p.name}
                  </button>
                ))}
                {!profiles.length && <p className="px-2 py-1.5 text-xs text-muted">No shells detected</p>}
              </div>
            )}
          </div>
        </div>
        <Button size="sm" variant="ghost" onClick={() => split('horizontal')} disabled={!active || active.panes.length >= MAX_PANES} title="Split right (Ctrl+Shift+D)" icon={<Columns2 className="h-4 w-4" />} />
        <Button size="sm" variant="ghost" onClick={() => split('vertical')} disabled={!active || active.panes.length >= MAX_PANES} title="Split down" icon={<Rows2 className="h-4 w-4" />} />
      </div>

      <div className="relative min-h-0 flex-1">
        {tabs.map((t) => (
          <div key={t.id} className={clsx('absolute inset-0', t.id !== activeTab && 'invisible')}>
            <Group orientation={t.direction} className="h-full w-full">
              {t.panes.map((p, i) => (
                <Fragment key={p.paneId}>
                  {i > 0 && <Separator className={clsx('bg-line hover:bg-accent', t.direction === 'horizontal' ? 'w-1' : 'h-1')} />}
                  <Panel id={p.paneId} minSize="10" className="h-full w-full">
                    <TerminalPane tabId={t.id} pane={p} active={t.activePane === p.paneId} visible={visible && t.id === activeTab} />
                  </Panel>
                </Fragment>
              ))}
            </Group>
          </div>
        ))}
        {tabs.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-muted">
            <SquareTerminal className="h-10 w-10 text-accent" />
            <p className="text-sm">No terminal sessions open.</p>
            <Button variant="primary" onClick={() => void openDefaultTerminal()} icon={<Plus className="h-4 w-4" />}>New terminal</Button>
          </div>
        )}
      </div>
      <div className="flex h-6 shrink-0 items-center gap-4 border-t border-line bg-panel px-3 text-[11px] text-muted">
        <span>Ctrl+Shift+C / V copy &amp; paste</span>
        <span>Right-click: copy selection or paste</span>
        <span>Ctrl+Shift+F search</span>
        <span>Ctrl+Shift+D split</span>
      </div>
    </div>
  )
}
