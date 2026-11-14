import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { getCommand } from '@shared/commands'
import { interpretNetwork, type NetworkRaw } from '@shared/diagnostics/network'
import { interpretSlow } from '@shared/diagnostics/slow'
import { interpretUpdate } from '@shared/diagnostics/update'
import { interpretDisk, interpretHang, interpretPrinter, interpretServices, interpretSound, interpretStartup } from '@shared/diagnostics/other'
import { REPAIRS } from '@shared/repairs'
import { buildReport, formatDiagnosis } from '@shared/report'
import { SETTINGS, searchSettings } from '@shared/settings-catalog'
import type { ActionRef, Interpretation } from '@shared/troubleshoot'
import { validateParams } from '@shared/validation'

const okProbes: NetworkRaw['probes'] = {
  tcp: [{ target: '1.1.1.1:443', ok: true, ms: 12 }, { target: '8.8.8.8:443', ok: true, ms: 15 }],
  systemDns: { host: 'www.microsoft.com', ok: true, ms: 20 },
  ncsi: { ok: true, status: 200, body: 'Microsoft Connect Test' }
}
const wifi = { alias: 'Wi-Fi', ipv4: ['192.168.1.20'], gateway: ['192.168.1.1'], dns: ['192.168.1.1'] }
const ps = (over: object = {}) => ({ configs: [wifi], adapters: [{ name: 'Wi-Fi', status: 'Up' }], gateways: [{ gateway: '192.168.1.1', reachable: true }], publicDnsWorks: true, proxyEnabled: false, ...over })

const launcherSrc = readFileSync('electron/services/launcher.ts', 'utf8')
function checkActions(r: Interpretation) {
  for (const a of r.actions as ActionRef[]) {
    if (a.kind === 'repair') {
      const def = getCommand(a.id)
      expect(def, `repair ${a.id}`).toBeTruthy()
      expect(validateParams(def!, a.params ?? {}).ok, `params for ${a.id}`).toBe(true)
    }
    if (a.kind === 'settings') expect(SETTINGS.some((s) => s.id === a.id), `setting ${a.id}`).toBe(true)
    if (a.kind === 'tool') expect(launcherSrc.includes(`id: '${a.id}'`), `tool ${a.id}`).toBe(true)
  }
}

describe('network diagnosis (Scenario A)', () => {
  it('reports a healthy connection', () => {
    const r = interpretNetwork({ ps: ps(), probes: okProbes })
    expect(r.status).toBe('ok')
    expect(r.headline).toMatch(/working/)
    checkActions(r)
  })
  it('detects no network connection', () => {
    const r = interpretNetwork({ ps: ps({ configs: [], adapters: [{ name: 'Wi-Fi', status: 'Disconnected' }] }), probes: { ...okProbes, tcp: okProbes.tcp.map((t) => ({ ...t, ok: false, ms: null })), systemDns: { host: 'x', ok: false, ms: null } } })
    expect(r.status).toBe('problem')
    expect(r.headline).toMatch(/not connected/)
    expect(r.actions.some((a) => a.kind === 'settings' && a.id === 'wifi')).toBe(true)
    checkActions(r)
  })
  it('detects DHCP failure (169.254 address)', () => {
    const r = interpretNetwork({ ps: ps({ configs: [{ ...wifi, ipv4: ['169.254.10.2'], gateway: [] }], gateways: [] }), probes: { ...okProbes, tcp: okProbes.tcp.map((t) => ({ ...t, ok: false })), systemDns: { host: 'x', ok: false, ms: null } } })
    expect(r.headline).toMatch(/address from the router/)
    expect(r.actions.some((a) => a.kind === 'repair' && a.id === 'net.renew')).toBe(true)
    checkActions(r)
  })
  it('blames the ISP when the router answers but the internet does not', () => {
    const r = interpretNetwork({ ps: ps(), probes: { ...okProbes, tcp: okProbes.tcp.map((t) => ({ ...t, ok: false, ms: null })), systemDns: { host: 'x', ok: false, ms: null } } })
    expect(r.headline).toMatch(/router is reachable, but the internet is not/)
    expect(r.advice.join(' ')).toMatch(/provider/)
  })
  it('identifies a broken DNS server and offers DNS fixes with rollback', () => {
    const r = interpretNetwork({ ps: ps(), probes: { ...okProbes, systemDns: { host: 'www.microsoft.com', ok: false, ms: null, error: 'ENOTFOUND' } } })
    expect(r.headline).toMatch(/names do not resolve/)
    expect(r.cause).toMatch(/DNS server/)
    const dnsFix = r.actions.find((a) => a.kind === 'repair' && a.id === 'repair.dns-public')
    expect(dnsFix && dnsFix.kind === 'repair' && dnsFix.params?.adapter).toBe('Wi-Fi')
    expect(getCommand('repair.dns-public')?.repair?.rollback).toMatch(/Reset DNS/)
    checkActions(r)
  })
  it('treats a router that ignores ping as normal when the internet works', () => {
    const r = interpretNetwork({ ps: ps({ gateways: [{ gateway: '192.168.1.1', reachable: false }] }), probes: okProbes })
    expect(r.status).toBe('ok')
    expect(r.findings.find((f) => f.id === 'gateway')?.status).toBe('info')
  })
  it('detects a captive portal', () => {
    const r = interpretNetwork({ ps: ps(), probes: { ...okProbes, ncsi: { ok: false, status: 200, body: '<html>Hotel login</html>' } } })
    expect(r.headline).toMatch(/sign in/)
    expect(r.actions.some((a) => a.kind === 'url')).toBe(true)
  })
  it('handles PowerShell returning single objects instead of arrays', () => {
    const r = interpretNetwork({ ps: { configs: { alias: 'Ethernet', ipv4: '10.0.0.5', gateway: '10.0.0.1', dns: '10.0.0.1' }, gateways: { gateway: '10.0.0.1', reachable: true } }, probes: okProbes })
    expect(r.status).toBe('ok')
  })
})

