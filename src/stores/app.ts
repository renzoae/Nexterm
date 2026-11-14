import { create } from 'zustand'
import type { AppInfo } from '@shared/types'
import type { PageId } from '@/data/nav'

interface AppState {
  page: PageId
  /** Changes on every navigation so re-selecting the current page resets it (e.g. back to the problem list). */
  navNonce: number
  info: AppInfo | null
  paletteOpen: boolean
  libraryQuery: string
  /** Problem id to open in Fix a Problem (from Health Center, settings search, palette). */
  pendingProblem: string | null
  openProblem: (id: string) => void
  takePendingProblem: () => string | null
  setPage: (p: PageId) => void
  setInfo: (i: AppInfo) => void
  setPalette: (open: boolean) => void
  setLibraryQuery: (q: string) => void
}

export const useApp = create<AppState>()((set, get) => ({
  page: 'fix',
  navNonce: 0,
  info: null,
  paletteOpen: false,
  libraryQuery: '',
  pendingProblem: null,
  openProblem: (id) => set((s) => ({ pendingProblem: id, page: 'fix', navNonce: s.navNonce + 1 })),
  takePendingProblem: (): string | null => {
    const p = get().pendingProblem
    if (p) set({ pendingProblem: null })
    return p
  },
  setPage: (page) => set((s) => ({ page, navNonce: s.navNonce + 1 })),
  setInfo: (info) => set({ info }),
  setPalette: (paletteOpen) => set({ paletteOpen }),
  setLibraryQuery: (libraryQuery) => set({ libraryQuery })
}))
