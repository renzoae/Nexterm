import { spawn, execFile, type ChildProcess } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { homedir } from 'node:os'
import type { WebContents } from 'electron'
import { CH } from '@shared/api'
import { getCommand } from '@shared/commands'
import { decodeOutput } from '@shared/text'
import type { CommandDef, ParamValues, RunStartResult, LogEntry } from '@shared/types'
import { displayCommand, psQuote, substituteArgs, substituteScript, validateParams } from '@shared/validation'
import { isElevated } from './admin'
import { confirmAction } from './confirm'
import { getDomainStatus } from './domain'
import { logActivity } from './logger'
import { isWindows, powershellPath, resolveSystemOrPath, system32 } from './paths'
import { encodePs, psTextArgs } from './powershell'

interface Run {
  child: ChildProcess
  sender: WebContents
  started: number
  display: string
  logType: LogEntry['type']
  cancelled: boolean
  timer?: NodeJS.Timeout
}

const runs = new Map<string, Run>()

function killTree(child: ChildProcess): void {
  if (!child.pid) return
  if (isWindows) {
    execFile(system32('taskkill.exe'), ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true }, () => undefined)
  } else {
    child.kill('SIGTERM')
  }
}

/** Start a process and stream its output to the renderer that requested it. */
export function startProcess(
  sender: WebContents,
  file: string,
  args: string[],
  meta: { display: string; logType: LogEntry['type']; timeoutSec?: number; env?: Record<string, string> }
): RunStartResult {
  const runId = randomUUID()
  let child: ChildProcess
  try {
    child = spawn(file, args, {
      cwd: homedir(),
      env: { ...process.env, ...meta.env },
      windowsHide: true,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe']
    })
  } catch (e) {
    return { ok: false, reason: 'error', message: (e as Error).message }
  }
  const run: Run = { child, sender, started: Date.now(), display: meta.display, logType: meta.logType, cancelled: false }
  runs.set(runId, run)

  const send = (channel: string, payload: unknown) => {
    if (!sender.isDestroyed()) sender.send(channel, payload)
  }
  child.stdout?.on('data', (b: Buffer) => send(CH.cmdOutput, { runId, stream: 'stdout', chunk: decodeOutput(b) }))
  child.stderr?.on('data', (b: Buffer) => send(CH.cmdOutput, { runId, stream: 'stderr', chunk: decodeOutput(b) }))

  if (meta.timeoutSec) {
    run.timer = setTimeout(() => {
      send(CH.cmdOutput, { runId, stream: 'stderr', chunk: `\n[NEXTERM] Timed out after ${meta.timeoutSec}s; process stopped.\n` })
      killTree(child)
    }, meta.timeoutSec * 1000)
  }

  let finished = false
  const finish = (code: number | null, error?: string) => {
    if (finished) return
    finished = true
    if (run.timer) clearTimeout(run.timer)
    runs.delete(runId)
    const durationMs = Date.now() - run.started
    send(CH.cmdExit, { runId, code, durationMs, error, cancelled: run.cancelled })
    logActivity(meta.logType, meta.display, run.cancelled ? 'cancelled' : error ? `error: ${error}` : `exit ${code}`)
  }
  child.on('error', (e) => finish(null, e.message))
  child.on('close', (code) => finish(code))

  return { ok: true, runId, display: meta.display }
}

export function cancelRun(runId: string, sender: WebContents): boolean {
  const run = runs.get(runId)
  if (!run || run.sender.id !== sender.id) return false
  run.cancelled = true
  killTree(run.child)
  return true
}

export function cancelAllFor(senderId: number): void {
  for (const [id, run] of runs) {
    if (run.sender.id === senderId) {
      run.cancelled = true
      killTree(run.child)
      runs.delete(id)
    }
  }
}

type Prepared =
  | { ok: true; def: CommandDef; values: ParamValues; display: string; file: string; args: string[]; env?: Record<string, string> }
  | { ok: false; result: RunStartResult }

const REQ_NAMES: Record<string, string> = {
  git: 'Git', docker: 'Docker', node: 'Node.js', python: 'Python', wsl: 'WSL', winget: 'winget (App Installer)'
}