describe('slow PC diagnosis (Scenario B)', () => {
  const base = { memTotalKB: 16 * 1024 * 1024, memFreeKB: 8 * 1024 * 1024, sysDrive: { id: 'C:', size: 500e9, free: 200e9 }, startupCount: 6, uptimeHours: 20, powerPlan: 'Balanced' }
  it('finds nothing wrong on an idle PC', () => {
    const r = interpretSlow({ ...base, cpuLoad: 8, topCpu: [{ pid: 100, name: 'chrome', cpu: 2, memMB: 400 }] })
    expect(r.status).toBe('ok')
  })
  it('names the heavy process and offers to end it, but never protected ones', () => {
    const r = interpretSlow({ ...base, cpuLoad: 95, topCpu: [{ pid: 4321, name: 'Renderer', cpu: 70, memMB: 900 }, { pid: 900, name: 'svchost', cpu: 20, memMB: 50 }] })
    expect(r.headline).toMatch(/processor/)
    const ends = r.actions.filter((a) => a.kind === 'repair' && a.id === 'repair.proc-stop')
    expect(ends).toHaveLength(1)
    expect(ends[0].kind === 'repair' && ends[0].params?.pid).toBe(4321)
    checkActions(r)
  })
  it('flags full memory, full disk, many startup apps and long uptime', () => {
    const r = interpretSlow({ ...base, cpuLoad: 20, memFreeKB: 0.5 * 1024 * 1024, sysDrive: { id: 'C:', size: 250e9, free: 3e9 }, startupCount: 25, uptimeHours: 24 * 12, sysMediaType: 'HDD', powerPlan: 'Power saver' })
    const ids = r.findings.filter((f) => f.status === 'fail' || f.status === 'warn').map((f) => f.id)
    expect(ids).toEqual(expect.arrayContaining(['memory', 'disk', 'startup', 'uptime', 'power']))
    expect(r.findings.find((f) => f.id === 'hdd')).toBeTruthy()
    checkActions(r)
  })
})

describe('Windows Update diagnosis (Scenario C)', () => {
  const now = Date.parse('2026-11-15T00:00:00Z')
  const svc = [{ name: 'wuauserv', status: 'Stopped', startType: 'Manual' }, { name: 'BITS', status: 'Running', startType: 'Manual' }, { name: 'CryptSvc', status: 'Running', startType: 'Automatic' }]
  it('is healthy with recent successes', () => {
    const r = interpretUpdate({ services: svc, history: [{ title: 'KB1', date: '2026-11-10T00:00:00Z', result: 2, hresult: '0x00000000' }], freeBytes: 80e9, sizeBytes: 250e9 }, now)
    expect(r.status).toBe('ok')
  })
  it('explains failed update error codes and offers cache reset with rollback', () => {
    const r = interpretUpdate({ services: svc, history: [{ title: 'KB5', date: '2026-11-12T00:00:00Z', result: 4, hresult: '0x800f081f' }], freeBytes: 80e9, sizeBytes: 250e9 }, now)
    expect(r.findings.find((f) => f.id === 'history')?.detail).toMatch(/DISM/)
    expect(r.actions.map((a) => a.kind === 'repair' && a.id)).toEqual(expect.arrayContaining(['win.dism-restore', 'repair.wu-reset-cache']))
    expect(getCommand('repair.wu-reset-cache')?.repair?.rollback).toMatch(/Restore/)
    checkActions(r)
  })
  it('detects disabled services, low space and pending restart', () => {
    const r = interpretUpdate({ services: [{ name: 'wuauserv', status: 'Stopped', startType: 'Disabled' }], history: [], freeBytes: 4e9, sizeBytes: 120e9, rebootPending: true }, now)
    expect(r.headline).toMatch(/disabled update services/)
    expect(r.actions.some((a) => a.kind === 'repair' && a.id === 'repair.wu-enable')).toBe(true)
    expect(r.findings.find((f) => f.id === 'reboot')?.status).toBe('warn')
    checkActions(r)
  })
  it('reports unknown when history cannot be read', () => {
    const r = interpretUpdate({ services: svc, historyError: 'COM error', freeBytes: 80e9, sizeBytes: 250e9 }, now)
    expect(r.findings.find((f) => f.id === 'history')?.status).toBe('unknown')
  })
})

