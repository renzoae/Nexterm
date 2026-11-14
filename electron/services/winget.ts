import { execFile } from 'node:child_process'
import { homedir } from 'node:os'
import type { WebContents } from 'electron'
import type { WingetAction } from '@shared/api'
import type { RunStartResult, WingetPackage, WingetResult } from '@shared/types'
import { isValidWingetId, isValidWingetQuery } from '@shared/validation'
import { parseWingetTable } from '@shared/winget'
import { confirmAction } from './confirm'
import { startProcess } from './executor'
import { logActivity } from './logger'
import { findOnPath, isWindows } from './paths'

const COMMON = ['--accept-source-agreements', '--disable-interactivity']

function wingetPath(): string | null {
  return isWindows ? findOnPath('winget.exe') : null
}

function capture(args: string[], timeoutMs = 120000): Promise<WingetResult<WingetPackage[]>> {
  const file = wingetPath()
  if (!file) return Promise.resolve({ ok: false, error: 'winget was not found. Install "App Installer" from the Microsoft Store.' })
  return new Promise((resolve) => {
    execFile(file, args, { timeout: timeoutMs, windowsHide: true, cwd: homedir(), maxBuffer: 32 * 1024 * 1024 }, (err, stdout) => {
      const text = stdout?.toString() ?? ''
      const data = parseWingetTable(text)
      if (data.length || !err || /No (installed )?package found|No applicable/i.test(text)) return resolve({ ok: true, data })
      const msg = text.trim().split('\n').filter((l) => l.trim()).pop() || err.message
      resolve({ ok: false, error: msg })
    })
  })
}

export function wingetSearch(query: string): Promise<WingetResult<WingetPackage[]>> {
  if (!isValidWingetQuery(query)) return Promise.resolve({ ok: false, error: 'Use letters, digits, spaces and . - _ + only.' })
  return capture(['search', '--query', query, '--source', 'winget', '--count', '60', ...COMMON])
}

export function wingetInstalled(): Promise<WingetResult<WingetPackage[]>> {
  return capture(['list', ...COMMON])
}

export function wingetUpgrades(): Promise<WingetResult<WingetPackage[]>> {
  return capture(['upgrade', ...COMMON])
}

export async function wingetAction(sender: WebContents, action: WingetAction, id: string): Promise<RunStartResult> {
  const file = wingetPath()
  if (!file) return { ok: false, reason: 'unsupported', message: 'winget was not found on this computer.' }
  if (!isValidWingetId(id)) return { ok: false, reason: 'invalid', message: 'Invalid package id.' }
  const args =
    action === 'install'
      ? ['install', '--id', id, '--exact', '--source', 'winget', '--accept-package-agreements', ...COMMON]
      : action === 'upgrade'
        ? ['upgrade', '--id', id, '--exact', '--accept-package-agreements', ...COMMON]
        : ['uninstall', '--id', id, '--exact', ...COMMON]
  const display = `winget ${args.join(' ')}`
  const verb = action === 'install' ? 'Install' : action === 'upgrade' ? 'Update' : 'Uninstall'
  const ok = await confirmAction(sender, {
    title: `${verb} software`,
    message: `${verb} ${id}?`,
    command: display,
    risk: action === 'uninstall' ? 'high' : 'caution',
    note:
      action === 'uninstall'
        ? 'The application will be removed from this computer.'
        : 'By continuing you accept the package license agreement. The installer may show its own UAC prompt.',
    confirmLabel: verb
  })
  if (!ok) {
    logActivity('winget', display, 'declined by user')
    return { ok: false, reason: 'cancelled', message: 'Cancelled.' }
  }
  return startProcess(sender, file, args, { display, logType: 'winget', timeoutSec: 3600 })
}
