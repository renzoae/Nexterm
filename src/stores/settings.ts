import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Mode = 'easy' | 'advanced'
export type Theme = 'dark' | 'light'
export type TerminalThemeId = 'nexterm' | 'campbell' | 'solarized' | 'light'
export const DASHBOARD_WIDGETS = ['system', 'cpu', 'memory', 'network', 'disks', 'quick'] as const
export type DashboardWidget = (typeof DASHBOARD_WIDGETS)[number]

interface SettingsState {
  mode: Mode
  theme: Theme
  sidebarCollapsed: boolean
  fontFamily: string
  fontSize: number
  cursorStyle: 'block' | 'bar' | 'underline'
  scrollback: number
  terminalTheme: TerminalThemeId
  defaultProfile: string
  widgets: DashboardWidget[]
  set: (patch: Partial<Omit<SettingsState, 'set' | 'toggleWidget'>>) => void
  toggleWidget: (w: DashboardWidget) => void
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      mode: 'easy',
      theme: 'dark',
      sidebarCollapsed: false,
      fontFamily: "'Cascadia Mono', 'Cascadia Code', Consolas, 'Courier New', monospace",
      fontSize: 14,
      cursorStyle: 'bar',
      scrollback: 10000,
      terminalTheme: 'nexterm',
      defaultProfile: '',
      widgets: [...DASHBOARD_WIDGETS],
      set: (patch) => set(patch),
      toggleWidget: (w) =>
        set((s) => ({ widgets: s.widgets.includes(w) ? s.widgets.filter((x) => x !== w) : [...s.widgets, w] }))
    }),
    { name: 'nexterm-settings', version: 1 }
  )
)
