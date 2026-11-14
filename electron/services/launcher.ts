import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { shell } from 'electron'
import type { LaunchTool } from '@shared/types'
import { isValidHost } from '@shared/validation'
import { logActivity } from './logger'
import { isWindows, system32 } from './paths'

interface ToolDef extends LaunchTool {
  target: { file: string } | { uri: string }
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
  { id: 'printers', name: 'Printers & Scanners', description: 'Manage printers', admin: false, target: { uri: 'ms-settings:printers' } }
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
