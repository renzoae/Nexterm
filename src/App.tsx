import { Suspense, lazy, useEffect, useState, type ComponentType, type LazyExoticComponent } from 'react'
import { CommandPalette } from '@/components/CommandPalette'
import { Spinner } from '@/components/ui'
import { NAV, type PageId } from '@/data/nav'
import { openDefaultTerminal } from '@/features/terminal/profiles'
import { Sidebar } from '@/layouts/Sidebar'
import { TopBar } from '@/layouts/TopBar'
import { FixProblem } from '@/pages/FixProblem'
import { useApp } from '@/stores/app'
import { wireRunEvents } from '@/stores/runs'
import { useSettings } from '@/stores/settings'
import { useTerminals } from '@/stores/terminal'

// Pages are code-split and loaded on first visit, which keeps startup fast and memory low.
const page = <K extends string>(load: () => Promise<Record<K, ComponentType>>, name: K) => lazy(() => load().then((m) => ({ default: m[name] })))
const PAGES: Record<Exclude<PageId, 'terminal'>, ComponentType | LazyExoticComponent<ComponentType>> = {
  fix: FixProblem,
  dashboard: page(() => import('@/pages/Dashboard'), 'Dashboard'),
  winsettings: page(() => import('@/pages/WindowsSettings'), 'WindowsSettings'),
  reports: page(() => import('@/pages/Reports'), 'Reports'),
  toolkit: page(() => import('@/pages/Toolkit'), 'Toolkit'),
  network: page(() => import('@/pages/Network'), 'NetworkPage'),
  troubleshooting: page(() => import('@/pages/Troubleshooting'), 'Troubleshooting'),
  hardware: page(() => import('@/pages/Hardware'), 'Hardware'),
  users: page(() => import('@/pages/Users'), 'UsersPage'),
  ad: page(() => import('@/pages/ActiveDirectory'), 'ActiveDirectory'),
  remote: page(() => import('@/pages/Remote'), 'Remote'),
  software: page(() => import('@/pages/Software'), 'Software'),
  developer: page(() => import('@/pages/Developer'), 'Developer'),
  ai: page(() => import('@/pages/AIAssistant'), 'AIAssistant'),
  library: page(() => import('@/pages/Library'), 'Library'),
  settings: page(() => import('@/pages/Settings'), 'SettingsPage')
}
// xterm.js and node-pty sessions are only loaded once the terminal is first opened.
const TerminalWorkspace = lazy(() => import('@/features/terminal/TerminalWorkspace').then((m) => ({ default: m.TerminalWorkspace })))

export function App() {
  const page = useApp((s) => s.page)
  const navNonce = useApp((s) => s.navNonce)
  const theme = useSettings((s) => s.theme)
  const mode = useSettings((s) => s.mode)
  const [terminalUsed, setTerminalUsed] = useState(false)
  useEffect(() => {
    if (page === 'terminal') setTerminalUsed(true)
  }, [page])

  useEffect(() => {
    wireRunEvents()
    void window.nexterm.app.info().then((i) => useApp.getState().setInfo(i))
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('light', theme === 'light')
    void window.nexterm.app.setTheme(theme)
  }, [theme])

  // If the current page is hidden in the new mode, go back to the dashboard.
  useEffect(() => {
    const item = NAV.find((n) => n.id === page)
    if (item && !item.modes.includes(mode) && page !== 'terminal') useApp.getState().setPage('dashboard')
  }, [mode, page])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase()
      const s = useSettings.getState()
      if (e.ctrlKey && !e.shiftKey && key === 'k') {
        e.preventDefault()
        useApp.getState().setPalette(!useApp.getState().paletteOpen)
      } else if (e.ctrlKey && !e.shiftKey && key === 'b') {
        e.preventDefault()
        s.set({ sidebarCollapsed: !s.sidebarCollapsed })
      } else if (e.ctrlKey && e.shiftKey && key === 'e') {
        e.preventDefault()
        s.set({ mode: s.mode === 'easy' ? 'advanced' : 'easy' })
      } else if (e.ctrlKey && e.shiftKey && key === 't') {
        e.preventDefault()
        useApp.getState().setPage('terminal')
        void openDefaultTerminal()
      } else if (e.ctrlKey && e.shiftKey && key === 'w' && useApp.getState().page === 'terminal') {
        e.preventDefault()
        const t = useTerminals.getState()
        if (t.activeTab) t.closeTab(t.activeTab)
      } else if (e.ctrlKey && e.shiftKey && key === 'd' && useApp.getState().page === 'terminal') {
        e.preventDefault()
        useTerminals.getState().split('horizontal')
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])

  const Page = page === 'terminal' ? null : PAGES[page]

  return (
    <div className="flex h-full">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main className="relative min-h-0 flex-1">
          {Page && (
            <div key={`${page}-${navNonce}`} className="animate-in absolute inset-0 overflow-y-auto p-6">
              <Suspense fallback={<Spinner className="h-5 w-5 text-accent" />}>
                <Page />
              </Suspense>
            </div>
          )}
          {terminalUsed && (
            <Suspense fallback={null}>
              <TerminalWorkspace />
            </Suspense>
          )}
        </main>
      </div>
      <CommandPalette />
    </div>
  )
}
