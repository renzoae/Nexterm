import clsx from 'clsx'
import { AlertTriangle, CheckCircle2, Cpu, Globe, HardDrive, MemoryStick, Monitor, RefreshCw, Rocket, ScrollText, Settings2, ShieldCheck } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Sparkline } from '@/components/Sparkline'
import { Badge, Button, Card, ErrorNote, Meter, PageHeader, Spinner } from '@/components/ui'
import { useAsync } from '@/hooks/useAsync'
import { useLiveMetrics } from '@/hooks/useLiveMetrics'
import { formatBytes, formatUptime, pct } from '@/lib/format'
import { useApp } from '@/stores/app'
import { DASHBOARD_WIDGETS, useSettings, type DashboardWidget } from '@/stores/settings'

const LABEL: Record<DashboardWidget, string> = {
  cpu: 'Processor', memory: 'Memory', network: 'Network', updates: 'Windows Update', errors: 'System errors', disks: 'Storage', startup: 'Startup apps', system: 'Device'
}

type Tone = 'ok' | 'warn' | 'fail' | 'none'

function Tile({ icon, title, tone, value, children, fix, onFix }: { icon: ReactNode; title: string; tone: Tone; value?: ReactNode; children?: ReactNode; fix?: string; onFix?: () => void }) {
  return (
    <Card className={clsx(tone === 'fail' && 'border-danger/40', tone === 'warn' && 'border-warn/40')}>
      <div className="mb-2 flex items-center gap-2">
        {icon}
        <span className="text-sm font-semibold text-fg">{title}</span>
        {tone === 'ok' && <CheckCircle2 className="ml-auto h-4 w-4 text-ok" />}
        {(tone === 'warn' || tone === 'fail') && <AlertTriangle className={clsx('ml-auto h-4 w-4', tone === 'fail' ? 'text-danger' : 'text-warn')} />}
        {value !== undefined && <span className={clsx('font-mono text-lg font-semibold text-fg', tone !== 'none' && 'ml-2')}>{value}</span>}
      </div>
      {children}
      {fix && onFix && (tone === 'warn' || tone === 'fail') && (
        <Button size="sm" variant="primary" className="mt-3" onClick={onFix}>{fix}</Button>
      )}
    </Card>
  )
}

