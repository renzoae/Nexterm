import { arr, gb, mb, overallStatus, type ActionRef, type Finding, type Interpretation } from '../troubleshoot'
import { dedupe } from './network'

export interface UpdateRaw {
  services?: { name: string; display?: string; status: string; startType: string }[] | object
  history?: { title: string; date: string; result: number; hresult: string }[] | object
  historyError?: string | null
  events?: { time: string; id: number; message: string }[] | object
  rebootPending?: boolean
  freeBytes?: number
  sizeBytes?: number
  downloadCacheBytes?: number
  lastHotfix?: { id: string; date: string } | null
  backupExists?: boolean
}

/** Common Windows Update error codes, explained in plain language. */
export const WU_ERRORS: Record<string, string> = {
  '0x80070002': 'Update files are missing or incomplete. Resetting the update cache usually fixes this.',
  '0x80070003': 'An update file path was not found. Resetting the update cache usually fixes this.',
  '0x80070005': 'Access denied. Security software or permissions blocked the update.',
  '0x8007000D': 'Update data is corrupt. Reset the update cache, then run DISM.',
  '0x80070020': 'Another program (often antivirus) had the files open.',
  '0x80070070': 'Not enough disk space.',
  '0x80070643': 'An installer failed (common with .NET and Defender updates). Retry after a restart.',
  '0x800705B4': 'The operation timed out. Check the connection and retry.',
  '0x80073712': 'Windows component store is damaged. Run DISM Restore Health.',
  '0x800F081F': 'Windows component files are missing. Run DISM Restore Health.',
  '0x800F0922': 'Not enough space in the system reserved partition, or a VPN blocked the download.',
  '0x800F0831': 'A previous update needed by this one is missing. Run DISM, then retry.',
  '0x8024402C': 'Could not reach update servers (proxy or connection problem).',
  '0x8024401C': 'Connection to update servers timed out.',
  '0x80244022': 'Update server temporarily unavailable. Try again later.',
  '0x80240034': 'Download failed. Reset the update cache.',
  '0x8024A105': 'Update agent error. Restart the update services, then retry.',
  '0x80242016': 'Update did not finish after the last restart. Restart again.',
  '0x8024200D': 'Update needs to download again. Reset the update cache.',
  '0x80246017': 'Download needs permission. Restart update services.',
  '0xC1900101': 'A driver blocked the feature update. Update drivers (especially graphics/storage) or remove external devices.',
  '0xC1900208': 'An incompatible app blocked the upgrade.'
}

const RESULT: Record<number, string> = { 1: 'in progress', 2: 'succeeded', 3: 'succeeded with errors', 4: 'failed', 5: 'aborted' }

