import { create } from 'zustand'
import type { AppInfo } from '@shared/types'
import type { PageId } from '@/data/nav'

interface AppState {
  page: PageId
  info: AppInfo | null
  paletteOpen: boolean
  libraryQuery: string
  setPage: (p: PageId) => void
  setInfo: (i: AppInfo) => void
  setPalette: (open: boolean) => void
  setLibraryQuery: (q: string) => void
}

export const useApp = create<AppState>()((set) => ({
  page: 'dashboard',
  info: null,
  paletteOpen: false,
  libraryQuery: '',
  setPage: (page) => set({ page }),
  setInfo: (info) => set({ info }),
  setPalette: (paletteOpen) => set({ paletteOpen }),
  setLibraryQuery: (libraryQuery) => set({ libraryQuery })
}))
