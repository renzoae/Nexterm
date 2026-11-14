import clsx from 'clsx'
import { PanelLeftClose, PanelLeftOpen, Terminal } from 'lucide-react'
import { NAV } from '@/data/nav'
import { useApp } from '@/stores/app'
import { useSettings } from '@/stores/settings'

export function Sidebar() {
  const { mode, sidebarCollapsed, set } = useSettings()
  const { page, setPage } = useApp()
  const items = NAV.filter((n) => n.modes.includes(mode))

  return (
    <aside className={clsx('flex shrink-0 flex-col border-r border-line bg-panel transition-[width] duration-200', sidebarCollapsed ? 'w-14' : 'w-60')}>
      <div className="drag flex h-10 items-center gap-2 border-b border-line px-3">
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-accent-2 to-accent">
          <Terminal className="h-3.5 w-3.5 text-white" />
        </div>
        {!sidebarCollapsed && <span className="text-sm font-bold tracking-[0.2em] text-fg">NEXTERM</span>}
      </div>
      <nav className="flex-1 overflow-y-auto overflow-x-hidden p-2">
        {items.map((n) => {
          const Icon = n.icon
          const active = page === n.id
          return (
            <button
              key={n.id}
              onClick={() => setPage(n.id)}
              title={sidebarCollapsed ? n.label : n.description}
              className={clsx(
                'relative mb-0.5 flex h-9 w-full items-center gap-3 rounded-md px-2.5 text-sm transition-colors',
                active ? 'bg-accent/12 text-fg' : 'text-muted hover:bg-hover hover:text-fg'
              )}
            >
              {active && <span className="absolute top-2 bottom-2 left-0 w-0.5 rounded-full bg-accent" />}
              <Icon className={clsx('h-4 w-4 shrink-0', active && 'text-accent')} />
              {!sidebarCollapsed && <span className="truncate">{n.label}</span>}
            </button>
          )
        })}
      </nav>
      <button
        onClick={() => set({ sidebarCollapsed: !sidebarCollapsed })}
        className="flex h-10 items-center gap-3 border-t border-line px-4 text-xs text-muted hover:text-fg"
        title="Toggle sidebar (Ctrl+B)"
      >
        {sidebarCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <><PanelLeftClose className="h-4 w-4" /> Collapse</>}
      </button>
    </aside>
  )
}
