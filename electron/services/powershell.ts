import { execFile } from 'node:child_process'
import { homedir } from 'node:os'
import { powershellPath } from './paths'

const PRELUDE = "$ProgressPreference='SilentlyContinue';[Console]::OutputEncoding=[System.Text.Encoding]::UTF8;"

export function encodePs(script: string): string {
  return Buffer.from(script, 'utf16le').toString('base64')
}

/** argv for running a script block with formatted text output (streamed line by line). */
export function psTextArgs(script: string): string[] {
  const full = `${PRELUDE}& { ${script} } | Out-String -Stream -Width 250`
  return ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand', encodePs(full)]
}

/** Run a script whose last output is JSON and parse it. Internal use only (fixed scripts). */
export function runPsJson<T>(script: string, timeoutMs = 30000): Promise<T> {
  const full = `${PRELUDE}${script}`
  return new Promise((resolve, reject) => {
    execFile(
      powershellPath(),
      ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand', encodePs(full)],
      { timeout: timeoutMs, windowsHide: true, cwd: homedir(), maxBuffer: 16 * 1024 * 1024 },
      (err, stdout, stderr) => {
        if (err && !stdout) return reject(new Error(stderr?.toString().trim() || err.message))
        try {
          resolve(parsePsJson<T>(stdout.toString()))
        } catch {
          const hint = (stderr?.toString().trim() || stdout.toString().trim()).split('\n').slice(-3).join(' ')
          reject(new Error(`Could not parse PowerShell output${hint ? `: ${hint.slice(0, 300)}` : ''}`))
        }
      }
    )
  })
}

/** Parse the JSON document in PowerShell output, ignoring any warning lines printed before it. */
export function parsePsJson<T>(out: string): T {
  const text = out.replace(/^\uFEFF/, '').trim()
  try {
    return JSON.parse(text) as T
  } catch {
    const lines = text.split(/\r?\n/)
    const start = lines.findIndex((l) => /^[[{]/.test(l.trim()))
    if (start < 0) throw new Error('No JSON in output')
    return JSON.parse(lines.slice(start).join('\n')) as T
  }
}
