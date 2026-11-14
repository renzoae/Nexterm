// Types shared between the Electron main process and the React renderer.

export type Risk = 'safe' | 'caution' | 'high'
export type ShellName = 'powershell' | 'cmd'

export type CategoryId =
  | 'networking'
  | 'windows'
  | 'hardware'
  | 'users'
  | 'active-directory'
  | 'powershell'
  | 'security'
  | 'remote'
  | 'software'
  | 'development'
  | 'git'
  | 'docker'

export type ParamSpec =
  | { name: string; label: string; type: 'host'; default?: string; placeholder?: string }
  | { name: string; label: string; type: 'int'; min: number; max: number; default: number }
  | { name: string; label: string; type: 'drive'; default: string }
  | { name: string; label: string; type: 'choice'; choices: string[]; default: string }

/**
 * How a command is executed. The renderer never sends executables or raw
 * command lines; it only sends a command id plus parameter values. The main
 * process resolves the definition below and builds the argv itself.
 *
 * - exe: a native executable run directly (no shell). `system` executables are
 *   resolved from %SystemRoot%\System32 to avoid PATH hijacking.
 * - ps: a PowerShell script block run via -EncodedCommand.
 * - cmd: a fixed command line run through cmd.exe (only for .cmd shims such as
 *   npm). Parameters are not allowed for this kind.
 */
export type ExecSpec =
  | { kind: 'exe'; file: string; args: string[]; system?: boolean; subdir?: string; env?: Record<string, string> }
  | { kind: 'ps'; script: string }
  | { kind: 'cmd'; line: string }

export type Requirement = 'domain' | 'rsat' | 'git' | 'docker' | 'node' | 'python' | 'wsl' | 'winget'

export interface CommandDef {
  id: string
  name: string
  description: string
  /** Plain-language explanation for Easy Mode. */
  explain: string
  category: CategoryId
  shells: ShellName[]
  exec: ExecSpec
  admin: boolean
  risk: Risk
  params?: ParamSpec[]
  requires?: Requirement
  longRunning?: boolean
  timeoutSec?: number
}

export type ParamValues = Record<string, string | number>

export interface AppInfo {
  version: string
  platform: string
  isWindows: boolean
  isAdmin: boolean
  electron: string
  userDataPath: string
}

export type RunStartResult =
  | { ok: true; runId: string; display: string }
  | { ok: false; reason: 'cancelled' | 'needs-admin' | 'invalid' | 'unsupported' | 'error'; message: string }

export interface RunOutputEvent {
  runId: string
  stream: 'stdout' | 'stderr'
  chunk: string
}

export interface RunExitEvent {
  runId: string
  code: number | null
  durationMs: number
  error?: string
  cancelled?: boolean
}

export interface TerminalProfile {
  id: string
  name: string
  kind: 'powershell' | 'pwsh' | 'cmd' | 'wsl' | 'gitbash' | 'posix'
}

export interface TerminalCreateResult {
  ok: boolean
  id?: string
  title?: string
  error?: string
}

export interface SshProfile {
  id: string
  name: string
  host: string
  port: number
  user: string
  keyPath?: string
}

export interface ConnectionHistoryEntry {
  ts: number
  type: 'ssh' | 'rdp'
  target: string
}

export interface SystemOverview {
  hostname: string
  os: { distro: string; release: string; build: string; arch: string }
  cpu: { brand: string; manufacturer: string; physicalCores: number; cores: number; speedGHz: number }
  memTotal: number
  gpus: { model: string; vendor: string; vramMB: number | null; driver: string }[]
  disks: { fs: string; mount: string; type: string; size: number; used: number }[]
  physicalDisks: { name: string; type: string; size: number; vendor: string; smart: string }[]
  uptimeSec: number
  bootTime: number
  user: string
}

export interface LiveMetrics {
  cpuLoad: number
  cpuPerCore: number[]
  memUsed: number
  memTotal: number
  memAvailable: number
  swapUsed: number
  swapTotal: number
  uptimeSec: number
  ts: number
}

export interface ProcessInfo {
  pid: number
  name: string
  cpu: number
  memRss: number
  user: string
}

export interface NetAdapterInfo {
  iface: string
  name: string
  ip4: string
  ip4subnet: string
  ip6: string
  mac: string
  type: string
  operstate: string
  speedMbps: number | null
  dhcp: boolean
  virtual: boolean
  isDefault: boolean
}

export interface NetworkOverview {
  adapters: NetAdapterInfo[]
  defaultGateway: string
  dns: { iface: string; servers: string[] }[]
  internet: { reachable: boolean; latencyMs: number | null; target: string }
  dnsResolution: { ok: boolean; ms: number | null; host: string }
}

export interface DomainStatus {
  supported: boolean
  partOfDomain: boolean
  domain: string
  workgroup: string
  rsatInstalled: boolean
  error?: string
}

export interface DevTool {
  id: string
  name: string
  found: boolean
  version: string
  hint: string
}

export interface WingetPackage {
  name: string
  id: string
  version: string
  available?: string
  source?: string
}

export type WingetResult<T> = { ok: true; data: T } | { ok: false; error: string }

export interface LogEntry {
  ts: number
  type: 'command' | 'elevated' | 'terminal' | 'winget' | 'launch' | 'remote'
  detail: string
  status: string
}

export interface LaunchTool {
  id: string
  name: string
  description: string
  admin: boolean
}
