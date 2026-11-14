import { arr, gb, mb, overallStatus, type ActionRef, type Finding, type Interpretation } from '../troubleshoot'
import { dedupe } from './network'
import { canEnd } from './slow'

function finish(findings: Finding[], actions: ActionRef[], advice: string[], text: { ok: [string, string]; problem: [string, string]; unknown?: [string, string] }): Interpretation {
  const status = overallStatus(findings)
  const [headline, cause] = status === 'ok' ? text.ok : status === 'problem' ? text.problem : text.unknown ?? ['Checks could not complete.', 'Windows did not return enough information.']
  return { status, headline, cause, findings, actions: dedupe(actions), advice }
}

type Svc = { name: string; display?: string; status: string; startType?: string }

// ───────────── Sound ─────────────
export interface SoundRaw {
  services?: Svc[] | Svc
  devices?: { name: string; status: string }[] | object
  endpoints?: { name: string; status: string }[] | object
  volume?: { ok: boolean; muted?: boolean; level?: number; error?: string } | null
}

export function interpretSound(raw: SoundRaw): Interpretation {
  const findings: Finding[] = []
  const actions: ActionRef[] = []
  const advice: string[] = []
  let headline = ''
  let cause = ''
  const services = arr(raw.services)
  const devices = arr(raw.devices as { name: string; status: string }[])
  const endpoints = arr(raw.endpoints as { name: string; status: string }[])

  const stopped = services.filter((s) => !/running/i.test(s.status))
  if (!services.length) findings.push({ id: 'services', status: 'unknown', title: 'Audio service status unknown', detail: 'Could not read the audio services.' })
  else if (stopped.length) {
    findings.push({ id: 'services', status: 'fail', title: 'Windows Audio service is not running', detail: 'Without it, no sound can play.', evidence: services.map((s) => `${s.name}: ${s.status}`).join('\n') })
    headline = 'The Windows Audio service is stopped.'
    cause = 'The service that plays all sound is not running.'
    actions.push({ kind: 'repair', id: 'repair.audio-restart', reason: 'Start the audio services again.' })
  } else findings.push({ id: 'services', status: 'ok', title: 'Audio services running', detail: services.map((s) => s.display || s.name).join(', ') })

  if (!devices.length) {
    findings.push({ id: 'devices', status: 'fail', title: 'No sound hardware found', detail: 'Windows does not see any sound card or audio device.' })
    if (!headline) { headline = 'Windows cannot find any sound hardware.'; cause = 'The audio driver is missing or the device is disabled.' }
    actions.push({ kind: 'tool', id: 'devmgmt', reason: 'Check “Sound, video and game controllers” for disabled or missing drivers.' })
  } else {
    const bad = devices.filter((d) => !/^ok$/i.test(d.status))
    findings.push({ id: 'devices', status: bad.length ? 'warn' : 'ok', title: bad.length ? 'A sound device reports a problem' : 'Sound hardware detected', detail: devices.map((d) => `${d.name} (${d.status})`).join(', ') })
    if (bad.length) actions.push({ kind: 'tool', id: 'devmgmt', reason: 'Update or reinstall the audio driver.' })
  }

  const working = endpoints.filter((e) => /^ok$/i.test(e.status))
  if (endpoints.length) {
    findings.push({ id: 'endpoints', status: working.length ? 'ok' : 'fail', title: working.length ? `${working.length} working audio output/input(s)` : 'No working speakers or headphones', detail: endpoints.map((e) => `${e.name}: ${e.status}`).join('; ') })
    if (!working.length && !headline) { headline = 'No speakers or headphones are available.'; cause = 'Outputs are unplugged or disabled.' }
  }

  const v = raw.volume
  if (v?.ok) {
    const pct = Math.round((v.level ?? 0) * 100)
    if (v.muted) {
      findings.push({ id: 'volume', status: 'fail', title: 'Sound is muted', detail: 'The default output device is muted.', evidence: `Volume ${pct}%, muted` })
      if (!headline) { headline = 'Your sound is muted.'; cause = 'The default speakers or headphones are muted.' }
      actions.unshift({ kind: 'repair', id: 'repair.audio-unmute', reason: 'Unmute and make sure the volume is audible.' })
    } else if (pct < 5) {
      findings.push({ id: 'volume', status: 'fail', title: `Volume is almost zero (${pct}%)`, detail: 'The volume is too low to hear.' })
      if (!headline) { headline = 'The volume is turned all the way down.'; cause = 'Master volume is near zero.' }
      actions.unshift({ kind: 'repair', id: 'repair.audio-unmute', reason: 'Raise the volume to 50%.' })
    } else findings.push({ id: 'volume', status: 'ok', title: `Volume ${pct}%, not muted`, detail: 'The default output is on.' })
  } else if (v && !v.ok) {
    const noDevice = /0x80070490|not found|element not found/i.test(v.error ?? '')
    findings.push({ id: 'volume', status: noDevice ? 'fail' : 'unknown', title: noDevice ? 'No default playback device' : 'Could not read volume', detail: noDevice ? 'Windows has no default speakers or headphones selected.' : 'Volume could not be read.', evidence: v.error })
    if (noDevice && !headline) { headline = 'There is no default playback device.'; cause = 'No speakers or headphones are selected as the output.' }
  }

  actions.push({ kind: 'settings', id: 'sound', reason: 'Choose the right output device and test it.' })
  actions.push({ kind: 'settings', id: 'volume-mixer', reason: 'Check that the app itself is not muted.' })
  advice.push('If you use headphones or an external speaker, check the cable/Bluetooth connection and the device’s own volume.')
  const r = finish(findings, actions, advice, {
    ok: ['Sound is set up correctly.', 'Services run, hardware works, and the volume is on. If one app is silent, check its own volume in the volume mixer.'],
    problem: [headline || 'Something is stopping sound.', cause || 'See the findings below.']
  })
  return r
}