/** Health Center: only actionable information, with a link to the matching guided fix. */
export function Dashboard() {
  const { widgets, toggleWidget } = useSettings()
  const info = useApp((s) => s.info)
  const openProblem = useApp((s) => s.openProblem)
  const [customize, setCustomize] = useState(false)
  const overview = useAsync(() => window.nexterm.system.overview())
  const net = useAsync(() => window.nexterm.system.network())
  const health = useAsync(() => window.nexterm.troubleshoot.health())
  const { live, cpuHistory, memHistory } = useLiveMetrics()
  const o = overview.data
  const h = health.data && !('error' in health.data) ? health.data : null
  const show = (w: DashboardWidget) => widgets.includes(w)
  const primary = net.data?.adapters.find((a) => a.isDefault) ?? net.data?.adapters.find((a) => a.operstate === 'up')
  const memPct = live ? pct(live.memUsed, live.memTotal) : 0
  const sysDisk = o?.disks.find((d) => /^c:?$/i.test(d.mount) || d.mount === '/') ?? o?.disks[0]
  const sysFree = sysDisk ? 100 - pct(sysDisk.used, sysDisk.size) : 100
  const refresh = () => { void overview.reload(); void net.reload(); void health.reload() }

  const attention = [
    live && live.cpuLoad >= 85,
    memPct >= 90,
    net.data && (!net.data.internet.reachable || !net.data.dnsResolution.ok),
    h && (h.failedUpdates30d > 0 || h.wuDisabled > 0 || h.rebootPending),
    sysFree < 10,
    h && h.startupCount > 15
  ].filter(Boolean).length

  return (
    <div>
      <PageHeader
        title="Health Center"
        description={o ? `${o.os.distro} ${o.os.release} · up ${formatUptime(live?.uptimeSec ?? o.uptimeSec)} · ${info?.isAdmin ? 'administrator' : 'standard user'}` : 'Live information from this PC'}
        actions={
          <>
            <Button onClick={refresh} disabled={health.loading || net.loading} icon={health.loading || net.loading ? <Spinner /> : <RefreshCw className="h-4 w-4" />}>Refresh</Button>
            <Button variant="ghost" onClick={() => setCustomize((v) => !v)} icon={<Settings2 className="h-4 w-4" />}>Customize</Button>
          </>
        }
      />
      {customize && (
        <Card className="mb-4" title="Show on Health Center">
          <div className="flex flex-wrap gap-2">
            {DASHBOARD_WIDGETS.map((w) => (
              <label key={w} className="flex cursor-pointer items-center gap-2 rounded-md border border-line px-3 py-1.5 text-sm">
                <input type="checkbox" checked={show(w)} onChange={() => toggleWidget(w)} className="accent-[var(--accent)]" /> {LABEL[w]}
              </label>
            ))}
          </div>
        </Card>
      )}

      <div className={clsx('mb-4 flex items-center gap-3 rounded-lg border px-4 py-3', attention ? 'border-warn/40 bg-warn/10' : 'border-ok/40 bg-ok/10')}>
        {attention ? <AlertTriangle className="h-5 w-5 text-warn" /> : <ShieldCheck className="h-5 w-5 text-ok" />}
        <div className="text-sm text-fg">{health.loading && !h ? 'Checking health…' : attention ? `${attention} thing(s) need attention. Use the buttons below to fix them step by step.` : 'Nothing needs attention right now.'}</div>
      </div>
      {overview.error && <ErrorNote>Could not read system information: {overview.error}</ErrorNote>}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {show('cpu') && (
          <Tile icon={<Cpu className="h-4 w-4 text-accent" />} title="Processor" tone={!live ? 'none' : live.cpuLoad >= 85 ? 'warn' : 'ok'} value={live ? `${live.cpuLoad.toFixed(0)}%` : undefined} fix="Find what is slowing the PC" onFix={() => openProblem('slow')}>
            <Sparkline values={cpuHistory} />
          </Tile>
        )}
        {show('memory') && (
          <Tile icon={<MemoryStick className="h-4 w-4 text-accent" />} title="Memory" tone={!live ? 'none' : memPct >= 90 ? 'fail' : memPct >= 80 ? 'warn' : 'ok'} value={live ? `${memPct}%` : undefined} fix="Find what uses memory" onFix={() => openProblem('slow')}>
            <p className="mb-1 text-xs text-muted">{live ? `${formatBytes(live.memUsed)} of ${formatBytes(live.memTotal)} in use` : '…'}</p>
            <Sparkline values={memHistory} />
          </Tile>
        )}
        {show('network') && (
          <Tile icon={<Globe className="h-4 w-4 text-accent" />} title="Network" tone={!net.data ? 'none' : !net.data.internet.reachable ? 'fail' : !net.data.dnsResolution.ok ? 'fail' : 'ok'} fix="Troubleshoot the connection" onFix={() => openProblem('internet')}>
            {net.data ? (
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                <dt className="text-muted">Internet</dt><dd className="text-fg">{net.data.internet.reachable ? `Online, ${net.data.internet.latencyMs} ms` : 'Offline'}</dd>
                <dt className="text-muted">DNS</dt><dd className="text-fg">{net.data.dnsResolution.ok ? 'Working' : 'Failing'}</dd>
                <dt className="text-muted">Adapter</dt><dd className="truncate text-fg">{primary ? `${primary.iface} · ${primary.ip4 || 'no IPv4'}` : 'None'}</dd>
              </dl>
            ) : net.error ? <p className="text-xs text-danger">{net.error}</p> : <Spinner />}
          </Tile>
        )}
        {show('updates') && (
          <Tile icon={<RefreshCw className="h-4 w-4 text-accent" />} title="Windows Update" tone={!h ? 'none' : h.wuDisabled > 0 || h.failedUpdates30d > 0 ? 'fail' : h.rebootPending ? 'warn' : 'ok'} fix="Troubleshoot Windows Update" onFix={() => openProblem('update')}>
            {h ? (
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                <dt className="text-muted">Last success</dt><dd className="truncate text-fg" title={h.lastUpdate?.title}>{h.lastUpdate ? new Date(h.lastUpdate.date).toLocaleDateString() : h.historyError ? 'Unavailable' : 'None recorded'}</dd>
                <dt className="text-muted">Failed (30 d)</dt><dd className={clsx(h.failedUpdates30d ? 'text-danger' : 'text-fg')}>{h.failedUpdates30d}</dd>
                <dt className="text-muted">Restart</dt><dd className="text-fg">{h.rebootPending ? 'Pending' : 'Not needed'}</dd>
                {h.wuDisabled > 0 && <><dt className="text-muted">Services</dt><dd className="text-danger">Disabled</dd></>}
              </dl>
            ) : health.data && 'error' in health.data ? <p className="text-xs text-muted">{health.data.error}</p> : <Spinner />}
          </Tile>
        )}
        {show('errors') && (
          <Tile icon={<ScrollText className="h-4 w-4 text-accent" />} title="System errors (24 h)" tone={!h ? 'none' : h.errors24h > 50 ? 'warn' : 'ok'} value={h ? h.errors24h : undefined} fix="Check failing services" onFix={() => openProblem('services')}>
            {h ? (
              h.topErrorSources.length ? (
                <ul className="space-y-0.5 text-xs">{h.topErrorSources.map((t) => <li key={t.source} className="flex justify-between gap-2"><span className="truncate text-fg">{t.source}</span><span className="text-muted">{t.count}</span></li>)}</ul>
              ) : <p className="text-xs text-muted">No errors logged.</p>
            ) : !health.data ? <Spinner /> : <p className="text-xs text-muted">{'error' in health.data ? health.data.error : ''}</p>}
          </Tile>
        )}
        {show('startup') && (
          <Tile icon={<Rocket className="h-4 w-4 text-accent" />} title="Startup apps" tone={!h ? 'none' : h.startupCount > 15 ? 'warn' : 'ok'} value={h ? h.startupCount : undefined} fix="Speed up startup" onFix={() => openProblem('startup')}>
            <p className="text-xs text-muted">{health.data && 'error' in health.data ? health.data.error : 'Programs that start when you sign in.'}</p>
          </Tile>
        )}
      </div>

      {show('disks') && (
        <Card className="mt-4" title={<span className="flex items-center gap-2"><HardDrive className="h-4 w-4 text-accent" />Storage</span>}
          actions={sysFree < 15 && <Button size="sm" variant="primary" onClick={() => openProblem('disk')}>Free up space</Button>}>
          {o ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {o.disks.map((d) => (
                <div key={d.mount + d.fs}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="font-medium text-fg">{d.mount || d.fs} <span className="text-muted">{d.type}</span></span>
                    <span className="text-muted">{formatBytes(d.size - d.used)} free of {formatBytes(d.size)}</span>
                  </div>
                  <Meter value={pct(d.used, d.size)} />
                </div>
              ))}
            </div>
          ) : <Spinner />}
        </Card>
      )}

      {show('system') && o && (
        <Card className="mt-4" title={<span className="flex items-center gap-2"><Monitor className="h-4 w-4 text-accent" />Device</span>}>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-xs md:grid-cols-2">
            <div className="flex gap-2"><dt className="w-20 text-muted">Name</dt><dd className="selectable text-fg">{o.hostname}</dd></div>
            <div className="flex gap-2"><dt className="w-20 text-muted">Windows</dt><dd className="text-fg">{o.os.distro} ({o.os.build || o.os.release})</dd></div>
            <div className="flex gap-2"><dt className="w-20 text-muted">Processor</dt><dd className="truncate text-fg">{o.cpu.manufacturer} {o.cpu.brand}</dd></div>
            <div className="flex gap-2"><dt className="w-20 text-muted">Memory</dt><dd className="text-fg">{formatBytes(o.memTotal)}</dd></div>
          </dl>
        </Card>
      )}
      {health.data && 'error' in health.data && info?.isWindows && <p className="mt-3 text-xs text-danger">Health summary failed: {health.data.error}</p>}
      {!info?.isWindows && <p className="mt-3 text-xs text-muted"><Badge>Note</Badge> Update, error and startup checks are available on Windows.</p>}
    </div>
  )
}
