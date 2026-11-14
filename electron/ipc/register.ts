import { app, clipboard, ipcMain, nativeTheme, shell, BrowserWindow, type IpcMainEvent, type IpcMainInvokeEvent } from 'electron'
import { z } from 'zod'
import { CH } from '@shared/api'
import type { AppInfo } from '@shared/types'
import { isElevated } from '../services/admin'
import { detectDevTools } from '../services/devtools'
import { getDomainStatus } from '../services/domain'
import { cancelRun, runCommand, runElevated } from '../services/executor'
import { launchRdp, launchTool, listTools, openExternalSafe, openSetting } from '../services/launcher'
import { diagnose, generateReport, getHistory as getTroubleHistory, healthSummary, saveReport } from '../services/troubleshoot'
import { logActivity, logDir, readLog } from '../services/logger'
import { getNetworkOverview } from '../services/network'
import { getHistory, listProfiles, pickKeyFile, removeProfile, saveProfile } from '../services/ssh-store'
import { getLive, getOverview, getProcesses } from '../services/system-info'
import { wingetAction, wingetInstalled, wingetSearch, wingetUpgrades } from '../services/winget'
import { createTerminal, killTerminal, resizeTerminal, writeTerminal } from '../terminal/pty-manager'
import { detectProfiles } from '../terminal/profiles'
import { addHistory } from '../services/ssh-store'
import { isWindows } from '../services/paths'

/** Only accept IPC from our own renderer (packaged file:// page or the dev server). */
function trustedSender(e: IpcMainEvent | IpcMainInvokeEvent): boolean {
  const url = e.senderFrame?.url ?? ''
  const dev = process.env.ELECTRON_RENDERER_URL
  return url.startsWith('file://') || (!!dev && url.startsWith(dev))
}

const id = z.string().min(1).max(100)
const paramValues = z.record(z.string().max(40), z.union([z.string().max(300), z.number()])).default({})

function handle<S extends z.ZodTypeAny>(channel: string, schema: S, fn: (e: IpcMainInvokeEvent, args: z.infer<S>) => unknown): void {
  ipcMain.handle(channel, async (e, ...raw) => {
    if (!trustedSender(e)) throw new Error('Untrusted sender')
    const parsed = schema.safeParse(raw)
    if (!parsed.success) throw new Error(`Invalid arguments for ${channel}`)
    return fn(e, parsed.data)
  })
}

function on<S extends z.ZodTypeAny>(channel: string, schema: S, fn: (e: IpcMainEvent, args: z.infer<S>) => void): void {
  ipcMain.on(channel, (e, ...raw) => {
    if (!trustedSender(e)) return
    const parsed = schema.safeParse(raw)
    if (parsed.success) fn(e, parsed.data)
  })
}

