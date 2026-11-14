import { randomUUID } from 'node:crypto'
import { homedir } from 'node:os'
import type { WebContents } from 'electron'
import * as pty from '@lydell/node-pty'
import { CH } from '@shared/api'
import type { TerminalCreateResult } from '@shared/types'
import { logActivity } from '../services/logger'
import { addHistory, getProfile } from '../services/ssh-store'
import { detectProfiles, sshExecutable } from './profiles'

interface Session {
  pty: pty.IPty
  ownerId: number
  title: string
}

const sessions = new Map<string, Session>()

function clampSize(n: number, min: number, max: number, fallback: number): number {
  return Number.isInteger(n) && n >= min && n <= max ? n : fallback
}

export async function createTerminal(
  sender: WebContents,
  opts: { profileId?: string; sshProfileId?: string; cols: number; rows: number }
): Promise<TerminalCreateResult> {
  const cols = clampSize(opts.cols, 2, 1000, 120)
  const rows = clampSize(opts.rows, 2, 500, 30)
  let file: string
  let args: string[]
  let title: string

  if (opts.sshProfileId) {
    const prof = await getProfile(opts.sshProfileId)
    if (!prof) return { ok: false, error: 'SSH profile not found.' }
    const ssh = sshExecutable()
    if (!ssh) return { ok: false, error: 'OpenSSH client not found. Install it from Settings > System > Optional features.' }
    file = ssh
    args = ['-p', String(prof.port)]
    if (prof.keyPath) args.push('-i', prof.keyPath)
    args.push('--', `${prof.user}@${prof.host}`)
    title = `SSH: ${prof.name}`
    void addHistory({ type: 'ssh', target: `${prof.user}@${prof.host}:${prof.port}` })
  } else {
    const profiles = await detectProfiles()
    const p = profiles.find((x) => x.id === opts.profileId) ?? profiles[0]
    if (!p) return { ok: false, error: 'No shell found on this system.' }
    file = p.file
    args = p.args
    title = p.name
  }

  let proc: pty.IPty
  try {
    proc = pty.spawn(file, args, {
      name: 'xterm-256color',
      cols,
      rows,
      cwd: homedir(),
      env: { ...process.env, TERM: 'xterm-256color', COLORTERM: 'truecolor', TERM_PROGRAM: 'NEXTERM' } as Record<string, string>
    })
  } catch (e) {
    return { ok: false, error: `Could not start ${title}: ${(e as Error).message}` }
  }

  const id = randomUUID()
  sessions.set(id, { pty: proc, ownerId: sender.id, title })
  logActivity('terminal', `${title} (${file} ${args.join(' ')})`, 'opened')

  proc.onData((data) => {
    if (!sender.isDestroyed()) sender.send(CH.termData, id, data)
  })
  proc.onExit(({ exitCode }) => {
    if (sessions.delete(id)) logActivity('terminal', title, `exited ${exitCode}`)
    if (!sender.isDestroyed()) sender.send(CH.termExit, id, exitCode)
  })
  return { ok: true, id, title }
}

function owned(id: string, sender: WebContents): Session | undefined {
  const s = sessions.get(id)
  return s && s.ownerId === sender.id ? s : undefined
}

export function writeTerminal(sender: WebContents, id: string, data: string): void {
  owned(id, sender)?.pty.write(data)
}

export function resizeTerminal(sender: WebContents, id: string, cols: number, rows: number): void {
  const s = owned(id, sender)
  if (!s) return
  try {
    s.pty.resize(clampSize(cols, 2, 1000, 80), clampSize(rows, 2, 500, 24))
  } catch {
    /* the process may have exited */
  }
}

export function killTerminal(sender: WebContents, id: string): void {
  const s = owned(id, sender)
  if (!s) return
  sessions.delete(id)
  try { s.pty.kill() } catch { /* already gone */ }
  logActivity('terminal', s.title, 'closed')
}

/** Kill every session; used when a window closes or the app quits. */
export function killAllTerminals(ownerId?: number): void {
  for (const [id, s] of sessions) {
    if (ownerId === undefined || s.ownerId === ownerId) {
      sessions.delete(id)
      try { s.pty.kill() } catch { /* ignore */ }
    }
  }
}
