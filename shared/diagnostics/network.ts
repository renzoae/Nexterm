import { arr, overallStatus, type ActionRef, type Finding, type Interpretation } from '../troubleshoot'

export interface NetworkRaw {
  ps: {
    configs?: { alias: string; description?: string; ipv4?: string[] | string; gateway?: string[] | string; dns?: string[] | string; dhcp?: string }[] | object
    adapters?: { name: string; status: string; desc?: string }[] | object
    gateways?: { gateway: string; reachable: boolean }[] | object
    publicDnsWorks?: boolean | null
    proxyEnabled?: boolean
    proxyServer?: string
    autoConfigUrl?: string
  } | null
  probes: {
    tcp: { target: string; ok: boolean; ms: number | null }[]
    systemDns: { host: string; ok: boolean; ms: number | null; error?: string }
    ncsi: { ok: boolean; status: number | null; body: string | null; error?: string }
  }
}

type Cfg = { alias: string; description?: string; ipv4: string[]; gateway: string[]; dns: string[]; dhcp?: string }

export function interpretNetwork(raw: NetworkRaw): Interpretation {
  const findings: Finding[] = []
  const actions: ActionRef[] = []
  const advice: string[] = []
  const ps = raw.ps
  const configs: Cfg[] = arr(ps?.configs as Cfg[] | Cfg).map((c) => ({
    ...c, ipv4: arr(c.ipv4 as string[] | string), gateway: arr(c.gateway as string[] | string).filter((g) => g && g !== '0.0.0.0'), dns: arr(c.dns as string[] | string)
  }))
  const adapters = arr(ps?.adapters as { name: string; status: string }[])
  const gateways = arr(ps?.gateways as { gateway: string; reachable: boolean }[])
  const internetOk = raw.probes.tcp.some((t) => t.ok)
  const latency = raw.probes.tcp.find((t) => t.ok)?.ms ?? null
  const dnsOk = raw.probes.systemDns.ok
  const ncsiOk = raw.probes.ncsi.ok
  const primary = configs.find((c) => c.gateway.length) ?? configs[0]

  let headline = ''
  let cause = ''

  // 1. Adapter / link
  if (ps) {
    if (!configs.length) {
      const physical = adapters.map((a) => `${a.name}: ${a.status}`).join(', ')
      findings.push({ id: 'link', status: 'fail', title: 'Not connected to a network', detail: 'No network adapter is connected. Wi-Fi is off or not joined, or the cable is unplugged.', evidence: physical || 'No adapters reported' })
      headline = 'This PC is not connected to any network.'
      cause = 'Wi-Fi is off or not connected, or the network cable is unplugged.'
      actions.push({ kind: 'settings', id: 'wifi', reason: 'Turn Wi-Fi on and pick your network.' })
      actions.push({ kind: 'tool', id: 'ncpa', reason: 'Check whether an adapter is disabled.' })
      advice.push('Check that the network cable is plugged in at both ends, or that the Wi-Fi switch/key is on.')
    } else {
      findings.push({ id: 'link', status: 'ok', title: 'Connected to a network', detail: `Active connection: ${configs.map((c) => c.alias).join(', ')}.` })
    }
  } else {
    findings.push({ id: 'link', status: 'unknown', title: 'Could not read adapter details', detail: 'Windows did not return network configuration.' })
  }

  // 2. IP address / DHCP
  const apipa = configs.filter((c) => c.ipv4.some((ip) => ip.startsWith('169.254.')))
  if (apipa.length) {
    findings.push({ id: 'dhcp', status: 'fail', title: 'No IP address from the router', detail: 'The PC gave itself a temporary 169.254.x.x address, which means the router did not answer (DHCP failed).', evidence: apipa.map((c) => `${c.alias}: ${c.ipv4.join(', ')}`).join('\n') })
    if (!headline) {
      headline = 'Your PC could not get an address from the router.'
      cause = 'The router is not handing out addresses (DHCP), or the PC cannot talk to it.'
    }
    actions.push({ kind: 'repair', id: 'net.renew', reason: 'Ask the router for a new address.' })
    advice.push('Restart your router: unplug it for 30 seconds, then plug it back in.')
  } else if (configs.length) {
    findings.push({ id: 'dhcp', status: 'ok', title: 'IP address assigned', detail: configs.map((c) => `${c.alias}: ${c.ipv4.join(', ') || 'none'}`).join('; ') })
  }

  // 3. Gateway
  if (configs.length && !apipa.length) {
    if (!configs.some((c) => c.gateway.length)) {
      findings.push({ id: 'gateway', status: 'fail', title: 'No router (default gateway)', detail: 'The connection has no default gateway, so traffic cannot leave the local network.' })
      if (!headline) { headline = 'The connection has no route to the internet.'; cause = 'No default gateway is configured.' }
      actions.push({ kind: 'repair', id: 'net.renew', reason: 'Get fresh settings from the router.' })
    } else if (gateways.length && gateways.every((g) => !g.reachable)) {
      findings.push({
        id: 'gateway', status: internetOk ? 'info' : 'fail', title: internetOk ? 'Router does not answer ping' : 'Cannot reach the router',
        detail: internetOk ? 'The router ignores ping, but the internet works, so this is normal for some routers.' : 'The router did not answer. The Wi-Fi signal may be weak or the router may be frozen.',
        evidence: gateways.map((g) => `${g.gateway}: ${g.reachable ? 'reachable' : 'no reply'}`).join('\n')
      })
      if (!internetOk && !headline) {
        headline = 'Your PC cannot reach your router.'
        cause = 'Weak Wi-Fi, a loose cable, or a router that needs a restart.'
        advice.push('Restart your router and move closer to it if you use Wi-Fi.')
      }
    } else if (gateways.length) {
      findings.push({ id: 'gateway', status: 'ok', title: 'Router reachable', detail: gateways.map((g) => g.gateway).join(', ') })
    }
  }

  // 4. Internet (IP level)
  if (internetOk) {
    findings.push({ id: 'internet', status: 'ok', title: 'Internet reachable', detail: `Connected to servers on the internet${latency !== null ? ` in ${latency} ms` : ''}.`, evidence: raw.probes.tcp.map((t) => `${t.target}: ${t.ok ? `${t.ms} ms` : 'failed'}`).join('\n') })
  } else {
    findings.push({ id: 'internet', status: 'fail', title: 'Internet not reachable', detail: 'Could not connect to well-known internet servers.', evidence: raw.probes.tcp.map((t) => `${t.target}: failed`).join('\n') })
    if (!headline) {
      headline = 'Your router is reachable, but the internet is not.'
      cause = 'The problem is most likely the router’s internet connection or your provider (ISP), not this PC.'
      advice.push('Restart your router and modem. If other devices also have no internet, contact your internet provider.')
    }
  }

  // 5. DNS
  const sysDns = raw.probes.systemDns
  if (dnsOk) {
    findings.push({ id: 'dns', status: 'ok', title: 'Website names resolve (DNS)', detail: `Looked up ${sysDns.host} in ${sysDns.ms} ms.`, evidence: primary?.dns.length ? `DNS servers: ${primary.dns.join(', ')}` : undefined })
  } else if (internetOk) {
    const publicWorks = ps?.publicDnsWorks === true
    findings.push({
      id: 'dns', status: 'fail', title: 'Website names do not resolve (DNS)',
      detail: publicWorks
        ? 'Your configured DNS server is not answering, but public DNS works. The DNS server set on this PC or router is the problem.'
        : 'Name lookups fail even though the internet is reachable.',
      evidence: `${sysDns.host}: ${sysDns.error ?? 'failed'}${primary?.dns.length ? `\nDNS servers: ${primary.dns.join(', ')}` : ''}\nPublic DNS (1.1.1.1): ${ps?.publicDnsWorks === true ? 'works' : ps?.publicDnsWorks === false ? 'failed' : 'not tested'}`
    })
    if (!headline) {
      headline = 'The internet works, but website names do not resolve.'
      cause = publicWorks ? 'The DNS server this PC uses is not answering.' : 'DNS lookups are failing or being blocked.'
    }
    actions.push({ kind: 'repair', id: 'net.flushdns', reason: 'Clear cached DNS answers.' })
    if (primary) {
      actions.push({ kind: 'repair', id: 'repair.dns-public', params: { adapter: primary.alias }, label: `Use public DNS on “${primary.alias}”`, reason: 'Switch to Cloudflare and Google DNS, which are reliable.' })
      actions.push({ kind: 'repair', id: 'repair.dns-auto', params: { adapter: primary.alias }, label: `Reset DNS to automatic on “${primary.alias}”`, reason: 'Undo manually entered DNS servers.' })
    }
  } else {
    findings.push({ id: 'dns', status: 'unknown', title: 'DNS not tested', detail: 'DNS cannot be checked while the internet is unreachable.' })
  }

  // 6. Captive portal / web access
  if (internetOk && dnsOk) {
    if (ncsiOk) {
      findings.push({ id: 'web', status: 'ok', title: 'Web access works', detail: 'Microsoft’s connectivity test page loaded correctly.' })
    } else {
      findings.push({ id: 'web', status: 'warn', title: 'Web pages are being intercepted', detail: 'The internet test page returned something unexpected. This usually means a hotel, airport or office Wi-Fi sign-in page.', evidence: raw.probes.ncsi.error ?? `HTTP ${raw.probes.ncsi.status}: ${(raw.probes.ncsi.body ?? '').slice(0, 120)}` })
      if (!headline) { headline = 'You may need to sign in to this Wi-Fi network.'; cause = 'A sign-in page (captive portal) is blocking web traffic.' }
      actions.push({ kind: 'url', url: 'http://www.msftconnecttest.com/redirect', label: 'Open the Wi-Fi sign-in page', reason: 'Most sign-in pages appear when you open any website.' })
    }
  }

  // 7. Proxy
  if (ps?.proxyEnabled) {
    findings.push({ id: 'proxy', status: 'warn', title: 'A proxy server is configured', detail: 'All web traffic goes through a proxy. If it is wrong or unreachable, websites fail.', evidence: `Proxy: ${ps.proxyServer || '(empty)'}${ps.autoConfigUrl ? `\nPAC: ${ps.autoConfigUrl}` : ''}` })
    actions.push({ kind: 'settings', id: 'proxy', reason: 'Check or turn off the proxy if you do not need one.' })
  } else if (ps?.autoConfigUrl) {
    findings.push({ id: 'proxy', status: 'info', title: 'Proxy auto-configuration script set', detail: 'Usually set by a company network.', evidence: ps.autoConfigUrl })
  }

  const status = overallStatus(findings)
  if (status === 'ok') {
    headline = 'Your internet connection is working.'
    cause = 'All checks passed. If one website or app still fails, the problem is probably that site or app.'
    advice.push('If only one site fails, try another browser or check whether the site is down for everyone.')
  }
  if (status === 'problem' && !headline) {
    headline = 'Some network checks need attention.'
    cause = 'See the findings below.'
  }
  if (status === 'problem') {
    if (!actions.some((a) => a.kind === 'repair' && a.id === 'net.flushdns')) actions.push({ kind: 'repair', id: 'net.flushdns', reason: 'A quick, safe first step for many connection problems.' })
    actions.push({ kind: 'repair', id: 'net.winsock-reset', reason: 'Deep repair if nothing else works. Requires a restart.' })
    actions.push({ kind: 'settings', id: 'network-status', reason: 'Windows network settings and network reset.' })
  }
  if (status === 'unknown') {
    headline = 'Network checks could not complete.'
    cause = 'Windows did not return enough information.'
  }
  return { status, headline, cause, findings, actions: dedupe(actions), advice }
}

export function dedupe(actions: ActionRef[]): ActionRef[] {
  const seen = new Set<string>()
  return actions.filter((a) => {
    const key = JSON.stringify(a.kind === 'url' ? a.url : [a.kind, a.id, a.kind === 'repair' ? a.params : null])
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