export function registerIpc(): void {
  handle(CH.appInfo, z.tuple([]), async (): Promise<AppInfo> => ({
    version: app.getVersion(),
    platform: process.platform,
    isWindows,
    isAdmin: await isElevated(),
    electron: process.versions.electron,
    userDataPath: app.getPath('userData')
  }))
  handle(CH.appSetTheme, z.tuple([z.enum(['dark', 'light'])]), (e, [theme]) => {
    nativeTheme.themeSource = theme
    const win = BrowserWindow.fromWebContents(e.sender)
    if (win && isWindows) {
      try {
        win.setTitleBarOverlay(theme === 'dark' ? { color: '#0b1220', symbolColor: '#cbd5e1' } : { color: '#f1f5f9', symbolColor: '#0f172a' })
      } catch { /* overlay not enabled */ }
    }
  })

  // Commands: only ids from the built-in registry plus validated parameters.
  handle(CH.cmdRun, z.tuple([id, paramValues]), (e, [cmdId, params]) => runCommand(e.sender, cmdId, params))
  handle(CH.cmdRunElevated, z.tuple([id, paramValues]), (e, [cmdId, params]) => runElevated(e.sender, cmdId, params))
  handle(CH.cmdCancel, z.tuple([id]), (e, [runId]) => cancelRun(runId, e.sender))

  handle(CH.sysOverview, z.tuple([]), () => getOverview())
  handle(CH.sysLive, z.tuple([]), () => getLive())
  handle(CH.sysProcesses, z.tuple([]), () => getProcesses())
  handle(CH.netOverview, z.tuple([]), () => getNetworkOverview())
  handle(CH.domainStatus, z.tuple([]), () => getDomainStatus(true))
  handle(CH.devDetect, z.tuple([]), () => detectDevTools())

  // Terminal: the renderer chooses a detected profile id, never an executable path.
  handle(CH.termProfiles, z.tuple([]), async () => (await detectProfiles()).map(({ id, name, kind }) => ({ id, name, kind })))
  handle(
    CH.termCreate,
    z.tuple([z.object({ profileId: id.optional(), sshProfileId: id.optional(), cols: z.number().int(), rows: z.number().int() })]),
    (e, [opts]) => createTerminal(e.sender, opts)
  )
  on(CH.termWrite, z.tuple([id, z.string().max(1024 * 1024)]), (e, [tid, data]) => writeTerminal(e.sender, tid, data))
  on(CH.termResize, z.tuple([id, z.number().int(), z.number().int()]), (e, [tid, c, r]) => resizeTerminal(e.sender, tid, c, r))
  on(CH.termKill, z.tuple([id]), (e, [tid]) => killTerminal(e.sender, tid))

  handle(CH.launchTools, z.tuple([]), () => listTools())
  handle(CH.launchTool, z.tuple([id]), (_e, [toolId]) => launchTool(toolId))
  handle(CH.launchRdp, z.tuple([z.string().max(253), z.number().int().optional()]), async (_e, [host, port]) => {
    const r = launchRdp(host, port)
    if (r.ok) await addHistory({ type: 'rdp', target: port ? `${host}:${port}` : host })
    return r
  })
  handle(CH.openExternal, z.tuple([z.string().max(2048)]), (_e, [url]) => openExternalSafe(url))

  handle(CH.sshList, z.tuple([]), () => listProfiles())
  handle(
    CH.sshSave,
    z.tuple([z.object({
      id: id.optional(), name: z.string().max(80), host: z.string().max(253), port: z.number().int(), user: z.string().max(64), keyPath: z.string().max(500).optional()
    })]),
    (_e, [p]) => saveProfile(p)
  )
  handle(CH.sshRemove, z.tuple([id]), (_e, [pid]) => removeProfile(pid))
  handle(CH.sshHistory, z.tuple([]), () => getHistory())
  handle(CH.sshPickKey, z.tuple([]), (e) => pickKeyFile(e.sender))

  handle(CH.wingetSearch, z.tuple([z.string().max(64)]), (_e, [q]) => wingetSearch(q))
  handle(CH.wingetInstalled, z.tuple([]), () => wingetInstalled())
  handle(CH.wingetUpgrades, z.tuple([]), () => wingetUpgrades())
  handle(CH.wingetAction, z.tuple([z.enum(['install', 'upgrade', 'uninstall']), z.string().max(128)]), (e, [action, pkg]) =>
    wingetAction(e.sender, action, pkg)
  )

  handle(CH.logsRead, z.tuple([]), () => readLog())
  handle(CH.logsOpenFolder, z.tuple([]), async () => {
    await shell.openPath(logDir())
  })

  handle(CH.clipRead, z.tuple([]), () => clipboard.readText())
  handle(CH.clipWrite, z.tuple([z.string().max(10 * 1024 * 1024)]), (_e, [text]) => clipboard.writeText(text))

  // Guided troubleshooting: read-only diagnostics. Repairs go through cmd:run (registry + confirmation).
  const diagId = z.enum(['network', 'slow', 'update', 'sound', 'disk', 'hang', 'startup', 'printer', 'services'])
  handle(CH.diagRun, z.tuple([diagId, z.array(id).max(20)]), (_e, [d, after]) => diagnose(d, after))
  handle(CH.diagHistory, z.tuple([]), () => getTroubleHistory())
  handle(CH.healthSummary, z.tuple([]), () => healthSummary())
  handle(CH.settingsOpen, z.tuple([id]), (_e, [sid]) => openSetting(sid))
  handle(CH.reportGenerate, z.tuple([z.boolean()]), (_e, [identity]) => generateReport(identity, app.getVersion()))
  handle(CH.reportSave, z.tuple([z.string().max(5 * 1024 * 1024)]), (e, [text]) => saveReport(e.sender, text))

  logActivity('command', 'NEXTERM started', 'ok')
}
