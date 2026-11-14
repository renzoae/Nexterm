import { arr, gb, overallStatus, type ActionRef, type Finding, type Interpretation } from '../troubleshoot'
import { dedupe } from './network'

export interface SlowRaw {
  cpuLoad?: number | null
  memTotalKB?: number
  memFreeKB?: number
  topCpu?: Proc[] | Proc
  topMem?: Proc[] | Proc
  notResponding?: Proc[] | Proc
  sysDrive?: { id: string; size: number; free: number } | null
  sysMediaType?: string | null
  startupCount?: number
  uptimeHours?: number
  powerPlan?: string | null
}
interface Proc { pid: number; name: string; cpu?: number; memMB?: number }

// Processes that must never be offered for termination.
const PROTECTED = new Set([
  'system', 'idle', 'registry', 'smss', 'csrss', 'wininit', 'winlogon', 'services', 'lsass', 'lsaiso', 'svchost', 'fontdrvhost', 'dwm',
  'memory compression', 'secure system', 'msmpeng', 'searchindexer', 'audiodg', 'spoolsv', 'explorer', 'powershell', 'nexterm', 'electron', 'conhost'
])

export function canEnd(name: string): boolean {
  return !PROTECTED.has(name.toLowerCase())
}

export function interpretSlow(raw: SlowRaw): Interpretation {
  const findings: Finding[] = []
  const actions: ActionRef[] = []
  const advice: string[] = []
  const causes: string[] = []
  const topCpu = arr(raw.topCpu)
  const topMem = arr(raw.topMem)
  const hung = arr(raw.notResponding)

  // CPU
  if (typeof raw.cpuLoad === 'number') {
    const heavy = topCpu.filter((p) => (p.cpu ?? 0) >= 15)
    const list = topCpu.slice(0, 5).map((p) => `${p.name} (PID ${p.pid}): ${p.cpu}%`).join('\n')
    if (raw.cpuLoad >= 85) {
      findings.push({ id: 'cpu', status: 'fail', title: `Processor is very busy (${raw.cpuLoad}%)`, detail: heavy.length ? `Mostly used by ${heavy.map((p) => p.name).join(', ')}.` : 'Many processes are using the processor.', evidence: list })
      causes.push('a program using most of the processor')
    } else if (raw.cpuLoad >= 60) {
      findings.push({ id: 'cpu', status: 'warn', title: `Processor is busy (${raw.cpuLoad}%)`, detail: heavy.length ? `Top user: ${heavy[0].name}.` : 'Moderately high load.', evidence: list })
    } else {
      findings.push({ id: 'cpu', status: 'ok', title: `Processor load is normal (${raw.cpuLoad}%)`, detail: 'The processor is not the bottleneck right now.', evidence: list })
    }
    for (const p of heavy.filter((p) => canEnd(p.name)).slice(0, 3)) {
      actions.push({ kind: 'repair', id: 'repair.proc-stop', params: { pid: p.pid }, label: `End ${p.name} (PID ${p.pid}, ${p.cpu}% CPU)`, reason: 'Frees the processor. Save your work in it first.' })
    }
  } else {
    findings.push({ id: 'cpu', status: 'unknown', title: 'Processor load not available', detail: 'Windows did not report processor load.' })
  }

  // Memory
  if (raw.memTotalKB && raw.memFreeKB !== undefined) {
    const used = Math.round(((raw.memTotalKB - raw.memFreeKB) / raw.memTotalKB) * 100)
    const totalGB = raw.memTotalKB / 1024 / 1024
    const list = topMem.slice(0, 5).map((p) => `${p.name} (PID ${p.pid}): ${p.memMB} MB`).join('\n')
    if (used >= 90) {
      findings.push({ id: 'memory', status: 'fail', title: `Memory almost full (${used}% of ${totalGB.toFixed(1)} GB)`, detail: 'Windows is swapping to disk, which makes everything slow.', evidence: list })
      causes.push('memory (RAM) running out')
      for (const p of topMem.filter((p) => canEnd(p.name) && (p.memMB ?? 0) > 500).slice(0, 2)) {
        actions.push({ kind: 'repair', id: 'repair.proc-stop', params: { pid: p.pid }, label: `End ${p.name} (PID ${p.pid}, ${p.memMB} MB)`, reason: 'Frees memory. Save your work in it first.' })
      }
    } else if (used >= 80) {
      findings.push({ id: 'memory', status: 'warn', title: `Memory usage is high (${used}%)`, detail: 'Close programs or browser tabs you are not using.', evidence: list })
    } else {
      findings.push({ id: 'memory', status: 'ok', title: `Memory usage is fine (${used}%)`, detail: `${totalGB.toFixed(1)} GB installed.`, evidence: list })
    }
    if (totalGB < 7.5) advice.push(`This PC has ${totalGB.toFixed(1)} GB of RAM. 8 GB or more makes Windows noticeably smoother.`)
  }

  // Not responding
  if (hung.length) {
    findings.push({ id: 'hung', status: 'warn', title: `${hung.length} program(s) not responding`, detail: hung.map((p) => p.name).join(', '), evidence: hung.map((p) => `${p.name} (PID ${p.pid})`).join('\n') })
    for (const p of hung.filter((p) => canEnd(p.name)).slice(0, 3)) {
      actions.push({ kind: 'repair', id: 'repair.proc-stop', params: { pid: p.pid }, label: `End ${p.name} (not responding)`, reason: 'A frozen program can slow down everything else.' })
    }
  }

  // Disk
  if (raw.sysDrive && raw.sysDrive.size > 0) {
    const pctFree = (raw.sysDrive.free / raw.sysDrive.size) * 100
    const ev = `${raw.sysDrive.id} ${gb(raw.sysDrive.free)} free of ${gb(raw.sysDrive.size)}`
    if (raw.sysDrive.free < 5 * 1024 ** 3 || pctFree < 5) {
      findings.push({ id: 'disk', status: 'fail', title: 'System drive almost full', detail: 'Windows needs free space for memory paging and updates.', evidence: ev })
      causes.push('a nearly full system drive')
      actions.push({ kind: 'repair', id: 'repair.clear-temp', reason: 'Safely remove old temporary files.' })
      actions.push({ kind: 'settings', id: 'storage', reason: 'See what is using space and turn on Storage Sense.' })
    } else if (pctFree < 15) {
      findings.push({ id: 'disk', status: 'warn', title: `System drive is getting full (${pctFree.toFixed(0)}% free)`, detail: 'Keep at least 15% free for best performance.', evidence: ev })
      actions.push({ kind: 'settings', id: 'storage', reason: 'Free up space.' })
    } else {
      findings.push({ id: 'disk', status: 'ok', title: `Enough free space (${pctFree.toFixed(0)}% free)`, detail: ev })
    }
  }
  if (raw.sysMediaType && /hdd/i.test(raw.sysMediaType)) {
    findings.push({ id: 'hdd', status: 'info', title: 'Windows is on a hard disk (HDD)', detail: 'Hard disks are much slower than SSDs. Upgrading to an SSD is the biggest speed-up for older PCs.' })
  }

  // Startup
  if (typeof raw.startupCount === 'number') {
    if (raw.startupCount > 15) {
      findings.push({ id: 'startup', status: 'warn', title: `${raw.startupCount} programs start with Windows`, detail: 'Many startup programs keep running in the background and slow the PC down.' })
      actions.push({ kind: 'settings', id: 'startup-apps', reason: 'Turn off startup programs you do not need.' })
    } else {
      findings.push({ id: 'startup', status: 'ok', title: `${raw.startupCount} startup programs`, detail: 'A reasonable number.' })
    }
  }

  // Uptime
  if (typeof raw.uptimeHours === 'number') {
    const days = raw.uptimeHours / 24
    if (days >= 7) {
      findings.push({ id: 'uptime', status: 'warn', title: `Not restarted for ${Math.floor(days)} days`, detail: 'A restart clears memory leaks and finishes pending updates. Note: “Shut down” with Fast Startup does not fully reset Windows; use “Restart”.' })
      advice.push('Save your work and use Start › Power › Restart.')
    } else {
      findings.push({ id: 'uptime', status: 'ok', title: 'Restarted recently', detail: `Up for ${days >= 1 ? `${Math.floor(days)} day(s)` : `${Math.round(raw.uptimeHours)} hour(s)`}.` })
    }
  }

  // Power plan
  if (raw.powerPlan && /power saver/i.test(raw.powerPlan)) {
    findings.push({ id: 'power', status: 'warn', title: 'Power saver plan is active', detail: 'Power saver limits processor speed.', evidence: raw.powerPlan })
    actions.push({ kind: 'settings', id: 'power', reason: 'Choose a balanced or best-performance power mode.' })
  }

  actions.push({ kind: 'tool', id: 'taskmgr', reason: 'See live usage of every program.' })
  const status = overallStatus(findings)
  const headline =
    status === 'ok' ? 'No performance problem found right now.'
      : status === 'unknown' ? 'Performance checks could not complete.'
        : causes.length ? `Most likely cause: ${causes.join(', ')}.` : 'Some things may be slowing this PC down.'
  const cause =
    status === 'ok'
      ? 'Processor, memory and disk look fine at this moment. If the PC is slow only sometimes, run this check while it is slow.'
      : causes.length ? `NEXTERM found ${causes.join(' and ')}.` : 'See the findings below for what to look at.'
  return { status, headline, cause, findings, actions: dedupe(actions), advice }
}