describe('other diagnoses', () => {
  it('sound: muted output is the headline and unmute is first', () => {
    const r = interpretSound({ services: [{ name: 'Audiosrv', status: 'Running' }], devices: [{ name: 'Realtek', status: 'OK' }], endpoints: [{ name: 'Speakers', status: 'OK' }], volume: { ok: true, muted: true, level: 0.4 } })
    expect(r.headline).toMatch(/muted/)
    expect(r.actions[0]).toMatchObject({ kind: 'repair', id: 'repair.audio-unmute' })
    checkActions(r)
  })
  it('sound: missing default device', () => {
    const r = interpretSound({ services: [{ name: 'Audiosrv', status: 'Running' }], devices: [], endpoints: [], volume: { ok: false, error: 'Element not found. (Exception from HRESULT: 0x80070490)' } })
    expect(r.status).toBe('problem')
    expect(r.findings.find((f) => f.id === 'volume')?.title).toMatch(/No default/)
  })
  it('disk: low space on C and sizes of what can be removed', () => {
    const r = interpretDisk({ volumes: [{ id: 'C:', size: 256e9, free: 4e9 }], systemDrive: 'C:', tempBytes: 3e9, recycleBytes: 2e9, downloadsBytes: 9e9, updateCacheBytes: 1e9 })
    expect(r.headline).toMatch(/C:/)
    expect(r.actions.map((a) => a.kind !== 'url' && a.id)).toEqual(expect.arrayContaining(['repair.clear-temp', 'repair.empty-recycle', 'downloads']))
    checkActions(r)
  })
  it('hang: frozen app and crash history', () => {
    const r = interpretHang({ notResponding: { pid: 777, name: 'WINWORD', title: 'Doc1' }, crashes: [{ app: 'game.exe', count: 4, last: '2026-11-14T10:00:00Z', module: 'nvwgf2umx.dll' }] })
    expect(r.actions[0]).toMatchObject({ id: 'repair.proc-stop', params: { pid: 777 } })
    expect(r.findings.find((f) => f.id === 'crashes')?.evidence).toMatch(/nvwgf2umx/)
    checkActions(r)
  })
  it('startup: many items and slow boot', () => {
    const items = Array.from({ length: 16 }, (_, i) => ({ name: `App${i}`, location: 'HKCU Run', enabled: i !== 0 }))
    const r = interpretStartup({ items, bootMs: 120000 })
    expect(r.status).toBe('problem')
    expect(r.findings.find((f) => f.id === 'items')?.title).toMatch(/15 programs/)
    checkActions(r)
  })
  it('printer: stopped spooler and offline printer', () => {
    const r = interpretPrinter({ spooler: { name: 'Spooler', status: 'Stopped', startType: 'Disabled' }, printers: [{ name: 'HP LaserJet', status: 'Offline', offline: true, isDefault: true, jobs: 2, errorJobs: 1 }, { name: 'Microsoft Print to PDF', status: 'Idle' }] })
    expect(r.headline).toMatch(/Spooler/)
    expect(r.actions.map((a) => a.kind === 'repair' && a.id)).toEqual(expect.arrayContaining(['repair.spooler-restart', 'repair.spooler-clear']))
    checkActions(r)
  })
  it('printer: only virtual printers', () => {
    const r = interpretPrinter({ spooler: { name: 'Spooler', status: 'Running' }, printers: [{ name: 'Microsoft Print to PDF', status: 'Idle' }] })
    expect(r.headline).toMatch(/No printer/)
  })
  it('services: separates real failures from services that stopped normally', () => {
    const r = interpretServices({ stopped: [{ name: 'gupdate', display: 'Google Update', exitCode: 0 }, { name: 'MySvc', display: 'My Service', exitCode: 1067 }] })
    expect(r.findings.find((f) => f.id === 'failed')?.detail).toBe('My Service')
    expect(r.actions[0]).toMatchObject({ id: 'repair.service-start', params: { service: 'MySvc' } })
    checkActions(r)
  })
})