export function interpretUpdate(raw: UpdateRaw, nowMs = Date.now()): Interpretation {
  const findings: Finding[] = []
  const actions: ActionRef[] = []
  const advice: string[] = []
  const causes: string[] = []
  const services = arr(raw.services as { name: string; display?: string; status: string; startType: string }[])
  const history = arr(raw.history as { title: string; date: string; result: number; hresult: string }[])
  const events = arr(raw.events as { time: string; id: number; message: string }[])

  // Services
  const core = services.filter((s) => ['wuauserv', 'bits', 'cryptsvc'].includes(s.name.toLowerCase()))
  const disabled = core.filter((s) => /disabled/i.test(s.startType))
  if (!services.length) {
    findings.push({ id: 'services', status: 'unknown', title: 'Could not read update services', detail: 'Windows did not return service status.' })
  } else if (disabled.length) {
    findings.push({ id: 'services', status: 'fail', title: 'Update services are disabled', detail: `${disabled.map((s) => s.display || s.name).join(', ')} cannot start, so Windows Update cannot work.`, evidence: core.map((s) => `${s.name}: ${s.status}, ${s.startType}`).join('\n') })
    causes.push('disabled update services')
    actions.push({ kind: 'repair', id: 'repair.wu-enable', reason: 'Turn the update services back on.' })
  } else {
    findings.push({ id: 'services', status: 'ok', title: 'Update services are enabled', detail: 'They start automatically when needed (“Stopped” is normal while idle).', evidence: services.map((s) => `${s.name}: ${s.status}, ${s.startType}`).join('\n') })
  }

  // History
  const monthAgo = nowMs - 30 * 86400_000
  if (raw.historyError) {
    findings.push({ id: 'history', status: 'unknown', title: 'Update history unavailable', detail: 'Windows Update did not return its history.', evidence: raw.historyError })
  } else {
    const recent = history.filter((h) => Date.parse(h.date) >= monthAgo)
    const failed = recent.filter((h) => h.result === 4 || h.result === 5)
    const succeeded = history.filter((h) => h.result === 2 || h.result === 3).sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
    if (failed.length) {
      const codes = [...new Set(failed.map((f) => `0x${f.hresult.replace(/^0x/i, '').toUpperCase()}`))]
      const known = codes.filter((c) => WU_ERRORS[c])
      findings.push({
        id: 'history', status: 'fail', title: `${failed.length} update(s) failed in the last 30 days`,
        detail: known.length ? known.map((c) => `${c}: ${WU_ERRORS[c]}`).join(' ') : `Error code(s): ${codes.join(', ')}.`,
        evidence: failed.slice(0, 10).map((f) => `${f.date.slice(0, 10)}  ${RESULT[f.result] ?? f.result}  ${f.hresult}  ${f.title}`).join('\n')
      })
      causes.push('failed update installs')
      if (codes.some((c) => ['0x80073712', '0x800F081F', '0x8007000D', '0x800F0831'].includes(c))) {
        actions.push({ kind: 'repair', id: 'win.dism-restore', reason: 'Repairs the Windows component store that updates depend on.' })
        actions.push({ kind: 'repair', id: 'win.sfc', reason: 'Repairs protected system files (run after DISM).' })
      }
      actions.push({ kind: 'repair', id: 'repair.wu-restart', reason: 'Restarting the update services clears many temporary errors.' })
      actions.push({ kind: 'repair', id: 'repair.wu-reset-cache', reason: 'Fresh download folder; fixes corrupt or stuck downloads.' })
    } else if (recent.length) {
      findings.push({ id: 'history', status: 'ok', title: 'Recent updates installed successfully', detail: `${recent.length} update(s) in the last 30 days, none failed.` })
    } else {
      findings.push({ id: 'history', status: 'info', title: 'No updates in the last 30 days', detail: 'Nothing was installed recently.' })
    }
    const last = succeeded[0]
    if (last) {
      const days = Math.floor((nowMs - Date.parse(last.date)) / 86400_000)
      if (days > 45) {
        findings.push({ id: 'last-success', status: 'warn', title: `Last successful update was ${days} days ago`, detail: 'Windows normally installs updates every month.', evidence: `${last.date.slice(0, 10)} ${last.title}` })
        causes.push('updates not installing for a long time')
      } else {
        findings.push({ id: 'last-success', status: 'ok', title: `Last successful update ${days} day(s) ago`, detail: last.title })
      }
    } else if (raw.lastHotfix) {
      findings.push({ id: 'last-success', status: 'info', title: `Newest installed hotfix: ${raw.lastHotfix.id}`, detail: `Installed ${raw.lastHotfix.date.slice(0, 10)}.` })
    }
  }

  // Event log errors
  if (events.length) {
    findings.push({ id: 'events', status: 'warn', title: `${events.length} Windows Update error event(s) in 30 days`, detail: 'Recorded by the update client in the System log.', evidence: events.slice(0, 8).map((e) => `${e.time.slice(0, 16).replace('T', ' ')}  [${e.id}] ${e.message}`).join('\n') })
  }

  // Disk space
  if (raw.freeBytes !== undefined && raw.sizeBytes) {
    if (raw.freeBytes < 10 * 1024 ** 3) {
      findings.push({ id: 'space', status: 'fail', title: `Only ${gb(raw.freeBytes)} free on the system drive`, detail: 'Updates need roughly 10 GB of free space (feature updates need more).' })
      causes.push('not enough free disk space')
      actions.push({ kind: 'repair', id: 'repair.clear-temp', reason: 'Free some space safely.' })
      actions.push({ kind: 'settings', id: 'storage', reason: 'Free up more space.' })
    } else {
      findings.push({ id: 'space', status: 'ok', title: `${gb(raw.freeBytes)} free on the system drive`, detail: 'Enough space for updates.' })
    }
  }
  if (raw.downloadCacheBytes && raw.downloadCacheBytes > 0) {
    findings.push({ id: 'cache', status: 'info', title: `Update download cache: ${mb(raw.downloadCacheBytes)}`, detail: 'Files Windows Update has downloaded.' })
  }

  // Pending reboot
  if (raw.rebootPending) {
    findings.push({ id: 'reboot', status: 'warn', title: 'A restart is pending', detail: 'Updates are waiting for a restart to finish installing. New updates may fail until you restart.' })
    causes.push('a pending restart')
    advice.push('Save your work and restart the PC, then check for updates again.')
  }

  if (raw.backupExists) actions.push({ kind: 'repair', id: 'repair.wu-restore-cache', reason: 'A previous cache reset left a backup that can be restored.' })
  actions.push({ kind: 'settings', id: 'windows-update', reason: 'Check for updates and see detailed status.' })
  actions.push({ kind: 'settings', id: 'troubleshoot', reason: 'Run Microsoft’s Windows Update troubleshooter.' })

  const status = overallStatus(findings)
  const headline =
    status === 'ok' ? 'Windows Update looks healthy.'
      : status === 'unknown' ? 'Windows Update checks could not complete.'
        : causes.length ? `Found: ${causes.join(', ')}.` : 'Some update checks need attention.'
  const cause =
    status === 'ok'
      ? 'Services are enabled, recent updates succeeded and there is enough space. If an update still fails, note its error code and run this check again.'
      : causes.length ? `The most likely reason updates fail here is ${causes[0]}.` : 'See the findings below.'
  return { status, headline, cause, findings, actions: dedupe(actions), advice }
}
