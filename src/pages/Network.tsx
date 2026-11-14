import { RefreshCw } from 'lucide-react'
import { commandsIn } from '@shared/commands'
import { LaunchGrid } from '@/components/LaunchGrid'
import { ToolList } from '@/components/ToolCard'
import { Badge, Button, Card, ErrorNote, PageHeader, Spinner } from '@/components/ui'
import { useAsync } from '@/hooks/useAsync'

export function NetworkPage() {
  const { data, error, loading, reload } = useAsync(() => window.nexterm.system.network())

  return (
    <div>
      <PageHeader
        title="Network Diagnostics"
        description="Live adapter, DNS and connectivity status, plus network tools."
        actions={<Button onClick={() => void reload()} disabled={loading} icon={loading ? <Spinner /> : <RefreshCw className="h-4 w-4" />}>Refresh</Button>}
      />
      {error && <ErrorNote>{error}</ErrorNote>}
      {data && (
        <>
          <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-3">
            <Card title="Internet" subtitle={`TCP connection to ${data.internet.target}`}>
              <div className="flex items-center gap-2">
                <Badge tone={data.internet.reachable ? 'ok' : 'danger'}>{data.internet.reachable ? 'Reachable' : 'Unreachable'}</Badge>
                {data.internet.latencyMs != null && <span className="text-sm text-fg">{data.internet.latencyMs} ms</span>}
              </div>
            </Card>
            <Card title="DNS resolution" subtitle={`Lookup of ${data.dnsResolution.host}`}>
              <div className="flex items-center gap-2">
                <Badge tone={data.dnsResolution.ok ? 'ok' : 'danger'}>{data.dnsResolution.ok ? 'Working' : 'Failing'}</Badge>
                {data.dnsResolution.ms != null && <span className="text-sm text-fg">{data.dnsResolution.ms} ms</span>}
              </div>
              {!data.dnsResolution.ok && data.internet.reachable && (
                <p className="mt-2 text-xs text-warn">Internet is reachable but names do not resolve. Try “Flush DNS Cache” or check the DNS servers below.</p>
              )}
            </Card>
            <Card title="Default gateway">
              <span className="selectable font-mono text-sm text-fg">{data.defaultGateway || 'None'}</span>
            </Card>
          </div>

          <Card title="Network adapters" className="mb-4">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-muted">
                  <tr className="border-b border-line">
                    <th className="py-2 pr-3 font-medium">Adapter</th><th className="pr-3 font-medium">Status</th><th className="pr-3 font-medium">IPv4</th>
                    <th className="pr-3 font-medium">IPv6</th><th className="pr-3 font-medium">MAC</th><th className="pr-3 font-medium">Type</th><th className="pr-3 font-medium">Speed</th><th className="font-medium">DHCP</th>
                  </tr>
                </thead>
                <tbody className="selectable">
                  {data.adapters.filter((a) => !a.virtual || a.operstate === 'up').map((a) => (
                    <tr key={a.iface + a.mac} className="border-b border-line/60 text-fg">
                      <td className="py-2 pr-3">
                        <div className="font-medium">{a.iface}{a.isDefault && <Badge tone="accent">default</Badge>}</div>
                        {a.name && a.name !== a.iface && <div className="text-[11px] text-muted">{a.name}</div>}
                      </td>
                      <td className="pr-3"><Badge tone={a.operstate === 'up' ? 'ok' : 'neutral'}>{a.operstate}</Badge></td>
                      <td className="pr-3 font-mono">{a.ip4 || '—'}{a.ip4subnet && <span className="text-muted"> / {a.ip4subnet}</span>}</td>
                      <td className="max-w-48 truncate pr-3 font-mono" title={a.ip6}>{a.ip6 || '—'}</td>
                      <td className="pr-3 font-mono">{a.mac || '—'}</td>
                      <td className="pr-3">{a.type}{a.virtual ? ' (virtual)' : ''}</td>
                      <td className="pr-3">{a.speedMbps ? `${a.speedMbps} Mbps` : '—'}</td>
                      <td>{a.dhcp ? 'Yes' : 'No'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card title="DNS servers" className="mb-6">
            {data.dns.length ? (
              <ul className="selectable space-y-1 text-xs">
                {data.dns.map((d) => (
                  <li key={d.iface} className="flex gap-3"><span className="w-48 shrink-0 truncate text-muted">{d.iface}</span><span className="font-mono text-fg">{d.servers.join(', ')}</span></li>
                ))}
              </ul>
            ) : <p className="text-xs text-muted">No DNS servers reported.</p>}
          </Card>
        </>
      )}
      {!data && !error && <Spinner />}
      <LaunchGrid ids={['ncpa', 'firewall']} title="Network settings" />
      <h2 className="mb-3 text-sm font-semibold text-fg">Network tools</h2>
      <ToolList commands={commandsIn('networking')} />
    </div>
  )
}
