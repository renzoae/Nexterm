// Guided troubleshooting: shared types and the list of user problems.

export type DiagnosisId = 'network' | 'slow' | 'update' | 'sound' | 'disk' | 'hang' | 'startup' | 'printer' | 'services'

export type FindingStatus = 'ok' | 'info' | 'warn' | 'fail' | 'unknown'

export interface Finding {
  id: string
  status: FindingStatus
  title: string
  /** Plain-language explanation of what was found. */
  detail: string
  /** Raw evidence (values, command output) for technicians. */
  evidence?: string
}

/** A recommended next step. Repairs run through the main process with confirmation. */
export type ActionRef =
  | { kind: 'repair'; id: string; params?: Record<string, string | number>; label?: string; reason: string }
  | { kind: 'settings'; id: string; label?: string; reason: string }
  | { kind: 'tool'; id: string; label?: string; reason: string }
  | { kind: 'url'; url: string; label: string; reason: string }

export type OverallStatus = 'ok' | 'problem' | 'unknown'

export interface Interpretation {
  status: OverallStatus
  /** One-line result in plain language. */
  headline: string
  /** Most likely cause, in plain language. */
  cause: string
  findings: Finding[]
  actions: ActionRef[]
  /** Manual steps NEXTERM cannot do for the user (e.g. restart the router). */
  advice: string[]
}

export interface Diagnosis extends Interpretation {
  id: string
  diagnosisId: DiagnosisId
  ranAt: number
  durationMs: number
  /** Problems running the checks themselves (not findings about the PC). */
  errors: string[]
  elevated: boolean
}

export interface TroubleshootHistoryEntry {
  ts: number
  diagnosisId: DiagnosisId
  status: OverallStatus
  headline: string
  problems: number
  /** Repairs the user ran before this check, if it was a verification run. */
  afterActions: string[]
}

export interface ProblemDef {
  id: string
  title: string
  description: string
  diagnosis: DiagnosisId
  icon: 'wifi' | 'globe' | 'gauge' | 'refresh' | 'volume' | 'hard-drive' | 'app' | 'power' | 'printer' | 'cog'
}

export const PROBLEMS: ProblemDef[] = [
  { id: 'internet', title: 'Internet not working', description: 'No connection, pages will not load, or Wi-Fi says “No internet”.', diagnosis: 'network', icon: 'wifi' },
  { id: 'dns', title: 'DNS or network settings', description: 'Some sites fail, names will not resolve, or the network settings look wrong.', diagnosis: 'network', icon: 'globe' },
  { id: 'slow', title: 'Computer running slowly', description: 'Everything feels sluggish, fans are loud, or apps take long to open.', diagnosis: 'slow', icon: 'gauge' },
  { id: 'update', title: 'Windows Update failing', description: 'Updates fail, get stuck, or keep asking to install again.', diagnosis: 'update', icon: 'refresh' },
  { id: 'sound', title: 'No sound', description: 'Speakers or headphones are silent.', diagnosis: 'sound', icon: 'volume' },
  { id: 'disk', title: 'Low disk space', description: 'The drive is full or Windows warns about storage.', diagnosis: 'disk', icon: 'hard-drive' },
  { id: 'hang', title: 'App not responding', description: 'A program freezes, crashes, or shows “Not responding”.', diagnosis: 'hang', icon: 'app' },
  { id: 'startup', title: 'Startup takes too long', description: 'The PC takes a long time to become usable after signing in.', diagnosis: 'startup', icon: 'power' },
  { id: 'printer', title: 'Printer not working', description: 'Nothing prints, jobs are stuck, or the printer is offline.', diagnosis: 'printer', icon: 'printer' },
  { id: 'services', title: 'Windows service failing', description: 'A feature stopped working or an error mentions a service.', diagnosis: 'services', icon: 'cog' }
]

export function overallStatus(findings: Finding[]): OverallStatus {
  if (findings.some((f) => f.status === 'fail' || f.status === 'warn')) return 'problem'
  if (findings.length === 0 || findings.every((f) => f.status === 'unknown')) return 'unknown'
  return 'ok'
}

/** Normalise PowerShell JSON, where a one-item array may arrive as a bare object. */
export function arr<T>(v: T | T[] | null | undefined): T[] {
  if (v === null || v === undefined) return []
  return Array.isArray(v) ? v : [v]
}

export function gb(bytes: number): string {
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`
}

export function mb(bytes: number): string {
  return bytes >= 1024 ** 3 ? gb(bytes) : `${Math.round(bytes / 1024 ** 2)} MB`
}
