import type { Diagnosis, DiagnosisId, TroubleshootHistoryEntry } from './troubleshoot'
import type {
  AppInfo, ConnectionHistoryEntry, DevTool, DomainStatus, LaunchTool, LiveMetrics, LogEntry, NetworkOverview,
  ParamValues, ProcessInfo, RunExitEvent, RunOutputEvent, RunStartResult, SshProfile, SystemOverview,
  TerminalCreateResult, TerminalProfile, WingetPackage, WingetResult
} from './types'

export const CH = {
  appInfo: 'app:info',
  appSetTheme: 'app:set-theme',
  cmdRun: 'cmd:run',
  cmdCancel: 'cmd:cancel',
  cmdRunElevated: 'cmd:run-elevated',
  cmdOutput: 'cmd:output',
  cmdExit: 'cmd:exit',
  sysOverview: 'sys:overview',
  sysLive: 'sys:live',
  sysProcesses: 'sys:processes',
  netOverview: 'net:overview',
  termProfiles: 'term:profiles',
  termCreate: 'term:create',
  termWrite: 'term:write',
  termResize: 'term:resize',
  termKill: 'term:kill',
  termData: 'term:data',
  termExit: 'term:exit',
  launchTools: 'launch:tools',
  launchTool: 'launch:tool',
  launchRdp: 'launch:rdp',
  openExternal: 'launch:open-external',
  sshList: 'ssh:list',
  sshSave: 'ssh:save',
  sshRemove: 'ssh:remove',
  sshHistory: 'ssh:history',
  sshPickKey: 'ssh:pick-key',
  wingetSearch: 'winget:search',
  wingetInstalled: 'winget:installed',
  wingetUpgrades: 'winget:upgrades',
  wingetAction: 'winget:action',
  devDetect: 'dev:detect',
  domainStatus: 'env:domain',
  logsRead: 'logs:read',
  logsOpenFolder: 'logs:open-folder',
  clipRead: 'clip:read',
  clipWrite: 'clip:write',
  diagRun: 'diag:run',
  diagHistory: 'diag:history',
  healthSummary: 'health:summary',
  settingsOpen: 'settings:open',
  reportGenerate: 'report:generate',
  reportSave: 'report:save'
} as const

export interface HealthSummaryResult {
  errors24h: number
  topErrorSources: { source: string; count: number }[]
  rebootPending: boolean
  lastUpdate: { title: string; date: string } | null
  failedUpdates30d: number
  historyError: string | null
  startupCount: number
  wuDisabled: number
}

export type WingetAction = 'install' | 'upgrade' | 'uninstall'

export interface NexTermApi {
  app: {
    info(): Promise<AppInfo>
    setTheme(theme: 'dark' | 'light'): Promise<void>
  }
  commands: {
    run(commandId: string, params: ParamValues): Promise<RunStartResult>
    cancel(runId: string): Promise<boolean>
    runElevated(commandId: string, params: ParamValues): Promise<RunStartResult>
    onOutput(cb: (e: RunOutputEvent) => void): () => void
    onExit(cb: (e: RunExitEvent) => void): () => void
  }
  system: {
    overview(): Promise<SystemOverview>
    live(): Promise<LiveMetrics>
    processes(): Promise<ProcessInfo[]>
    network(): Promise<NetworkOverview>
    domain(): Promise<DomainStatus>
    devTools(): Promise<DevTool[]>
  }
  terminal: {
    profiles(): Promise<TerminalProfile[]>
    create(opts: { profileId?: string; sshProfileId?: string; cols: number; rows: number }): Promise<TerminalCreateResult>
    write(id: string, data: string): void
    resize(id: string, cols: number, rows: number): void
    kill(id: string): void
    onData(cb: (id: string, data: string) => void): () => void
    onExit(cb: (id: string, code: number) => void): () => void
  }
  launch: {
    tools(): Promise<LaunchTool[]>
    tool(id: string): Promise<{ ok: boolean; error?: string }>
    rdp(host: string, port?: number): Promise<{ ok: boolean; error?: string }>
    openExternal(url: string): Promise<boolean>
  }
  ssh: {
    list(): Promise<SshProfile[]>
    save(p: Omit<SshProfile, 'id'> & { id?: string }): Promise<{ ok: boolean; error?: string; profile?: SshProfile }>
    remove(id: string): Promise<boolean>
    history(): Promise<ConnectionHistoryEntry[]>
    pickKey(): Promise<string | null>
  }
  winget: {
    search(query: string): Promise<WingetResult<WingetPackage[]>>
    installed(): Promise<WingetResult<WingetPackage[]>>
    upgrades(): Promise<WingetResult<WingetPackage[]>>
    action(action: WingetAction, id: string): Promise<RunStartResult>
  }
  logs: {
    read(): Promise<LogEntry[]>
    openFolder(): Promise<void>
  }
  clipboard: {
    read(): Promise<string>
    write(text: string): Promise<void>
  }
  troubleshoot: {
    run(id: DiagnosisId, afterActions?: string[]): Promise<Diagnosis>
    history(): Promise<TroubleshootHistoryEntry[]>
    health(): Promise<HealthSummaryResult | { error: string }>
    openSetting(id: string): Promise<{ ok: boolean; error?: string }>
    report(includeIdentity: boolean): Promise<string>
    saveReport(text: string): Promise<{ ok: boolean; path?: string }>
  }
}
