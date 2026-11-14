import { create } from 'zustand'
import type { ParamValues, RunStartResult } from '@shared/types'
import type { WingetAction } from '@shared/api'

export type RunStatus = 'idle' | 'running' | 'success' | 'failed' | 'cancelled' | 'blocked'

export interface RunState {
  runId?: string
  status: RunStatus
  output: string
  display?: string
  exitCode?: number | null
  durationMs?: number
  message?: string
  needsAdmin?: boolean
  startedAt?: number
}

const MAX_OUTPUT = 2 * 1024 * 1024

interface RunsStore {
  byKey: Record<string, RunState>
  runToKey: Record<string, string>
  run: (key: string, commandId: string, params: ParamValues) => Promise<void>
  runElevated: (key: string, commandId: string, params: ParamValues) => Promise<void>
  winget: (key: string, action: WingetAction, id: string) => Promise<void>
  cancel: (key: string) => Promise<void>
  clear: (key: string) => void
  _start: (key: string, res: RunStartResult) => void
  _output: (runId: string, chunk: string) => void
  _exit: (runId: string, code: number | null, durationMs: number, error?: string, cancelled?: boolean) => void
}

export const useRuns = create<RunsStore>()((set, get) => ({
  byKey: {},
  runToKey: {},
  _start: (key, res) => {
    if (res.ok) {
      set((s) => ({
        byKey: { ...s.byKey, [key]: { runId: res.runId, status: 'running', output: '', display: res.display, startedAt: Date.now() } },
        runToKey: { ...s.runToKey, [res.runId]: key }
      }))
    } else {
      set((s) => ({
        byKey: {
          ...s.byKey,
          [key]: {
            status: res.reason === 'cancelled' ? 'cancelled' : 'blocked',
            output: s.byKey[key]?.output ?? '',
            message: res.message,
            needsAdmin: res.reason === 'needs-admin'
          }
        }
      }))
    }
  },
  run: async (key, commandId, params) => {
    set((s) => ({ byKey: { ...s.byKey, [key]: { status: 'running', output: '', message: 'Waiting for confirmation…' } } }))
    get()._start(key, await window.nexterm.commands.run(commandId, params))
  },
  runElevated: async (key, commandId, params) => {
    const res = await window.nexterm.commands.runElevated(commandId, params)
    get()._start(key, res)
    if (res.ok) {
      set((s) => ({ byKey: { ...s.byKey, [key]: { ...s.byKey[key], message: 'Elevated window requested. Output appears in the new PowerShell window.' } } }))
    }
  },
  winget: async (key, action, id) => {
    set((s) => ({ byKey: { ...s.byKey, [key]: { status: 'running', output: '', message: 'Waiting for confirmation…' } } }))
    get()._start(key, await window.nexterm.winget.action(action, id))
  },
  cancel: async (key) => {
    const r = get().byKey[key]
    if (r?.runId) await window.nexterm.commands.cancel(r.runId)
  },
  clear: (key) => set((s) => ({ byKey: { ...s.byKey, [key]: { status: 'idle', output: '' } } })),
  _output: (runId, chunk) => {
    const key = get().runToKey[runId]
    if (!key) return
    set((s) => {
      const cur = s.byKey[key]
      if (!cur || cur.runId !== runId) return s
      let output = cur.output + chunk
      if (output.length > MAX_OUTPUT) output = '[output truncated]\n' + output.slice(-MAX_OUTPUT)
      return { byKey: { ...s.byKey, [key]: { ...cur, output } } }
    })
  },
  _exit: (runId, code, durationMs, error, cancelled) => {
    const key = get().runToKey[runId]
    if (!key) return
    set((s) => {
      const cur = s.byKey[key]
      if (!cur || cur.runId !== runId) return s
      const status: RunStatus = cancelled ? 'cancelled' : error || code !== 0 ? 'failed' : 'success'
      const elevatedFailed = status === 'failed' && cur.message?.startsWith('Elevated')
      const message = error ? error : cancelled ? 'Cancelled' : elevatedFailed ? 'The elevated window did not open (the UAC prompt was declined or failed).' : cur.message
      return { byKey: { ...s.byKey, [key]: { ...cur, status, exitCode: code, durationMs, message } } }
    })
  }
}))

let wired = false
/** Subscribe once to process output events coming from the main process. */
export function wireRunEvents(): void {
  if (wired) return
  wired = true
  window.nexterm.commands.onOutput((e) => useRuns.getState()._output(e.runId, e.chunk))
  window.nexterm.commands.onExit((e) => useRuns.getState()._exit(e.runId, e.code, e.durationMs, e.error, e.cancelled))
}
