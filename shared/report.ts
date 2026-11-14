import type { Diagnosis, Finding, TroubleshootHistoryEntry } from './troubleshoot'
import type { NetworkOverview, SystemOverview } from './types'

const ICON: Record<Finding['status'], string> = { ok: '[OK]  ', info: '[i]   ', warn: '[!]   ', fail: '[X]   ', unknown: '[?]   ' }

/** Plain-text result of one diagnosis, for copying into a ticket or chat. */
export function formatDiagnosis(d: Diagnosis, title: string): string {
  const lines = [
    `${title}: ${d.headline}`,
    `Checked: ${new Date(d.ranAt).toLocaleString()} (${(d.durationMs / 1000).toFixed(1)} s)${d.elevated ? ' as administrator' : ''}`,
    `Likely cause: ${d.cause}`,
    '',
    ...d.findings.flatMap((f) => [`${ICON[f.status]}${f.title}`, `      ${f.detail}`, ...(f.evidence ? f.evidence.split('\n').map((l) => `      > ${l}`) : [])])
  ]
  if (d.advice.length) lines.push('', 'Suggested manual steps:', ...d.advice.map((a) => `- ${a}`))
  if (d.errors.length) lines.push('', 'Check errors:', ...d.errors.map((e) => `- ${e}`))
  return lines.join('\n')
}

export interface ReportInput {
  generatedAt: number
  appVersion: string
  elevated: boolean
  includeIdentity: boolean
  user: string
  overview: SystemOverview | null
  network: NetworkOverview | null
  health: {
    errors24h: number
    topErrorSources: { source: string; count: number }[]
    rebootPending: boolean
    lastUpdate: { title: string; date: string } | null
    failedUpdates30d: number
    startupCount: number
    wuDisabled: number
  } | null
  history: TroubleshootHistoryEntry[]
  diagnoses: { title: string; diagnosis: Diagnosis }[]
  errors: string[]
}

const gbs = (n: number) => `${(n / 1024 ** 3).toFixed(1)} GB`

function maskMac(mac: string): string {
  return mac ? mac.replace(/^(([0-9a-f]{2}[:-]){3}).*$/i, '$1xx:xx:xx') : ''
}

/**
 * Support report from real system data. Identifying details (computer name,
 * user name, full MAC and IPv6 addresses) are only included when asked for.
 * Credentials are never collected.
 */
export function buildReport(r: ReportInput): string {
  const id = r.includeIdentity
  const o = r.overview
  const out: string[] = []
  out.push('# NEXTERM Support Report', '')
  out.push(`Generated: ${new Date(r.generatedAt).toLocaleString()}  ·  NEXTERM ${r.appVersion}  ·  ${r.elevated ? 'run as administrator' : 'run as standard user'}`)
  out.push(id ? 'Identifying details: included' : 'Identifying details: hidden (computer name, user name, MAC and IPv6 addresses)', '')

  out.push('## Device')
  if (o) {
    out.push(`- Computer name: ${id ? o.hostname : '(hidden)'}`)
    if (id) out.push(`- User: ${r.user}`)
    out.push(`- Windows: ${o.os.distro} ${o.os.release} (build ${o.os.build || 'n/a'}, ${o.os.arch})`)
    out.push(`- Processor: ${o.cpu.manufacturer} ${o.cpu.brand}, ${o.cpu.physicalCores} cores / ${o.cpu.cores} threads`)
    out.push(`- Memory: ${gbs(o.memTotal)}`)
    for (const g of o.gpus) out.push(`- Graphics: ${g.model}${g.driver ? ` (driver ${g.driver})` : ''}`)
    for (const d of o.physicalDisks) out.push(`- Disk: ${d.name || d.vendor} ${d.type} ${gbs(d.size)}${d.smart ? `, SMART ${d.smart}` : ''}`)
    const days = Math.floor(o.uptimeSec / 86400)
    out.push(`- Uptime: ${days} day(s) ${Math.floor((o.uptimeSec % 86400) / 3600)} h`)
  } else out.push('- Not available')
  out.push('')

  out.push('## Storage')
  if (o?.disks.length) for (const d of o.disks) out.push(`- ${d.mount || d.fs} (${d.type}): ${gbs(d.size - d.used)} free of ${gbs(d.size)} (${Math.round(((d.size - d.used) / d.size) * 100)}% free)`)
  else out.push('- Not available')
  out.push('')

  out.push('## Network')
  const n = r.network
  if (n) {
    out.push(`- Internet: ${n.internet.reachable ? `reachable (${n.internet.latencyMs} ms to ${n.internet.target})` : 'NOT reachable'}`)
    out.push(`- DNS resolution: ${n.dnsResolution.ok ? `working (${n.dnsResolution.ms} ms)` : 'FAILING'}`)
    out.push(`- Default gateway: ${n.defaultGateway || 'none'}`)
    for (const a of n.adapters.filter((x) => x.operstate === 'up' || x.isDefault)) {
      out.push(`- Adapter ${a.iface}${a.isDefault ? ' (default)' : ''}: ${a.operstate}, IPv4 ${a.ip4 || 'none'}${a.ip4subnet ? `/${a.ip4subnet}` : ''}, DHCP ${a.dhcp ? 'yes' : 'no'}${a.speedMbps ? `, ${a.speedMbps} Mbps` : ''}`)
      out.push(`    MAC ${id ? a.mac : maskMac(a.mac)}${id && a.ip6 ? `, IPv6 ${a.ip6}` : ''}`)
    }
    for (const d of n.dns) out.push(`- DNS servers (${d.iface}): ${d.servers.join(', ')}`)
  } else out.push('- Not available')
  out.push('')

  out.push('## Health')
  const h = r.health
  if (h) {
    out.push(`- Errors in System/Application logs (24 h): ${h.errors24h}`)
    if (h.topErrorSources.length) out.push(`  Top sources: ${h.topErrorSources.map((t) => `${t.source} (${t.count})`).join(', ')}`)
    out.push(`- Last successful Windows update: ${h.lastUpdate ? `${h.lastUpdate.date.slice(0, 10)}, ${h.lastUpdate.title}` : 'unknown'}`)
    out.push(`- Failed updates (30 days): ${h.failedUpdates30d}`)
    out.push(`- Update services disabled: ${h.wuDisabled ? 'YES' : 'no'}`)
    out.push(`- Restart pending: ${h.rebootPending ? 'yes' : 'no'}`)
    out.push(`- Startup programs: ${h.startupCount}`)
  } else out.push('- Not available')
  out.push('')

  if (r.diagnoses.length) {
    out.push('## Diagnostics run for this report', '')
    for (const d of r.diagnoses) out.push('```', formatDiagnosis(d.diagnosis, d.title), '```', '')
  }

  if (r.history.length) {
    out.push('## Recent troubleshooting')
    for (const e of r.history.slice(0, 15)) {
      out.push(`- ${new Date(e.ts).toLocaleString()}  ${e.diagnosisId}: ${e.status.toUpperCase()}, ${e.headline}${e.afterActions.length ? ` (after: ${e.afterActions.join(', ')})` : ''}`)
    }
    out.push('')
  }

  if (r.errors.length) out.push('## Collection errors', ...r.errors.map((e) => `- ${e}`), '')
  out.push('_Generated by NEXTERM from live system data. No passwords, keys or browsing data are collected._')
  return out.join('\n')
}
