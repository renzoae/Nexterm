import { cpus, freemem, hostname, totalmem, uptime, userInfo } from 'node:os'
import si from 'systeminformation'
import type { LiveMetrics, ProcessInfo, SystemOverview } from '@shared/types'

// All values come from the operating system via the `systeminformation`
// library (WMI/CIM and PowerShell on Windows). Nothing here is simulated.

let overviewCache: { at: number; value: SystemOverview } | null = null

export async function getOverview(): Promise<SystemOverview> {
  if (overviewCache && Date.now() - overviewCache.at < 30_000) return overviewCache.value
  const [os, cpu, mem, graphics, fs, layout] = await Promise.all([
    si.osInfo(),
    si.cpu(),
    si.mem(),
    si.graphics().catch(() => ({ controllers: [] as si.Systeminformation.GraphicsControllerData[] })),
    si.fsSize().catch(() => [] as si.Systeminformation.FsSizeData[]),
    si.diskLayout().catch(() => [] as si.Systeminformation.DiskLayoutData[])
  ])
  const t = si.time()
  const value: SystemOverview = {
    hostname: os.hostname || hostname(),
    os: { distro: os.distro, release: os.release, build: os.build, arch: os.arch },
    cpu: { brand: cpu.brand, manufacturer: cpu.manufacturer, physicalCores: cpu.physicalCores, cores: cpu.cores, speedGHz: cpu.speed },
    memTotal: mem.total,
    gpus: graphics.controllers.map((g) => ({ model: g.model, vendor: g.vendor, vramMB: g.vram ?? null, driver: g.driverVersion ?? '' })),
    disks: fs
      .filter((d) => d.size > 0)
      .map((d) => ({ fs: d.fs, mount: d.mount, type: d.type, size: d.size, used: d.used })),
    physicalDisks: layout.map((d) => ({ name: d.name, type: d.type, size: d.size, vendor: d.vendor, smart: d.smartStatus })),
    uptimeSec: Number(t.uptime),
    bootTime: Date.now() - Number(t.uptime) * 1000,
    user: userInfo().username
  }
  overviewCache = { at: Date.now(), value }
  return value
}

// Live CPU/memory come from Node's os module: no child processes, so polling
// costs almost nothing (systeminformation spawns PowerShell for some values).
let prevCpus = cpus()

export async function getLive(): Promise<LiveMetrics> {
  const now = cpus()
  const perCore = now.map((c, i) => {
    const p = prevCpus[i] ?? c
    const idle = c.times.idle - p.times.idle
    const total = Object.values(c.times).reduce((a, b) => a + b, 0) - Object.values(p.times).reduce((a, b) => a + b, 0)
    return total > 0 ? Math.max(0, Math.min(100, 100 - (idle / total) * 100)) : 0
  })
  prevCpus = now
  const total = totalmem()
  const free = freemem()
  return {
    cpuLoad: perCore.length ? perCore.reduce((a, b) => a + b, 0) / perCore.length : 0,
    cpuPerCore: perCore,
    memUsed: total - free,
    memTotal: total,
    memAvailable: free,
    swapUsed: 0,
    swapTotal: 0,
    uptimeSec: uptime(),
    ts: Date.now()
  }
}

export async function getProcesses(): Promise<ProcessInfo[]> {
  const p = await si.processes()
  return p.list
    .map((x) => ({ pid: x.pid, name: x.name, cpu: x.cpu, memRss: x.memRss * 1024, user: x.user }))
    .sort((a, b) => b.cpu - a.cpu || b.memRss - a.memRss)
    .slice(0, 60)
}

