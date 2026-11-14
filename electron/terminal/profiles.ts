import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { TerminalProfile } from '@shared/types'
import { decodeOutput } from '@shared/text'
import { isValidDistroName } from '@shared/validation'
import { findOnPath, isWindows, system32 } from '../services/paths'

export interface ResolvedProfile extends TerminalProfile {
  file: string
  args: string[]
}

function listWslDistros(): Promise<string[]> {
  const wsl = system32('wsl.exe')
  if (!existsSync(wsl)) return Promise.resolve([])
  return new Promise((resolve) => {
    execFile(wsl, ['--list', '--quiet'], { timeout: 8000, windowsHide: true, encoding: 'buffer', env: { ...process.env, WSL_UTF8: '1' } }, (err, stdout) => {
      if (err) return resolve([])
      const names = decodeOutput(stdout as Buffer)
        .split(/\r?\n/)
        .map((s) => s.replace(/\0/g, '').trim())
        .filter((s) => s && isValidDistroName(s))
      resolve([...new Set(names)])
    })
  })
}

let cache: Promise<ResolvedProfile[]> | null = null

/** Detect the shells installed on this machine. The renderer can only pick from this list. */
export function detectProfiles(): Promise<ResolvedProfile[]> {
  if (cache) return cache
  cache = (async () => {
    const out: ResolvedProfile[] = []
    if (!isWindows) {
      const sh = process.env.SHELL && existsSync(process.env.SHELL) ? process.env.SHELL : existsSync('/bin/bash') ? '/bin/bash' : '/bin/sh'
      out.push({ id: 'posix', name: sh.split('/').pop() || 'shell', kind: 'posix', file: sh, args: ['-l'] })
      const pwsh = findOnPath('pwsh')
      if (pwsh) out.push({ id: 'pwsh', name: 'PowerShell 7', kind: 'pwsh', file: pwsh, args: ['-NoLogo'] })
      return out
    }
    const ps = system32('WindowsPowerShell', 'v1.0', 'powershell.exe')
    if (existsSync(ps)) out.push({ id: 'powershell', name: 'Windows PowerShell', kind: 'powershell', file: ps, args: ['-NoLogo'] })

    const pwshCandidates = [
      findOnPath('pwsh.exe'),
      join(process.env.ProgramFiles || 'C:\\Program Files', 'PowerShell', '7', 'pwsh.exe')
    ].filter((p): p is string => !!p && existsSync(p))
    if (pwshCandidates[0]) out.push({ id: 'pwsh', name: 'PowerShell 7', kind: 'pwsh', file: pwshCandidates[0], args: ['-NoLogo'] })

    const cmd = system32('cmd.exe')
    if (existsSync(cmd)) out.push({ id: 'cmd', name: 'Command Prompt', kind: 'cmd', file: cmd, args: [] })

    const distros = await listWslDistros()
    if (distros.length) {
      out.push({ id: 'wsl', name: 'WSL (default)', kind: 'wsl', file: system32('wsl.exe'), args: [] })
      for (const d of distros) out.push({ id: `wsl:${d}`, name: `WSL: ${d}`, kind: 'wsl', file: system32('wsl.exe'), args: ['-d', d] })
    }

    const gitBash = join(process.env.ProgramFiles || 'C:\\Program Files', 'Git', 'bin', 'bash.exe')
    if (existsSync(gitBash)) out.push({ id: 'gitbash', name: 'Git Bash', kind: 'gitbash', file: gitBash, args: ['--login', '-i'] })
    return out
  })()
  return cache
}

export function sshExecutable(): string | null {
  if (isWindows) {
    const builtin = system32('OpenSSH', 'ssh.exe')
    if (existsSync(builtin)) return builtin
    return findOnPath('ssh.exe')
  }
  return findOnPath('ssh')
}
