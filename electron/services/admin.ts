import { execFile } from 'node:child_process'
import { isWindows, powershellPath } from './paths'
import { encodePs } from './powershell'

let cached: Promise<boolean> | null = null

/** Detect whether NEXTERM itself is running elevated. Never elevates. */
export function isElevated(): Promise<boolean> {
  if (cached) return cached
  cached = new Promise((resolve) => {
    if (!isWindows) {
      resolve(typeof process.getuid === 'function' && process.getuid() === 0)
      return
    }
    const script =
      '([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)'
    execFile(
      powershellPath(),
      ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand', encodePs(script)],
      { timeout: 15000, windowsHide: true },
      (err, stdout) => resolve(!err && stdout.toString().trim().toLowerCase() === 'true')
    )
  })
  return cached
}