// ───────────── Disk space ─────────────
export interface DiskRaw {
  volumes?: { id: string; label?: string; size: number; free: number }[] | object
  tempBytes?: number
  recycleBytes?: number
  downloadsBytes?: number
  updateCacheBytes?: number
  systemDrive?: string
}

export function interpretDisk(raw: DiskRaw): Interpretation {
  const findings: Finding[] = []
  const actions: ActionRef[] = []
  const advice: string[] = []
  const vols = arr(raw.volumes as { id: string; label?: string; size: number; free: number }[]).filter((v) => v.size > 0)
  let worst = ''
  for (const v of vols) {
    const pct = (v.free / v.size) * 100
    const sys = v.id === (raw.systemDrive ?? 'C:')
    const status = v.free < 5 * 1024 ** 3 || pct < 5 ? 'fail' : pct < 15 ? 'warn' : 'ok'
    findings.push({ id: `vol-${v.id}`, status, title: `${v.id} ${v.label ? `(${v.label}) ` : ''}${gb(v.free)} free of ${gb(v.size)}`, detail: status === 'ok' ? 'Enough free space.' : sys ? 'The Windows drive needs free space for updates and memory paging.' : 'This drive is nearly full.' })
    if (status !== 'ok' && !worst) worst = v.id
  }
  if (!vols.length) findings.push({ id: 'volumes', status: 'unknown', title: 'No drives reported', detail: 'Could not read drive sizes.' })

  const reclaim: [string, number | undefined, string][] = [
    ['Temporary files', raw.tempBytes, 'repair.clear-temp'],
    ['Recycle Bin', raw.recycleBytes, 'repair.empty-recycle'],
    ['Downloads folder', raw.downloadsBytes, ''],
    ['Windows Update downloads', raw.updateCacheBytes, '']
  ]
  for (const [name, bytes, repair] of reclaim) {
    if (bytes === undefined || bytes === null) continue
    findings.push({ id: `size-${name}`, status: 'info', title: `${name}: ${mb(bytes)}`, detail: bytes > 500 * 1024 ** 2 ? 'Could free a noticeable amount of space.' : 'Small.' })
    if (repair && bytes > 50 * 1024 ** 2) actions.push({ kind: 'repair', id: repair, reason: `Frees up to ${mb(bytes)}.` })
  }
  if ((raw.downloadsBytes ?? 0) > 1024 ** 3) actions.push({ kind: 'tool', id: 'downloads', reason: 'Review and delete large downloads you no longer need.' })
  actions.push({ kind: 'settings', id: 'storage', reason: 'See what uses space and turn on Storage Sense.' })
  actions.push({ kind: 'tool', id: 'cleanmgr', reason: 'Windows Disk Cleanup can also remove old update files (choose “Clean up system files”).' })
  return finish(findings, actions, advice, {
    ok: ['All drives have enough free space.', 'Every drive has more than 15% free.'],
    problem: [`Drive ${worst} is running out of space.`, 'The largest easy wins are listed below with their sizes.']
  })
}

