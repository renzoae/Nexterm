import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { app, shell } from 'electron'
import { SETTINGS } from '@shared/settings-catalog'
import type { LaunchTool } from '@shared/types'
import { isValidHost } from '@shared/validation'
import { logActivity } from './logger'
import { isWindows, system32 } from './paths'

interface ToolDef extends LaunchTool {
  /** file: opened with ShellExecute. uri: ms-settings and similar. start: fixed command line run via `start` (ShellExecute, supports args and UAC). folder: a known user folder. */
  target: { file: string } | { uri: string } | { start: string } | { folder: 'downloads' }
}

// Fixed allow-list of Windows management consoles. The renderer can only send an id.
const TOOLS: ToolDef[] = [
  { id: 'devmgmt', name: 'Device Manager', description: 'Hardware devices and drivers', admin: false, target: { file: 'devmgmt.msc' } },
  { id: 'eventvwr', name: 'Event Viewer', description: 'System and application logs', admin: false, target: { file: 'eventvwr.msc' } },
  { id: 'services', name: 'Services', description: 'Start, stop and configure services', admin: false, target: { file: 'services.msc' } },
  { id: 'diskmgmt', name: 'Disk Management', description: 'Partitions and volumes', admin: true, target: { file: 'diskmgmt.msc' } },
  { id: 'compmgmt', name: 'Computer Management', description: 'Users, shares, storage and services', admin: true, target: { file: 'compmgmt.msc' } },
  { id: 'resmon', name: 'Resource Monitor', description: 'Live CPU, memory, disk and network usage', admin: false, target: { file: 'resmon.exe' } },
  { id: 'perfmon', name: 'Performance Monitor', description: 'Performance counters and reports', admin: false, target: { file: 'perfmon.exe' } },
  { id: 'ncpa', name: 'Network Connections', description: 'Network adapters (ncpa.cpl)', admin: false, target: { file: 'ncpa.cpl' } },
  { id: 'winupdate', name: 'Windows Update', description: 'Check for and install updates', admin: false, target: { uri: 'ms-settings:windowsupdate' } },
  { id: 'taskmgr', name: 'Task Manager', description: 'Processes, startup apps and performance', admin: false, target: { file: 'taskmgr.exe' } },
  { id: 'msinfo32', name: 'System Information', description: 'Detailed hardware and software report', admin: false, target: { file: 'msinfo32.exe' } },
  { id: 'appwiz', name: 'Programs and Features', description: 'Uninstall or change programs', admin: false, target: { file: 'appwiz.cpl' } },
  { id: 'firewall', name: 'Windows Firewall (Advanced)', description: 'Inbound and outbound rules', admin: true, target: { file: 'wf.msc' } },
  { id: 'sysprops', name: 'System Properties', description: 'Computer name, domain, remote settings', admin: false, target: { file: 'SystemPropertiesAdvanced.exe' } },
  { id: 'printers', name: 'Printers & Scanners', description: 'Manage printers', admin: false, target: { uri: 'ms-settings:printers' } },
  { id: 'taskmgr-startup', name: 'Task Manager: Startup', description: 'Startup programs and their impact', admin: false, target: { start: 'taskmgr.exe /0 /startup' } },
  { id: 'reliability', name: 'Reliability Monitor', description: 'Crashes and problems over time', admin: false, target: { start: 'perfmon.exe /rel' } },
  { id: 'cleanmgr', name: 'Disk Cleanup', description: 'Remove temporary and old update files', admin: false, target: { file: 'cleanmgr.exe' } },
  { id: 'downloads', name: 'Downloads folder', description: 'Your downloaded files', admin: false, target: { folder: 'downloads' } }
]

export function listTools(): LaunchTool[] {
  return TOOLS.map(({ id, name, description, admin }) => ({ id, name, description, admin }))
}

export async function launchTool(id: string): Promise<{ ok: boolean; error?: string }> {
  if (!isWindows) return { ok: false, error: 'Only available on Windows.' }
  const t = TOOLS.find((x) => x.id === id)
  if (!t) return { ok: false, error: 'Unknown tool' }
  if ('uri' in t.target) {
    await shell.openExternal(t.target.uri)
    logActivity('launch', t.name, 'opened')
    return { ok: true }
  }
  if ('folder' in t.target) {
    const err = await shell.openPath(app.getPath(t.target.folder))
    logActivity('launch', t.name, err ? `error: ${err}` : 'opened')
    return err ? { ok: false, error: err } : { ok: true }
  }
  if ('start' in t.target) {
    // Constant command line from the table above; never user input.
    const child = spawn(system32('cmd.exe'), [`/d /c start "" ${t.target.start}`], { windowsVerbatimArguments: true, detached: true, stdio: 'ignore', windowsHide: true })
    child.on('error', () => undefined)
    child.unref()
    logActivity('launch', t.name, 'opened')
    return { ok: true }
  }
  const path = system32(t.target.file)
  if (!existsSync(path)) return { ok: false, error: `${t.target.file} was not found.` }
  // ShellExecute (via openPath) handles consoles that require elevation by showing UAC.
  const err = await shell.openPath(path)
  logActivity('launch', t.name, err ? `error: ${err}` : 'opened')
  return err ? { ok: false, error: err } : { ok: true }
}

export function launchRdp(host: string, port?: number): { ok: boolean; error?: string } {
  if (!isWindows) return { ok: false, error: 'Remote Desktop client is only available on Windows.' }
  if (!isValidHost(host)) return { ok: false, error: 'Invalid host name or IP address.' }
  if (port !== undefined && !(Number.isInteger(port) && port >= 1 && port <= 65535)) return { ok: false, error: 'Invalid port.' }
  const target = port && port !== 3389 ? `${host.includes(':') ? `[${host}]` : host}:${port}` : host
  const child = spawn(system32('mstsc.exe'), [`/v:${target}`], { detached: true, stdio: 'ignore', windowsHide: false })
  child.on('error', () => undefined)
  child.unref()
  logActivity('remote', `mstsc /v:${target}`, 'launched')
  return { ok: true }
}

export async function openExternalSafe(url: string): Promise<boolean> {
  try {
    const u = new URL(url)
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return false
    await shell.openExternal(u.toString())
    return true
  } catch {
    return false
  }
}

/** Open a Windows Settings page from the catalog. Only catalog ids are accepted. */
export async function openSetting(id: string): Promise<{ ok: boolean; error?: string }> {
  if (!isWindows) return { ok: false, error: 'Only available on Windows.' }
  const entry = SETTINGS.find((x) => x.id === id)
  if (!entry) return { ok: false, error: 'Unknown setting' }
  try {
    await shell.openExternal(entry.uri)
    logActivity('launch', `Settings: ${entry.title}`, 'opened')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}