describe('repairs registry', () => {
  it('every repair declares impact and honest rollback', () => {
    for (const r of REPAIRS) {
      expect(r.repair?.impact.length).toBeGreaterThan(5)
      expect(r.repair && 'rollback' in r.repair).toBe(true)
      expect(r.risk).not.toBe('safe')
    }
  })
  it('placeholders match params', () => {
    for (const r of REPAIRS) {
      const src = r.exec.kind === 'ps' ? r.exec.script : r.exec.kind === 'exe' ? r.exec.args.join(' ') : r.exec.line
      const used = [...new Set([...src.matchAll(/\{([a-z][a-zA-Z0-9]*)\}/g)].map((m) => m[1]))].sort()
      expect(used, r.id).toEqual((r.params ?? []).map((p) => p.name).sort())
    }
  })
  it('rejects unsafe adapter and service names', () => {
    const dns = getCommand('repair.dns-public')!
    expect(validateParams(dns, { adapter: 'Wi-Fi' }).ok).toBe(true)
    expect(validateParams(dns, { adapter: 'Ethernet 2' }).ok).toBe(true)
    expect(validateParams(dns, { adapter: "x'; Remove-Item C:\\" }).ok).toBe(false)
    expect(validateParams(getCommand('repair.service-start')!, { service: 'svc; calc' }).ok).toBe(false)
    expect(validateParams(getCommand('repair.proc-stop')!, { pid: 0 }).ok).toBe(false)
  })
})

describe('settings catalog', () => {
  it.each([['change dns', 'ethernet'], ['bluetooth', 'bluetooth'], ['brightness', 'display'], ['startup applications', 'startup-apps'], ['firewall', 'firewall'], ['windows update', 'windows-update'], ['microphone', 'microphone'], ['power', 'power']])('"%s" finds %s', (q, id) => {
    expect(searchSettings(q)[0]?.id).toBe(id)
  })
  it('only uses settings URI schemes', () => {
    for (const s of SETTINGS) expect(s.uri).toMatch(/^(ms-settings:|windowsdefender:\/\/)/)
  })
})

describe('reports', () => {
  const overview = {
    hostname: 'PC-SECRET', os: { distro: 'Windows 11 Pro', release: '10.0.26100', build: '26100', arch: 'x64' },
    cpu: { brand: 'Core i5', manufacturer: 'Intel', physicalCores: 4, cores: 8, speedGHz: 2.4 }, memTotal: 16e9,
    gpus: [], disks: [{ fs: 'C:', mount: 'C:', type: 'NTFS', size: 500e9, used: 300e9 }], physicalDisks: [], uptimeSec: 90000, bootTime: 0, user: 'alice'
  }
  const network = {
    adapters: [{ iface: 'Wi-Fi', name: '', ip4: '192.168.1.5', ip4subnet: '255.255.255.0', ip6: 'fe80::1', mac: 'aa:bb:cc:dd:ee:ff', type: 'wireless', operstate: 'up', speedMbps: 300, dhcp: true, virtual: false, isDefault: true }],
    defaultGateway: '192.168.1.1', dns: [], internet: { reachable: true, latencyMs: 10, target: '1.1.1.1:443' }, dnsResolution: { ok: true, ms: 5, host: 'x' }
  }
  const input = { generatedAt: 0, appVersion: '0.2.0', elevated: false, user: 'alice', overview, network, health: null, history: [], diagnoses: [], errors: [] }
  it('hides identifying details by default', () => {
    const t = buildReport({ ...input, includeIdentity: false })
    expect(t).not.toMatch(/PC-SECRET|alice|dd:ee:ff|fe80/)
    expect(t).toMatch(/aa:bb:cc:xx:xx:xx/)
    expect(t).toMatch(/Windows 11 Pro/)
  })
  it('includes them when asked', () => {
    const t = buildReport({ ...input, includeIdentity: true })
    expect(t).toMatch(/PC-SECRET/)
    expect(t).toMatch(/alice/)
  })
  it('formats a diagnosis as copyable text', () => {
    const d = { ...interpretNetwork({ ps: ps(), probes: okProbes }), id: 'x', diagnosisId: 'network' as const, ranAt: 0, durationMs: 1200, errors: [], elevated: false }
    expect(formatDiagnosis(d, 'Internet')).toMatch(/\[OK\]/)
  })
})

describe('PowerShell 5.1 array wrapping', () => {
  it('unwraps {value, Count} arrays', () => {
    const r = interpretHang({ notResponding: [], hangs: { value: [{ app: 'x.exe', count: 2, last: '2026-11-14T10:00:00Z' }], Count: 1 } as never })
    expect(r.findings.find((f) => f.id === 'hangs')?.detail).toMatch(/x.exe/)
  })
})
