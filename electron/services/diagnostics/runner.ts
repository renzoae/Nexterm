// Runs read-only diagnostics and interprets the results. No Electron imports, so
// this module can be exercised directly on Windows by the test suite.
import { randomUUID } from 'node:crypto'
import { promises as dns } from 'node:dns'
import http from 'node:http'
import { Socket } from 'node:net'
import { interpretNetwork, type NetworkRaw } from '@shared/diagnostics/network'
import { interpretSlow } from '@shared/diagnostics/slow'
import { interpretUpdate } from '@shared/diagnostics/update'
import { interpretDisk, interpretHang, interpretPrinter, interpretServices, interpretSound, interpretStartup } from '@shared/diagnostics/other'
import type { Diagnosis, DiagnosisId, Interpretation } from '@shared/troubleshoot'
import { isElevated } from '../admin'
import { isWindows } from '../paths'
import { runPsJson } from '../powershell'
import { DIAGNOSIS_SCRIPTS, HEALTH } from './scripts'

export function tcpProbe(host: string, port: number, timeoutMs = 4000): Promise<number | null> {
  return new Promise((resolve) => {
    const s = new Socket()
    const start = Date.now()
    const done = (v: number | null) => { s.destroy(); resolve(v) }
    s.setTimeout(timeoutMs)
    s.once('connect', () => done(Date.now() - start))
    s.once('timeout', () => done(null))
    s.once('error', () => done(null))
    s.connect(port, host)
  })
}

async function dnsProbe(host: string): Promise<NetworkRaw['probes']['systemDns']> {
  const start = Date.now()
  try {
    await Promise.race([dns.lookup(host), new Promise((_, rej) => setTimeout(() => rej(new Error('timed out after 5 s')), 5000))])
    return { host, ok: true, ms: Date.now() - start }
  } catch (e) {
    return { host, ok: false, ms: null, error: (e as Error).message }
  }
}

/** Microsoft's own connectivity test (NCSI). A wrong body means a captive portal or interception. */
function ncsiProbe(): Promise<NetworkRaw['probes']['ncsi']> {
  return new Promise((resolve) => {
    const req = http.get('http://www.msftconnecttest.com/connecttest.txt', { timeout: 6000 }, (res) => {
      let body = ''
      res.setEncoding('utf8')
      res.on('data', (c: string) => { if (body.length < 2000) body += c })
      res.on('end', () => resolve({ ok: res.statusCode === 200 && body.trim() === 'Microsoft Connect Test', status: res.statusCode ?? null, body }))
    })
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, status: null, body: null, error: 'timed out' }) })
    req.on('error', (e) => resolve({ ok: false, status: null, body: null, error: e.message }))
  })
}

export async function networkProbes(): Promise<NetworkRaw['probes']> {
  const [a, b, sysDns, ncsi] = await Promise.all([tcpProbe('1.1.1.1', 443), tcpProbe('8.8.8.8', 443), dnsProbe('www.microsoft.com'), ncsiProbe()])
  return {
    tcp: [
      { target: '1.1.1.1:443 (Cloudflare)', ok: a !== null, ms: a },
      { target: '8.8.8.8:443 (Google)', ok: b !== null, ms: b }
    ],
    systemDns: sysDns,
    ncsi
  }
}

const TIMEOUTS: Partial<Record<DiagnosisId, number>> = { disk: 180_000, update: 120_000, network: 90_000 }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Interpreter = (raw: any) => Interpretation
const INTERPRET: Record<Exclude<DiagnosisId, 'network'>, Interpreter> = {
  slow: interpretSlow, update: interpretUpdate, sound: interpretSound, disk: interpretDisk,
  hang: interpretHang, startup: interpretStartup, printer: interpretPrinter, services: interpretServices
}

export async function runDiagnosis(id: DiagnosisId): Promise<Diagnosis> {
  const started = Date.now()
  const base = { id: randomUUID(), diagnosisId: id, ranAt: started, elevated: await isElevated() }
  if (!isWindows) {
    return {
      ...base, durationMs: 0, status: 'unknown', headline: 'Guided troubleshooting runs on Windows.',
      cause: 'These checks read Windows-specific settings and logs.', findings: [], actions: [], advice: [], errors: ['Windows only']
    }
  }
  const errors: string[] = []
  const ps = runPsJson<unknown>(DIAGNOSIS_SCRIPTS[id], TIMEOUTS[id] ?? 60_000).catch((e: Error) => {
    errors.push(e.message)
    return null
  })
  let result: Interpretation
  if (id === 'network') {
    const [raw, probes] = await Promise.all([ps, networkProbes()])
    result = interpretNetwork({ ps: raw as NetworkRaw['ps'], probes })
  } else {
    const raw = await ps
    result = INTERPRET[id]((raw ?? {}) as never)
    if (raw === null) {
      result = { ...result, status: 'unknown', headline: 'The checks could not run.', cause: 'PowerShell did not return results. See the error below.' }
    }
  }
  return { ...base, ...result, durationMs: Date.now() - started, errors }
}

export interface HealthSummary {
  errors24h: number
  topErrorSources: { source: string; count: number }[]
  rebootPending: boolean
  lastUpdate: { title: string; date: string } | null
  failedUpdates30d: number
  historyError: string | null
  startupCount: number
  wuDisabled: number
}

export async function healthSummary(): Promise<HealthSummary | { error: string }> {
  if (!isWindows) return { error: 'Available on Windows.' }
  try {
    const r = await runPsJson<HealthSummary & { topErrorSources: unknown }>(HEALTH, 60_000)
    const top = r.topErrorSources
    return { ...r, topErrorSources: Array.isArray(top) ? top : top ? [top as { source: string; count: number }] : [] }
  } catch (e) {
    return { error: (e as Error).message }
  }
}
