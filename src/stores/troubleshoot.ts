import { create } from 'zustand'
import type { Diagnosis, DiagnosisId } from '@shared/troubleshoot'

export interface WorkflowState {
  running: boolean
  verifying: boolean
  current?: Diagnosis
  /** The diagnosis before the last verification run, for before/after comparison. */
  before?: Diagnosis
  /** Repairs the user ran since the last check. */
  actionsRun: string[]
  error?: string
}

interface TroubleshootStore {
  byId: Partial<Record<DiagnosisId, WorkflowState>>
  run: (id: DiagnosisId, verify?: boolean) => Promise<void>
  noteAction: (id: DiagnosisId, label: string) => void
  reset: (id: DiagnosisId) => void
}

const empty: WorkflowState = { running: false, verifying: false, actionsRun: [] }

export const useTroubleshoot = create<TroubleshootStore>()((set, get) => ({
  byId: {},
  run: async (id, verify = false) => {
    const prev = get().byId[id] ?? empty
    if (prev.running) return
    set((s) => ({ byId: { ...s.byId, [id]: { ...prev, running: true, verifying: verify, error: undefined } } }))
    try {
      const d = await window.nexterm.troubleshoot.run(id, verify ? prev.actionsRun : [])
      set((s) => ({
        byId: {
          ...s.byId,
          [id]: { running: false, verifying: false, current: d, before: verify ? prev.current : undefined, actionsRun: verify ? [] : prev.actionsRun }
        }
      }))
    } catch (e) {
      set((s) => ({ byId: { ...s.byId, [id]: { ...prev, running: false, verifying: false, error: (e as Error).message } } }))
    }
  },
  noteAction: (id, label) =>
    set((s) => {
      const cur = s.byId[id] ?? empty
      return { byId: { ...s.byId, [id]: { ...cur, actionsRun: [...cur.actionsRun.filter((x) => x !== label), label] } } }
    }),
  reset: (id) => set((s) => ({ byId: { ...s.byId, [id]: { ...empty } } }))
}))
