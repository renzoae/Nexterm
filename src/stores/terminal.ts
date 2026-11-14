import { create } from 'zustand'

export interface Pane {
  paneId: string
  profileId?: string
  sshProfileId?: string
  title: string
  initialInput?: string
}

export interface Tab {
  id: string
  panes: Pane[]
  direction: 'horizontal' | 'vertical'
  activePane: string
}

let seq = 0
const uid = (p: string) => `${p}-${Date.now().toString(36)}-${++seq}`

interface TerminalStore {
  tabs: Tab[]
  activeTab: string | null
  openTab: (opts: { profileId?: string; sshProfileId?: string; title: string; initialInput?: string }) => void
  closeTab: (id: string) => void
  split: (direction: 'horizontal' | 'vertical') => void
  closePane: (tabId: string, paneId: string) => void
  setActive: (tabId: string, paneId?: string) => void
  setPaneTitle: (paneId: string, title: string) => void
  consumeInitialInput: (paneId: string) => string | undefined
}

export const MAX_PANES = 4

export const useTerminals = create<TerminalStore>()((set, get) => ({
  tabs: [],
  activeTab: null,
  openTab: ({ profileId, sshProfileId, title, initialInput }) => {
    const pane: Pane = { paneId: uid('pane'), profileId, sshProfileId, title, initialInput }
    const tab: Tab = { id: uid('tab'), panes: [pane], direction: 'horizontal', activePane: pane.paneId }
    set((s) => ({ tabs: [...s.tabs, tab], activeTab: tab.id }))
  },
  closeTab: (id) =>
    set((s) => {
      const idx = s.tabs.findIndex((t) => t.id === id)
      const tabs = s.tabs.filter((t) => t.id !== id)
      const activeTab = s.activeTab === id ? (tabs[Math.max(0, idx - 1)]?.id ?? null) : s.activeTab
      return { tabs, activeTab }
    }),
  split: (direction) =>
    set((s) => {
      const tab = s.tabs.find((t) => t.id === s.activeTab)
      if (!tab || tab.panes.length >= MAX_PANES) return s
      const src = tab.panes.find((p) => p.paneId === tab.activePane) ?? tab.panes[0]
      const pane: Pane = { paneId: uid('pane'), profileId: src.sshProfileId ? undefined : src.profileId, title: src.sshProfileId ? 'Shell' : src.title }
      const next: Tab = { ...tab, direction: tab.panes.length === 1 ? direction : tab.direction, panes: [...tab.panes, pane], activePane: pane.paneId }
      return { tabs: s.tabs.map((t) => (t.id === tab.id ? next : t)) }
    }),
  closePane: (tabId, paneId) => {
    const tab = get().tabs.find((t) => t.id === tabId)
    if (!tab) return
    if (tab.panes.length <= 1) return get().closeTab(tabId)
    set((s) => ({
      tabs: s.tabs.map((t) => {
        if (t.id !== tabId) return t
        const panes = t.panes.filter((p) => p.paneId !== paneId)
        return { ...t, panes, activePane: t.activePane === paneId ? panes[panes.length - 1].paneId : t.activePane }
      })
    }))
  },
  setActive: (tabId, paneId) =>
    set((s) => ({ activeTab: tabId, tabs: paneId ? s.tabs.map((t) => (t.id === tabId ? { ...t, activePane: paneId } : t)) : s.tabs })),
  setPaneTitle: (paneId, title) =>
    set((s) => ({ tabs: s.tabs.map((t) => ({ ...t, panes: t.panes.map((p) => (p.paneId === paneId ? { ...p, title } : p)) })) })),
  consumeInitialInput: (paneId) => {
    let input: string | undefined
    set((s) => ({
      tabs: s.tabs.map((t) => ({
        ...t,
        panes: t.panes.map((p) => {
          if (p.paneId !== paneId) return p
          input = p.initialInput
          return { ...p, initialInput: undefined }
        })
      }))
    }))
    return input
  }
}))
