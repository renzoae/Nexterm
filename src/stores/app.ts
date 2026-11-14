import { create } from 'zustand'
import type { AppInfo } from '@shared/types'
import type { PageId } from '@/data/nav'

interface AppState {
  page: PageId
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
  info: null,
  paletteOpen: false,
  libraryQuery: '',
  pendingProblem: null,
  openProblem: (id) => set({ pendingProblem: id, page: 'fix' }),
  takePendingProblem: (): string | null => {
    const p = get().pendingProblem
    if (p) set({ pendingProblem: null })
    return p
  },
  setPage: (page) => set({ page }),
  setInfo: (info) => set({ info }),
  setPalette: (paletteOpen) => set({ paletteOpen }),
  setLibraryQuery: (libraryQuery) => set({ libraryQuery })
}))