async function prepare(commandId: string, rawParams: unknown): Promise<Prepared> {
  const def = getCommand(commandId)
  if (!def) return { ok: false, result: { ok: false, reason: 'invalid', message: 'Unknown command' } }
  if (!isWindows) {
    return { ok: false, result: { ok: false, reason: 'unsupported', message: 'This diagnostic is only available on Windows.' } }
  }
  const v = validateParams(def, rawParams)
  if (!v.ok) return { ok: false, result: { ok: false, reason: 'invalid', message: v.error } }

  if (def.requires === 'domain' || def.requires === 'rsat') {
    const d = await getDomainStatus()
    if (!d.partOfDomain) return { ok: false, result: { ok: false, reason: 'unsupported', message: 'This computer is not joined to a domain.' } }
    if (def.requires === 'rsat' && !d.rsatInstalled) {
      return { ok: false, result: { ok: false, reason: 'unsupported', message: 'The ActiveDirectory PowerShell module (RSAT) is not installed.' } }
    }
  }

  const display = displayCommand(def, v.values)
  const ex = def.exec
  if (ex.kind === 'exe') {
    const file = resolveSystemOrPath(ex.file, ex.system, ex.subdir)
    if (!file) {
      const what = def.requires ? REQ_NAMES[def.requires] ?? ex.file : ex.file
      return { ok: false, result: { ok: false, reason: 'unsupported', message: `${what} was not found on this computer.` } }
    }
    return { ok: true, def, values: v.values, display, file, args: substituteArgs(ex.args, v.values), env: ex.env }
  }
  if (ex.kind === 'cmd') {
    return { ok: true, def, values: v.values, display, file: system32('cmd.exe'), args: ['/d', '/s', '/c', ex.line] }
  }
  return { ok: true, def, values: v.values, display, file: powershellPath(), args: psTextArgs(substituteScript(ex.script, v.values)) }
}

export async function runCommand(sender: WebContents, commandId: string, rawParams: unknown): Promise<RunStartResult> {
  const p = await prepare(commandId, rawParams)
  if (!p.ok) return p.result
  const { def } = p
  if (def.admin && !(await isElevated())) {
    return { ok: false, reason: 'needs-admin', message: 'This tool requires administrator privileges.' }
  }
  if (def.risk !== 'safe') {
    const ok = await confirmAction(sender, {
      title: 'Confirm action', message: `Run "${def.name}"?`, command: p.display, risk: def.risk, admin: def.admin, note: def.description
    })
    if (!ok) {
      logActivity('command', p.display, 'declined by user')
      return { ok: false, reason: 'cancelled', message: 'Cancelled.' }
    }
  }
  return startProcess(sender, p.file, p.args, { display: p.display, logType: 'command', timeoutSec: def.timeoutSec ?? 60, env: p.env })
}

/**
 * Open a new, visible, elevated PowerShell window running the command. Windows
 * shows a UAC prompt; NEXTERM never elevates silently.
 */
export async function runElevated(sender: WebContents, commandId: string, rawParams: unknown): Promise<RunStartResult> {
  const p = await prepare(commandId, rawParams)
  if (!p.ok) return p.result
  const ok = await confirmAction(sender, {
    title: 'Run as administrator',
    message: `Run "${p.def.name}" as administrator?`,
    command: p.display,
    risk: p.def.risk,
    admin: true,
    note: 'A new PowerShell window will open after you approve the Windows UAC prompt. Output appears in that window.',
    confirmLabel: 'Continue to UAC'
  })
  if (!ok) {
    logActivity('elevated', p.display, 'declined by user')
    return { ok: false, reason: 'cancelled', message: 'Cancelled.' }
  }
  const ex = p.def.exec
  const inner =
    ex.kind === 'ps'
      ? substituteScript(ex.script, p.values)
      : `& ${psQuote(p.file)} ${p.args.map(psQuote).join(' ')}`
  const banner = `Write-Host 'NEXTERM elevated session' -ForegroundColor Cyan; Write-Host ${psQuote('> ' + p.display)} -ForegroundColor DarkGray;`
  const encoded = encodePs(`${banner} ${inner}`)
  const outer = `Start-Process -FilePath ${psQuote(powershellPath())} -Verb RunAs -ArgumentList '-NoExit','-NoProfile','-EncodedCommand','${encoded}'`
  return startProcess(sender, powershellPath(), ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand', encodePs(outer)], {
    display: `[elevated] ${p.display}`,
    logType: 'elevated',
    timeoutSec: 120
  })
}
