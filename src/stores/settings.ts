import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Mode = 'easy' | 'advanced'
export type Theme = 'dark' | 'light'
export type TerminalThemeId = 'nexterm' | 'campbell' | 'solarized' | 'light'
export const DASHBOARD_WIDGETS = ['cpu', 'memory', 'network', 'updates', 'errors', 'disks', 'startup', 'system'] as const
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
  favorites: string[]
  set: (patch: Partial<Omit<SettingsState, 'set' | 'toggleWidget' | 'toggleFavorite'>>) => void
  toggleWidget: (w: DashboardWidget) => void
  toggleFavorite: (commandId: string) => void
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
      favorites: [],
      set: (patch) => set(patch),
      toggleFavorite: (id) =>
        set((s) => ({ favorites: s.favorites.includes(id) ? s.favorites.filter((x) => x !== id) : [...s.favorites, id].slice(-30) })),
      toggleWidget: (w) =>
        set((s) => ({ widgets: s.widgets.includes(w) ? s.widgets.filter((x) => x !== w) : [...s.widgets, w] }))
    }),
    { name: 'nexterm-settings', version: 2, migrate: (state) => ({ ...(state as object), favorites: [], widgets: [...DASHBOARD_WIDGETS] }) as never }
  )
)