// ───────────── App not responding ─────────────
export interface HangRaw {
  notResponding?: { pid: number; name: string; title?: string }[] | object
  hangs?: { app: string; count: number; last: string }[] | object
  crashes?: { app: string; count: number; last: string; module?: string }[] | object
}

export function interpretHang(raw: HangRaw): Interpretation {
  const findings: Finding[] = []
  const actions: ActionRef[] = []
  const advice: string[] = []
  const nr = arr(raw.notResponding as { pid: number; name: string; title?: string }[]).filter((p) => p && typeof p.pid === 'number')
  const hangs = arr(raw.hangs as { app: string; count: number; last: string }[]).filter((h) => h && typeof h === 'object' && h.app).map((h) => ({ ...h, last: String(h.last ?? '') }))
  const crashes = arr(raw.crashes as { app: string; count: number; last: string; module?: string }[]).filter((c) => c && typeof c === 'object' && c.app).map((c) => ({ ...c, last: String(c.last ?? '') }))
  if (nr.length) {
    findings.push({ id: 'now', status: 'fail', title: `${nr.length} program(s) not responding right now`, detail: nr.map((p) => p.title || p.name).join(', '), evidence: nr.map((p) => `${p.name} (PID ${p.pid})${p.title ? ` – ${p.title}` : ''}`).join('\n') })
    for (const p of nr.filter((p) => canEnd(p.name)).slice(0, 4)) actions.push({ kind: 'repair', id: 'repair.proc-stop', params: { pid: p.pid }, label: `End ${p.name} (PID ${p.pid})`, reason: 'Closes the frozen program. Unsaved work in it is lost.' })
    advice.push('Wait a minute before ending a program: it may be busy saving or loading.')
  } else findings.push({ id: 'now', status: 'ok', title: 'No program is frozen right now', detail: 'Every window is responding.' })
  if (hangs.length) findings.push({ id: 'hangs', status: 'warn', title: 'Programs that froze in the last 7 days', detail: hangs.slice(0, 5).map((h) => `${h.app} (${h.count}×)`).join(', '), evidence: hangs.map((h) => `${h.app}: ${h.count} hang(s), last ${h.last.slice(0, 16).replace('T', ' ')}`).join('\n') })
  if (crashes.length) {
    findings.push({ id: 'crashes', status: 'warn', title: 'Programs that crashed in the last 7 days', detail: crashes.slice(0, 5).map((c) => `${c.app} (${c.count}×)`).join(', '), evidence: crashes.map((c) => `${c.app}: ${c.count} crash(es)${c.module ? `, faulting module ${c.module}` : ''}, last ${c.last.slice(0, 16).replace('T', ' ')}`).join('\n') })
    advice.push('For a program that keeps crashing: update it, then reinstall it if it still crashes. If the faulting module is a driver or a plugin, update that instead.')
    actions.push({ kind: 'settings', id: 'installed-apps', reason: 'Repair, reset or reinstall the crashing app.' })
  }
  if (!hangs.length && !crashes.length) findings.push({ id: 'history', status: 'ok', title: 'No crashes or hangs recorded in 7 days', detail: 'Windows logged no application crashes.' })
  actions.push({ kind: 'tool', id: 'reliability', reason: 'Reliability Monitor shows crashes over time.' })
  actions.push({ kind: 'tool', id: 'taskmgr', reason: 'End tasks and watch usage live.' })
  return finish(findings, actions, advice, {
    ok: ['No frozen or crashing programs found.', 'If a program freezes again, run this check while it is frozen.'],
    problem: [nr.length ? 'A program is frozen right now.' : 'Some programs have been crashing or freezing.', nr.length ? 'It stopped responding to Windows.' : 'The crash history below shows which programs and how often.']
  })
}

// ───────────── Startup ─────────────
export interface StartupRaw {
  items?: { name: string; command?: string; location?: string; enabled?: boolean }[] | object
  bootMs?: number | null
  bootError?: string | null
  fastStartup?: boolean | null
  uptimeHours?: number
}

