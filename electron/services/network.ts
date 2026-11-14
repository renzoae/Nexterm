import { promises as dns } from 'node:dns'
import { readFile } from 'node:fs/promises'
import { Socket } from 'node:net'
import si from 'systeminformation'
import type { NetworkOverview } from '@shared/types'
import { isWindows } from './paths'
import { runPsJson } from './powershell'

function tcpProbe(host: string, port: number, timeoutMs = 3000): Promise<number | null> {
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

async function dnsServers(): Promise<{ iface: string; servers: string[] }[]> {
  if (isWindows) {
    try {
      const r = await runPsJson<{ InterfaceAlias: string; ServerAddresses: string[] | string }[] | { InterfaceAlias: string; ServerAddresses: string[] | string }>(
        "@(Get-DnsClientServerAddress -AddressFamily IPv4,IPv6 | Where-Object { $_.ServerAddresses.Count -gt 0 } | Select-Object InterfaceAlias, ServerAddresses) | ConvertTo-Json -Compress -Depth 3"
      )
      const arr = Array.isArray(r) ? r : [r]
      const merged = new Map<string, string[]>()
      for (const x of arr) {
        const list = Array.isArray(x.ServerAddresses) ? x.ServerAddresses : [x.ServerAddresses]
        merged.set(x.InterfaceAlias, [...(merged.get(x.InterfaceAlias) ?? []), ...list])
      }
      return [...merged].map(([iface, servers]) => ({ iface, servers }))
    } catch {
      return []
    }
  }
  try {
    const txt = await readFile('/etc/resolv.conf', 'utf8')
    const servers = [...txt.matchAll(/^nameserver\s+(\S+)/gm)].map((m) => m[1])
    return servers.length ? [{ iface: 'system', servers }] : []
  } catch {
    return []
  }
}

export async function getNetworkOverview(): Promise<NetworkOverview> {
  const [ifaces, gateway, defIface, dnsList, latency, dnsRes] = await Promise.all([
    si.networkInterfaces().then((x) => (Array.isArray(x) ? x : [x])),
    si.networkGatewayDefault().catch(() => ''),
    si.networkInterfaceDefault().catch(() => ''),
    dnsServers(),
    tcpProbe('1.1.1.1', 443),
    (async () => {
      const start = Date.now()
      try {
        await dns.lookup('www.microsoft.com')
        return { ok: true, ms: Date.now() - start, host: 'www.microsoft.com' }
      } catch {
        return { ok: false, ms: null, host: 'www.microsoft.com' }
      }
    })()
  ])
  return {
    adapters: ifaces
      .filter((i) => !i.internal)
      .map((i) => ({
        iface: i.iface,
        name: i.ifaceName,
        ip4: i.ip4,
        ip4subnet: i.ip4subnet,
        ip6: i.ip6,
        mac: i.mac,
        type: i.type,
        operstate: i.operstate,
        speedMbps: i.speed && i.speed > 0 ? i.speed : null,
        dhcp: !!i.dhcp,
        virtual: !!i.virtual,
        isDefault: i.iface === defIface
      }))
      .sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || Number(b.operstate === 'up') - Number(a.operstate === 'up')),
    defaultGateway: gateway,
    dns: dnsList,
    internet: { reachable: latency !== null, latencyMs: latency, target: '1.1.1.1:443' },
    dnsResolution: dnsRes
  }
}
