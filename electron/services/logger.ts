import { app } from 'electron'
import { appendFile, mkdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { LogEntry } from '@shared/types'

// Append-only execution log (JSON Lines). Records what was run, never
// keystrokes, passwords or command output.
export function logDir(): string {
  return join(app.getPath('userData'), 'logs')
}

function logFile(): string {
  return join(logDir(), 'activity.jsonl')
}

let queue: Promise<void> = Promise.resolve()

export function logActivity(type: LogEntry['type'], detail: string, status: string): void {
  const entry: LogEntry = { ts: Date.now(), type, detail: detail.slice(0, 2000), status }
  queue = queue
    .then(async () => {
      await mkdir(logDir(), { recursive: true })
      await appendFile(logFile(), JSON.stringify(entry) + '\n', 'utf8')
    })
    .catch(() => undefined)
}

export async function readLog(limit = 300): Promise<LogEntry[]> {
  try {
    const text = await readFile(logFile(), 'utf8')
    const lines = text.trim().split('\n').slice(-limit)
    return lines
      .map((l) => {
        try { return JSON.parse(l) as LogEntry } catch { return null }
      })
      .filter((x): x is LogEntry => !!x)
      .reverse()
  } catch {
    return []
  }
}