export function interpretStartup(raw: StartupRaw): Interpretation {
  const findings: Finding[] = []
  const actions: ActionRef[] = []
  const advice: string[] = []
  const items = arr(raw.items as { name: string; command?: string; location?: string; enabled?: boolean }[])
  const enabled = items.filter((i) => i.enabled !== false)
  const ev = items.map((i) => `${i.enabled === false ? '[off] ' : ''}${i.name}  –  ${i.location ?? ''}`).join('\n')
  if (enabled.length > 12) findings.push({ id: 'items', status: 'warn', title: `${enabled.length} programs start automatically`, detail: 'Each one adds to sign-in time and keeps running in the background.', evidence: ev })
  else findings.push({ id: 'items', status: 'ok', title: `${enabled.length} programs start automatically`, detail: 'A reasonable number.', evidence: ev || undefined })
  if (typeof raw.bootMs === 'number') {
    const s = Math.round(raw.bootMs / 1000)
    findings.push({ id: 'boot', status: s > 90 ? 'warn' : 'ok', title: `Last measured boot took ${s} seconds`, detail: s > 90 ? 'Slower than typical (under 60 seconds on an SSD).' : 'Normal.' })
  } else if (raw.bootError) {
    findings.push({ id: 'boot', status: 'info', title: 'Boot time not available', detail: 'Reading the boot performance log needs administrator rights.' })
  }
  if (raw.fastStartup === false) findings.push({ id: 'fast', status: 'info', title: 'Fast Startup is off', detail: 'Turning it on can shorten cold boots, but some dual-boot and update scenarios work better with it off.' })
  actions.push({ kind: 'settings', id: 'startup-apps', reason: 'Turn off programs you do not need at startup.' })
  actions.push({ kind: 'tool', id: 'taskmgr-startup', reason: 'Task Manager shows the startup impact of each program.' })
  advice.push('Turning off a startup program does not uninstall it; you can still open it normally.')
  return finish(findings, actions, advice, {
    ok: ['Startup looks reasonable.', 'There are not too many startup programs. Slow sign-in can also come from a nearly full disk or an HDD; run “Computer running slowly” too.'],
    problem: ['Too many programs start with Windows.', 'Startup programs compete for the disk and processor right after you sign in.']
  })
}

// ───────────── Printer ─────────────
export interface PrinterRaw {
  spooler?: Svc | null
  printers?: { name: string; status: string; offline?: boolean; isDefault?: boolean; port?: string; jobs?: number; errorJobs?: number }[] | object
  printersError?: string | null
}

export function interpretPrinter(raw: PrinterRaw): Interpretation {
  const findings: Finding[] = []
  const actions: ActionRef[] = []
  const advice: string[] = []
  let headline = ''
  let cause = ''
  const sp = raw.spooler
  if (!sp) findings.push({ id: 'spooler', status: 'unknown', title: 'Print Spooler status unknown', detail: 'Could not read the service.' })
  else if (!/running/i.test(sp.status)) {
    findings.push({ id: 'spooler', status: 'fail', title: 'Print Spooler is not running', detail: 'Nothing can print while this service is stopped.', evidence: `${sp.status}, ${sp.startType ?? ''}` })
    headline = 'The Print Spooler service is stopped.'
    cause = 'Windows’ printing service is not running.'
    actions.push({ kind: 'repair', id: 'repair.spooler-restart', reason: 'Start the printing service.' })
  } else findings.push({ id: 'spooler', status: 'ok', title: 'Print Spooler is running', detail: 'The printing service works.' })

  const printers = arr(raw.printers as { name: string; status: string; offline?: boolean; isDefault?: boolean; port?: string; jobs?: number; errorJobs?: number }[])
  const real = printers.filter((p) => !/(pdf|xps|onenote|fax)/i.test(p.name))
  if (raw.printersError) findings.push({ id: 'printers', status: 'unknown', title: 'Could not list printers', detail: raw.printersError })
  else if (!real.length) {
    findings.push({ id: 'printers', status: 'fail', title: 'No physical printer is installed', detail: printers.length ? `Only virtual printers: ${printers.map((p) => p.name).join(', ')}.` : 'No printers at all.' })
    if (!headline) { headline = 'No printer is installed on this PC.'; cause = 'The printer needs to be added in Settings.' }
    actions.push({ kind: 'settings', id: 'printers', reason: 'Add your printer.' })
  } else {
    for (const p of real) {
      const problem = p.offline || !/idle|printing|warming|normal|^ok$/i.test(p.status)
      findings.push({ id: `p-${p.name}`, status: p.offline ? 'warn' : problem ? 'warn' : 'ok', title: `${p.name}${p.isDefault ? ' (default)' : ''}: ${p.offline ? 'offline' : p.status}`, detail: p.offline ? 'Windows thinks the printer is offline: it is off, asleep, or not on the network.' : `Port ${p.port ?? 'unknown'}.`, evidence: `Jobs in queue: ${p.jobs ?? 0}${p.errorJobs ? `, with errors: ${p.errorJobs}` : ''}` })
      if (p.offline && !headline) { headline = `${p.name} is offline.`; cause = 'The printer is off, asleep, or not connected to the same network.' }
      if ((p.errorJobs ?? 0) > 0 || (p.jobs ?? 0) > 5) {
        if (!headline) { headline = 'Print jobs are stuck in the queue.'; cause = 'A failed job is blocking the jobs behind it.' }
        actions.push({ kind: 'repair', id: 'repair.spooler-clear', reason: 'Delete stuck jobs so new ones can print.' })
      }
    }
    if (!real.some((p) => p.isDefault)) findings.push({ id: 'default', status: 'info', title: 'Your default printer is not a physical printer', detail: 'Apps may be printing to a PDF or OneNote printer by default.' })
  }
  if (sp && /running/i.test(sp.status)) actions.push({ kind: 'repair', id: 'repair.spooler-restart', reason: 'Restarting the spooler often clears printing glitches.' })
  actions.push({ kind: 'settings', id: 'printers', reason: 'Open the printer, see its queue, or print a test page.' })
  advice.push('Turn the printer off and on, and check it is on the same Wi-Fi/network or that the USB cable is connected.')
  return finish(findings, actions, advice, {
    ok: ['Printing looks set up correctly.', 'The spooler runs and your printer is ready. If it still does not print, print a test page from Settings.'],
    problem: [headline || 'Printing needs attention.', cause || 'See the findings below.']
  })
}

