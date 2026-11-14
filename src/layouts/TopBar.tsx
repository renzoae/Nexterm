import clsx from 'clsx'
import { Moon, Search, ShieldAlert, ShieldCheck, Sun } from 'lucide-react'
import { NAV } from '@/data/nav'
import { useApp } from '@/stores/app'
import { useSettings } from '@/stores/settings'

export function TopBar() {
  const { page, info, setPalette } = useApp()
  const { mode, theme, set } = useSettings()
  const title = NAV.find((n) => n.id === page)?.label ?? ''

  return (
    <header className="drag titlebar-pad flex h-10 shrink-0 items-center gap-3 border-b border-line bg-panel pl-4">
      <span className="text-sm font-medium text-fg">{title}</span>
      <button
        onClick={() => setPalette(true)}
        className="no-drag mx-auto flex h-7 w-full max-w-md items-center gap-2 rounded-md border border-line bg-bg px-2.5 text-xs text-muted hover:border-accent/40"
      >
        <Search className="h-3.5 w-3.5" />
        <span>Search tools, commands and pages…</span>
        <kbd className="ml-auto rounded border border-line px-1.5 py-0.5 font-mono text-[10px]">Ctrl K</kbd>
      </button>
      <div className="no-drag flex items-center gap-2">
        {info && (
          <span
            className={clsx('flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium', info.isAdmin ? 'bg-warn/15 text-warn' : 'bg-hover text-muted')}
            title={info.isAdmin ? 'NEXTERM is running with administrator privileges' : 'Running as a standard user. Admin tools open an elevated window after a UAC prompt.'}
          >
            {info.isAdmin ? <ShieldAlert className="h-3.5 w-3.5" /> : <ShieldCheck className="h-3.5 w-3.5" />}
            {info.isAdmin ? 'Administrator' : 'Standard user'}
          </span>
        )}
        <div className="flex rounded-md border border-line bg-bg p-0.5 text-xs" role="radiogroup" aria-label="Mode">
          {(['easy', 'advanced'] as const).map((m) => (
            <button
              key={m}
              role="radio"
              aria-checked={mode === m}
              onClick={() => set({ mode: m })}
              title="Switch mode (Ctrl+Shift+E)"
              className={clsx('rounded px-2.5 py-1 font-medium capitalize transition-colors', mode === m ? 'bg-accent text-accent-fg' : 'text-muted hover:text-fg')}
            >
              {m}
            </button>
          ))}
        </div>
        <button
          onClick={() => set({ theme: theme === 'dark' ? 'light' : 'dark' })}
          className="rounded-md p-1.5 text-muted hover:bg-hover hover:text-fg"
          title="Toggle theme"
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
      </div>
    </header>
  )
}
