import clsx from 'clsx'
import { Cpu, Globe, HardDrive, MemoryStick, Monitor, Settings2, SquareTerminal, Zap } from 'lucide-react'
import { useState } from 'react'
import { getCommand } from '@shared/commands'
import { ToolCard } from '@/components/ToolCard'
import { Sparkline } from '@/components/Sparkline'
import { Badge, Button, Card, ErrorNote, Meter, PageHeader, Spinner } from '@/components/ui'
import { openDefaultTerminal } from '@/features/terminal/TerminalWorkspace'
import { useAsync } from '@/hooks/useAsync'
import { useLiveMetrics } from '@/hooks/useLiveMetrics'
import { formatBytes, formatUptime, pct } from '@/lib/format'
import { useApp } from '@/stores/app'
import { DASHBOARD_WIDGETS, useSettings, type DashboardWidget } from '@/stores/settings'

const WIDGET_LABEL: Record<DashboardWidget, string> = {
  system: 'System', cpu: 'CPU', memory: 'Memory', network: 'Network', disks: 'Disks', quick: 'Quick fixes'
}

const QUICK = ['net.flushdns', 'net.ping', 'net.ipconfig-all', 'win.services-failed']

export function Dashboard() {
  const { widgets, toggleWidget, mode } = useSettings()
  const info = useApp((s) => s.info)
  const setPage = useApp((s) => s.setPage)
  const [customize, setCustomize] = useState(false)
  const overview = useAsync(() => window.nexterm.system.overview())
  const net = useAsync(() => window.nexterm.system.network(), { intervalMs: 30000 })
  const { live, cpuHistory, memHistory, error: liveErr } = useLiveMetrics()
  const o = overview.data
  const show = (w: DashboardWidget) => widgets.includes(w)
  const primary = net.data?.adapters.find((a) => a.isDefault) ?? net.data?.adapters.find((a) => a.operstate === 'up')

  return (
    <div>
      <PageHeader
        title={o ? `Hello, ${o.user}` : 'Dashboard'}
        description={o ? `${o.hostname} · ${o.os.distro} ${o.os.release}` : 'Live information read from this computer'}
        actions={
          <>
            {mode === 'advanced' && <Button onClick={() => { setPage('terminal'); void openDefaultTerminal() }} icon={<SquareTerminal className="h-4 w-4" />}>New terminal</Button>}
            <Button variant="ghost" onClick={() => setCustomize((v) => !v)} icon={<Settings2 className="h-4 w-4" />}>Customize</Button>
          </>
        }
      />
      {customize && (
        <Card className="mb-4" title="Dashboard widgets" subtitle="Choose what appears on your dashboard">
          <div className="flex flex-wrap gap-2">
            {DASHBOARD_WIDGETS.map((w) => (
              <label key={w} className="flex cursor-pointer items-center gap-2 rounded-md border border-line px-3 py-1.5 text-sm">
                <input type="checkbox" checked={show(w)} onChange={() => toggleWidget(w)} className="accent-[var(--accent)]" /> {WIDGET_LABEL[w]}
              </label>
            ))}
          </div>
        </Card>
      )}
      {overview.error && <ErrorNote>Could not read system information: {overview.error}</ErrorNote>}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {show('system') && (
          <Card title={<span className="flex items-center gap-2"><Monitor className="h-4 w-4 text-accent" />System</span>}>
            {o ? (
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
                <dt className="text-muted">OS</dt><dd className="truncate text-fg" title={o.os.distro}>{o.os.distro}</dd>
                <dt className="text-muted">Build</dt><dd className="text-fg">{o.os.build || o.os.release} ({o.os.arch})</dd>
                <dt className="text-muted">Uptime</dt><dd className="text-fg">{formatUptime(live?.uptimeSec ?? o.uptimeSec)}</dd>
                <dt className="text-muted">Privileges</dt><dd>{info?.isAdmin ? <Badge tone="warn">Administrator</Badge> : <Badge>Standard user</Badge>}</dd>
              </dl>
            ) : <Spinner />}
          </Card>
        )}
        {show('cpu') && (
          <Card title={<span className="flex items-center gap-2"><Cpu className="h-4 w-4 text-accent" />CPU</span>} actions={live && <span className="font-mono text-lg font-semibold text-fg">{live.cpuLoad.toFixed(0)}%</span>}>
            <p className="mb-2 truncate text-xs text-muted" title={o?.cpu.brand}>{o ? `${o.cpu.manufacturer} ${o.cpu.brand} · ${o.cpu.physicalCores}C/${o.cpu.cores}T` : '…'}</p>
            <Sparkline values={cpuHistory} />
            {liveErr && <p className="text-xs text-danger">{liveErr}</p>}
          </Card>
        )}
        {show('memory') && (
          <Card title={<span className="flex items-center gap-2"><MemoryStick className="h-4 w-4 text-accent" />Memory</span>} actions={live && <span className="font-mono text-lg font-semibold text-fg">{pct(live.memUsed, live.memTotal)}%</span>}>
            <p className="mb-2 text-xs text-muted">{live ? `${formatBytes(live.memUsed)} used of ${formatBytes(live.memTotal)}` : '…'}</p>
            <Sparkline values={memHistory} />
          </Card>
        )}
        {show('network') && (
          <Card
            title={<span className="flex items-center gap-2"><Globe className="h-4 w-4 text-accent" />Network</span>}
            actions={net.data && <Badge tone={net.data.internet.reachable ? 'ok' : 'danger'}>{net.data.internet.reachable ? 'Online' : 'Offline'}</Badge>}
          >
            {net.data ? (
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
                <dt className="text-muted">Adapter</dt><dd className="truncate text-fg">{primary?.iface ?? '—'}</dd>
                <dt className="text-muted">IPv4</dt><dd className="selectable font-mono text-fg">{primary?.ip4 || '—'}</dd>
                <dt className="text-muted">Gateway</dt><dd className="selectable font-mono text-fg">{net.data.defaultGateway || '—'}</dd>
                <dt className="text-muted">Latency</dt><dd className="text-fg">{net.data.internet.latencyMs != null ? `${net.data.internet.latencyMs} ms (TCP to ${net.data.internet.target})` : 'No response'}</dd>
              </dl>
            ) : net.error ? <p className="text-xs text-danger">{net.error}</p> : <Spinner />}
          </Card>
        )}
      </div>

      {show('disks') && (
        <Card className="mt-4" title={<span className="flex items-center gap-2"><HardDrive className="h-4 w-4 text-accent" />Storage</span>}>
          {o ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {o.disks.map((d) => {
                const p = pct(d.used, d.size)
                return (
                  <div key={d.mount + d.fs}>
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="font-medium text-fg">{d.mount || d.fs} <span className="text-muted">{d.type}</span></span>
                      <span className="text-muted">{formatBytes(d.size - d.used)} free of {formatBytes(d.size)}</span>
                    </div>
                    <Meter value={p} />
                  </div>
                )
              })}
              {!o.disks.length && <p className="text-xs text-muted">No volumes reported.</p>}
            </div>
          ) : <Spinner />}
        </Card>
      )}

      {show('quick') && (
        <div className="mt-6">
          <h2 className={clsx('mb-3 flex items-center gap-2 text-sm font-semibold text-fg')}><Zap className="h-4 w-4 text-accent" />Quick fixes &amp; checks</h2>
          <div className="flex flex-col gap-3">
            {QUICK.map((id) => getCommand(id)).filter((c) => !!c).map((c) => <ToolCard key={c.id} cmd={c} />)}
          </div>
        </div>
      )}
    </div>
  )
}
