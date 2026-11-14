import { existsSync } from 'node:fs'
import { delimiter, isAbsolute, join } from 'node:path'

export const isWindows = process.platform === 'win32'

export function systemRoot(): string {
  return process.env.SystemRoot || process.env.windir || 'C:\\Windows'
}

export function system32(...parts: string[]): string {
  return join(systemRoot(), 'System32', ...parts)
}

/**
 * Find an executable on PATH. Only absolute PATH entries are searched, so a
 * malicious file in the current directory can never be picked up.
 */
export function findOnPath(file: string): string | null {
  const names = isWindows ? [file] : [file.replace(/\.(exe|cmd)$/i, ''), file]
  const dirs = (process.env.PATH || process.env.Path || '').split(delimiter).filter((d) => d && isAbsolute(d))
  for (const dir of dirs) {
    for (const n of names) {
      const p = join(dir, n)
      if (existsSync(p)) return p
    }
  }
  return null
}

export function resolveSystemOrPath(file: string, system?: boolean, subdir?: string): string | null {
  if (system) {
    if (!isWindows) return null
    const p = subdir ? system32(subdir, file) : system32(file)
    return existsSync(p) ? p : null
  }
  return findOnPath(file)
}

export function powershellPath(): string {
  return isWindows ? system32('WindowsPowerShell', 'v1.0', 'powershell.exe') : 'pwsh'
}
