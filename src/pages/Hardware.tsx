import { RefreshCw } from 'lucide-react'
import { useMemo, useState } from 'react'
import { commandsIn } from '@shared/commands'
import { Sparkline } from '@/components/Sparkline'
import { ToolList } from '@/components/ToolCard'
import { Badge, Button, Card, ErrorNote, Meter, PageHeader, Spinner, inputCls } from '@/components/ui'
import { useAsync } from '@/hooks/useAsync'
import { useLiveMetrics } from '@/hooks/useLiveMetrics'
import { formatBytes, formatUptime, pct } from '@/lib/format'

export function Hardware() {
  const overview = useAsync(() => window.nexterm.system.overview())
  const [autoRefresh, setAutoRefresh] = useState(false)
  // Listing processes spawns PowerShell on Windows, so it refreshes only on request (or every 10 s if enabled).
  const procs = useAsync(() => window.nexterm.system.processes(), { intervalMs: autoRefresh ? 10000 : undefined })
  const { live, cpuHistory, memHistory } = useLiveMetrics()
  const [filter, setFilter] = useState('')
  const o = overview.data
  const list = useMemo(
    () => (procs.data ?? []).filter((p) => !filter || p.name.toLowerCase().includes(filter.toLowerCase()) || String(p.pid) === filter),
    [procs.data, filter]
  )

  return (
    <div>
      <PageHeader title="Hardware Monitoring" description="Real-time values read from Windows. Nothing on this page is simulated." />
      {overview.error && <ErrorNote>{overview.error}</ErrorNote>}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Processor" subtitle={o ? `${o.cpu.manufacturer} ${o.cpu.brand}` : undefined} actions={live && <span className="font-mono text-lg font-semibold">{live.cpuLoad.toFixed(0)}%</span>}>
          {o && <p className="mb-2 text-xs text-muted">{o.cpu.physicalCores} cores · {o.cpu.cores} threads · {o.cpu.speedGHz} GHz base</p>}
          <Sparkline values={cpuHistory} height={60} />
          {live && (
            <div className="mt-3 grid grid-cols-4 gap-x-3 gap-y-2 md:grid-cols-8">
              {live.cpuPerCore.map((v, i) => (
                <div key={i} title={`Thread ${i}: ${v.toFixed(0)}%`}>
                  <div className="mb-0.5 text-[10px] text-muted">#{i} {v.toFixed(0)}%</div>
                  <Meter value={v} />
                </div>
              ))}
            </div>
          )}
        </Card>
        <Card title="Memory" actions={live && <span className="font-mono text-lg font-semibold">{pct(live.memUsed, live.memTotal)}%</span>}>
          {live && (
            <p className="mb-2 text-xs text-muted">
              {formatBytes(live.memUsed)} in use · {formatBytes(live.memAvailable)} available · {formatBytes(live.memTotal)} total
              {live.swapTotal > 0 && ` · page file ${formatBytes(live.swapUsed)} / ${formatBytes(live.swapTotal)}`}
            </p>
          )}
          <Sparkline values={memHistory} height={60} />
          {o && <p className="mt-3 text-xs text-muted">Uptime: {formatUptime(live?.uptimeSec ?? o.uptimeSec)} · Booted {new Date(o.bootTime).toLocaleString()}</p>}
        </Card>
        <Card title="Graphics">
          {o ? (
            o.gpus.length ? (
              <ul className="space-y-2 text-xs">
                {o.gpus.map((g, i) => (
                  <li key={i} className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-fg">{g.model}</span>
                    {g.vramMB ? <Badge>{formatBytes(g.vramMB * 1024 * 1024, 0)} VRAM</Badge> : null}
                    {g.driver && <span className="text-muted">Driver {g.driver}</span>}
                  </li>
                ))}
              </ul>
            ) : <p className="text-xs text-muted">No graphics controllers reported.</p>
          ) : <Spinner />}
        </Card>
        <Card title="Storage">
          {o ? (
            <div className="space-y-3">
              {o.physicalDisks.map((d, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-medium text-fg">{d.name || d.vendor}</span>
                  <Badge>{d.type || 'Disk'}</Badge>
                  <span className="text-muted">{formatBytes(d.size)}</span>
                  {d.smart && <Badge tone={/ok/i.test(d.smart) ? 'ok' : 'warn'}>SMART: {d.smart}</Badge>}
                </div>
              ))}
              {o.disks.map((d) => (
                <div key={d.mount + d.fs}>
                  <div className="mb-1 flex justify-between text-xs"><span className="text-fg">{d.mount || d.fs}</span><span className="text-muted">{formatBytes(d.used)} / {formatBytes(d.size)}</span></div>
                  <Meter value={pct(d.used, d.size)} />
                </div>
              ))}
            </div>
          ) : <Spinner />}
        </Card>
      </div>

      <Card
        className="mt-4"
        title="Running processes"
        subtitle={autoRefresh ? "Top 60 by CPU, refreshing every 10 seconds" : "Top 60 by CPU. Click refresh to update."}
        actions={
          <>
            <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter by name or PID" className={`${inputCls} h-7 w-48 text-xs`} />
            <label className="flex items-center gap-1 text-xs text-muted"><input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} className="accent-[var(--accent)]" />Auto</label>
            <Button size="sm" variant="ghost" onClick={() => void procs.reload()} icon={<RefreshCw className="h-3.5 w-3.5" />} />
          </>
        }
      >
        {procs.error && <ErrorNote>{procs.error}</ErrorNote>}
        <div className="max-h-96 overflow-auto">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-panel text-muted">
              <tr className="border-b border-line"><th className="py-1.5 font-medium">Name</th><th className="font-medium">PID</th><th className="font-medium">CPU %</th><th className="font-medium">Memory</th><th className="font-medium">User</th></tr>
            </thead>
            <tbody className="selectable font-mono">
              {list.map((p) => (
                <tr key={p.pid} className="border-b border-line/50 text-fg">
                  <td className="py-1 pr-3 font-sans">{p.name}</td><td className="pr-3">{p.pid}</td><td className="pr-3">{p.cpu.toFixed(1)}</td>
                  <td className="pr-3">{formatBytes(p.memRss)}</td><td className="truncate font-sans text-muted">{p.user}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!procs.data && !procs.error && <Spinner />}
        </div>
      </Card>

      <h2 className="mt-6 mb-3 text-sm font-semibold text-fg">Hardware reports</h2>
      <ToolList commands={commandsIn('hardware')} />
    </div>
  )
}
