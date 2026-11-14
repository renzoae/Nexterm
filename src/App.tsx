import { useEffect, type ComponentType } from 'react'
import { CommandPalette } from '@/components/CommandPalette'
import { NAV, type PageId } from '@/data/nav'
import { TerminalWorkspace, openDefaultTerminal } from '@/features/terminal/TerminalWorkspace'
import { Sidebar } from '@/layouts/Sidebar'
import { TopBar } from '@/layouts/TopBar'
import { AIAssistant } from '@/pages/AIAssistant'
import { ActiveDirectory } from '@/pages/ActiveDirectory'
import { Dashboard } from '@/pages/Dashboard'
import { Developer } from '@/pages/Developer'
import { Hardware } from '@/pages/Hardware'
import { Library } from '@/pages/Library'
import { NetworkPage } from '@/pages/Network'
import { Remote } from '@/pages/Remote'
import { SettingsPage } from '@/pages/Settings'
import { Software } from '@/pages/Software'
import { Toolkit } from '@/pages/Toolkit'
import { Troubleshooting } from '@/pages/Troubleshooting'
import { UsersPage } from '@/pages/Users'
import { useApp } from '@/stores/app'
import { wireRunEvents } from '@/stores/runs'
import { useSettings } from '@/stores/settings'
import { useTerminals } from '@/stores/terminal'

const PAGES: Record<Exclude<PageId, 'terminal'>, ComponentType> = {
  dashboard: Dashboard, toolkit: Toolkit, network: NetworkPage, troubleshooting: Troubleshooting, hardware: Hardware,
  users: UsersPage, ad: ActiveDirectory, remote: Remote, software: Software, developer: Developer, ai: AIAssistant,
  library: Library, settings: SettingsPage
}

export function App() {
  const page = useApp((s) => s.page)
  const theme = useSettings((s) => s.theme)
  const mode = useSettings((s) => s.mode)

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
            <div key={page} className="animate-in absolute inset-0 overflow-y-auto p-6">
              <Page />
            </div>
          )}
          <TerminalWorkspace />
        </main>
      </div>
      <CommandPalette />
    </div>
  )
}
