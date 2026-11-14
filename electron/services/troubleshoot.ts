import { app, dialog, BrowserWindow, type WebContents } from 'electron'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { buildReport } from '@shared/report'
import { PROBLEMS, type Diagnosis, type DiagnosisId, type TroubleshootHistoryEntry } from '@shared/troubleshoot'
import { isElevated } from './admin'
import { healthSummary, runDiagnosis } from './diagnostics/runner'
import { logActivity } from './logger'
import { getNetworkOverview } from './network'
import { getOverview } from './system-info'
import { userInfo } from 'node:os'

const historyFile = () => join(app.getPath('userData'), 'troubleshoot-history.json')

async function readHistory(): Promise<TroubleshootHistoryEntry[]> {
  try {
    const v = JSON.parse(await readFile(historyFile(), 'utf8'))
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}

export async function getHistory(): Promise<TroubleshootHistoryEntry[]> {
  return readHistory()
}

let queue: Promise<void> = Promise.resolve()

function record(d: Diagnosis, afterActions: string[]): void {
  queue = queue.then(async () => {
    const list = await readHistory()
    list.unshift({
      ts: d.ranAt, diagnosisId: d.diagnosisId, status: d.status, headline: d.headline,
      problems: d.findings.filter((f) => f.status === 'fail' || f.status === 'warn').length, afterActions
    })
    await mkdir(dirname(historyFile()), { recursive: true })
    await writeFile(historyFile(), JSON.stringify(list.slice(0, 100), null, 2), 'utf8')
  }).catch(() => undefined)
}

// Keep the latest diagnosis per type so reports can include them.
const latest = new Map<DiagnosisId, Diagnosis>()

export async function diagnose(id: DiagnosisId, afterActions: string[]): Promise<Diagnosis> {
  const d = await runDiagnosis(id)
  latest.set(id, d)
  record(d, afterActions)
  logActivity('command', `Diagnosis: ${id}${afterActions.length ? ` (verify after ${afterActions.join(', ')})` : ''}`, `${d.status}: ${d.headline}`)
  return d
}

export { healthSummary }

export async function generateReport(includeIdentity: boolean, version: string): Promise<string> {
  const errors: string[] = []
  const [overview, network, health, history, elevated] = await Promise.all([
    getOverview().catch((e) => { errors.push(`System info: ${(e as Error).message}`); return null }),
    getNetworkOverview().catch((e) => { errors.push(`Network: ${(e as Error).message}`); return null }),
    healthSummary(),
    readHistory(),
    isElevated()
  ])
  if (health && 'error' in health) errors.push(`Health: ${health.error}`)
  const titleOf = (id: DiagnosisId) => PROBLEMS.find((p) => p.diagnosis === id)?.title ?? id
  const text = buildReport({
    generatedAt: Date.now(), appVersion: version, elevated, includeIdentity, user: userInfo().username,
    overview, network, health: health && !('error' in health) ? health : null, history,
    diagnoses: [...latest.values()].sort((a, b) => b.ranAt - a.ranAt).map((d) => ({ title: titleOf(d.diagnosisId), diagnosis: d })),
    errors
  })
  logActivity('command', `Support report (identity ${includeIdentity ? 'included' : 'hidden'})`, 'generated')
  return text
}

export async function saveReport(sender: WebContents, text: string): Promise<{ ok: boolean; path?: string }> {
  const win = BrowserWindow.fromWebContents(sender)
  const opts = {
    title: 'Save support report',
    defaultPath: join(app.getPath('documents'), `NEXTERM-report-${new Date().toISOString().slice(0, 10)}.md`),
    filters: [{ name: 'Markdown', extensions: ['md'] }, { name: 'Text', extensions: ['txt'] }]
  }
  const r = win ? await dialog.showSaveDialog(win, opts) : await dialog.showSaveDialog(opts)
  if (r.canceled || !r.filePath) return { ok: false }
  await writeFile(r.filePath, text, 'utf8')
  logActivity('command', `Support report saved to ${r.filePath}`, 'ok')
  return { ok: true, path: r.filePath }
}
