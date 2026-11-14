import { app, dialog, BrowserWindow, type WebContents } from 'electron'
import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, join } from 'node:path'
import type { ConnectionHistoryEntry, SshProfile } from '@shared/types'
import { isValidHost, isValidSshUser } from '@shared/validation'

// SSH profiles store connection details only. Passwords are never stored:
// ssh prompts for them interactively in the terminal, or key-based auth is used.

const profilesFile = () => join(app.getPath('userData'), 'ssh-profiles.json')
const historyFile = () => join(app.getPath('userData'), 'connection-history.json')

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try { return JSON.parse(await readFile(file, 'utf8')) as T } catch { return fallback }
}
async function writeJson(file: string, data: unknown): Promise<void> {
  await mkdir(dirname(file), { recursive: true })
  await writeFile(file, JSON.stringify(data, null, 2), 'utf8')
}

export function validateProfile(p: Partial<SshProfile>): string | null {
  if (!p.name || p.name.length > 80 || /[\r\n]/.test(p.name)) return 'Name is required (max 80 characters).'
  if (!p.host || !isValidHost(p.host)) return 'Enter a valid host name or IP address.'
  if (!p.user || !isValidSshUser(p.user)) return 'Enter a valid user name (letters, digits, . _ - \\).'
  if (!Number.isInteger(p.port) || (p.port as number) < 1 || (p.port as number) > 65535) return 'Port must be 1–65535.'
  if (p.keyPath) {
    if (!isAbsolute(p.keyPath) || /["\r\n]/.test(p.keyPath) || p.keyPath.length > 500) return 'Key path must be an absolute file path.'
    if (!existsSync(p.keyPath)) return 'Key file does not exist.'
  }
  return null
}

export async function listProfiles(): Promise<SshProfile[]> {
  const list = await readJson<SshProfile[]>(profilesFile(), [])
  // Drop anything malformed (e.g. a hand-edited file). A missing key file is
  // tolerated here and reported by ssh itself when connecting.
  return Array.isArray(list) ? list.filter((p) => typeof p?.id === 'string' && validateProfile({ ...p, keyPath: undefined }) === null) : []
}

export async function getProfile(id: string): Promise<SshProfile | undefined> {
  return (await listProfiles()).find((p) => p.id === id)
}

export async function saveProfile(input: Omit<SshProfile, 'id'> & { id?: string }): Promise<{ ok: boolean; error?: string; profile?: SshProfile }> {
  const err = validateProfile(input)
  if (err) return { ok: false, error: err }
  const list = await listProfiles()
  const profile: SshProfile = {
    id: input.id && list.some((p) => p.id === input.id) ? input.id : randomUUID(),
    name: input.name.trim(),
    host: input.host.trim(),
    port: input.port,
    user: input.user.trim(),
    keyPath: input.keyPath || undefined
  }
  const next = list.filter((p) => p.id !== profile.id).concat(profile)
  await writeJson(profilesFile(), next)
  return { ok: true, profile }
}

export async function removeProfile(id: string): Promise<boolean> {
  const list = await listProfiles()
  const next = list.filter((p) => p.id !== id)
  await writeJson(profilesFile(), next)
  return next.length !== list.length
}

export async function addHistory(entry: Omit<ConnectionHistoryEntry, 'ts'>): Promise<void> {
  const list = await readJson<ConnectionHistoryEntry[]>(historyFile(), [])
  list.unshift({ ...entry, ts: Date.now() })
  await writeJson(historyFile(), list.slice(0, 50))
}

export async function getHistory(): Promise<ConnectionHistoryEntry[]> {
  return readJson<ConnectionHistoryEntry[]>(historyFile(), [])
}

export async function pickKeyFile(sender: WebContents): Promise<string | null> {
  const win = BrowserWindow.fromWebContents(sender)
  const opts = {
    title: 'Select SSH private key',
    defaultPath: join(app.getPath('home'), '.ssh'),
    properties: ['openFile' as const, 'showHiddenFiles' as const]
  }
  const r = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts)
  return r.canceled || !r.filePaths[0] ? null : r.filePaths[0]
}