// ───────────── Services ─────────────
export interface ServicesRaw {
  stopped?: { name: string; display: string; exitCode: number; delayed?: boolean }[] | object
  events?: { service: string; count: number; last: string; ids: string; message: string }[] | object
}

// Exit codes that mean "stopped normally" for automatic services.
const BENIGN_EXIT = new Set([0, 1077])

export function interpretServices(raw: ServicesRaw): Interpretation {
  const findings: Finding[] = []
  const actions: ActionRef[] = []
  const advice: string[] = []
  const stopped = arr(raw.stopped as { name: string; display: string; exitCode: number }[])
  const events = arr(raw.events as { service: string; count: number; last: string; ids: string; message: string }[]).map((e) => ({ ...e, last: String(e.last ?? ''), message: String(e.message ?? '') }))
  const failed = stopped.filter((s) => !BENIGN_EXIT.has(Number(s.exitCode)))
  const benign = stopped.filter((s) => BENIGN_EXIT.has(Number(s.exitCode)))
  if (failed.length) {
    findings.push({ id: 'failed', status: 'fail', title: `${failed.length} automatic service(s) stopped with an error`, detail: failed.map((s) => s.display).join(', '), evidence: failed.map((s) => `${s.name} (${s.display}): exit code ${s.exitCode}`).join('\n') })
    for (const s of failed.slice(0, 5)) actions.push({ kind: 'repair', id: 'repair.service-start', params: { service: s.name }, label: `Start ${s.display}`, reason: 'Try starting it. If it stops again, the event log below explains why.' })
  } else findings.push({ id: 'failed', status: 'ok', title: 'No automatic service has failed', detail: 'All services that should run either run or stopped normally.' })
  if (benign.length) findings.push({ id: 'benign', status: 'info', title: `${benign.length} automatic service(s) stopped normally`, detail: 'These start on demand and stop when idle. This is expected.', evidence: benign.map((s) => s.display).join('\n') })
  if (events.length) {
    const total = events.reduce((n, e) => n + (Number(e.count) || 0), 0)
    findings.push({ id: 'events', status: total >= 3 || events.some((e) => e.count >= 2) ? 'warn' : 'info', title: 'Service errors in the last 7 days', detail: events.slice(0, 5).map((e) => `${e.service} (${e.count}×)`).join(', '), evidence: events.slice(0, 10).map((e) => `${e.service}: ${e.count} event(s) [${e.ids}], last ${e.last.slice(0, 16).replace('T', ' ')}\n  ${e.message}`).join('\n') })
  }
  actions.push({ kind: 'tool', id: 'services', reason: 'See and configure all services.' })
  actions.push({ kind: 'tool', id: 'eventvwr', reason: 'Full error details in Event Viewer.' })
  return finish(findings, actions, advice, {
    ok: ['No failing services found.', 'Services that should run are running.'],
    problem: [failed.length ? 'A Windows service has failed.' : 'Some services logged errors recently.', failed.length ? `${failed[0].display} should be running but stopped with error ${failed[0].exitCode}.` : 'See the event details below.']
  })
}
