// Runs only on Windows (CI: windows-latest). Executes every read-only diagnosis
// and every safe library command for real, and records the results as JSON so
// the feature audit is based on actual Windows behaviour.
import { execFile } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { COMMANDS } from '@shared/commands'
import { REPAIRS } from '@shared/repairs'
import type { Diagnosis, DiagnosisId } from '@shared/troubleshoot'
import { decodeOutput } from '@shared/text'
import { defaultParams, substituteArgs, substituteScript } from '@shared/validation'
import { healthSummary, runDiagnosis } from '../../electron/services/diagnostics/runner'
import { DIAGNOSIS_SCRIPTS } from '../../electron/services/diagnostics/scripts'
import { powershellPath, resolveSystemOrPath, system32 } from '../../electron/services/paths'
import { encodePs, psTextArgs } from '../../electron/services/powershell'

const OUT = join(process.cwd(), 'audit-output')
mkdirSync(OUT, { recursive: true })
const diagnoses: Record<string, Diagnosis> = {}
const commands: { id: string; ok: boolean; exitCode: number | null; ms: number; note: string; head: string }[] = []

function run(file: string, args: string[], timeoutMs: number, env?: Record<string, string>): Promise<{ code: number | null; out: string; ms: number }> {
  const start = Date.now()
  return new Promise((resolve) => {
    execFile(file, args, { timeout: timeoutMs, windowsHide: true, cwd: homedir(), encoding: 'buffer', maxBuffer: 64 * 1024 * 1024, env: { ...process.env, ...env } }, (err, stdout, stderr) => {
      const out = decodeOutput(stdout as Buffer) + decodeOutput(stderr as Buffer)
      const code = err ? (typeof (err as NodeJS.ErrnoException & { code?: unknown }).code === 'number' ? ((err as unknown as { code: number }).code) : null) : 0
      resolve({ code, out, ms: Date.now() - start })
    })
  })
}

afterAll(() => {
  writeFileSync(join(OUT, 'diagnoses.json'), JSON.stringify(diagnoses, null, 2))
  writeFileSync(join(OUT, 'commands.json'), JSON.stringify(commands, null, 2))
  // Also print a readable summary into the CI log.
  const lines: string[] = ['', '===== NEXTERM real-Windows results =====']
  for (const [id, d] of Object.entries(diagnoses)) {
    if (!d || !('findings' in d)) { lines.push(`[${id}] ${JSON.stringify(d).slice(0, 600)}`); continue }
    lines.push(`[${id}] ${d.status.toUpperCase()} in ${d.durationMs} ms: ${d.headline}`, `    cause: ${d.cause}`)
    for (const f of d.findings) lines.push(`    ${f.status.padEnd(7)} ${f.title} | ${f.detail.slice(0, 160)}`)
    lines.push(`    actions: ${d.actions.map((a) => (a.kind === 'url' ? a.label : `${a.kind}:${a.id}`)).join(', ')}`)
    if (d.errors.length) lines.push(`    ERRORS: ${d.errors.join(' | ')}`)
  }
  lines.push('', '----- commands -----')
  for (const c of commands) lines.push(`${c.ok ? 'OK  ' : 'FAIL'} ${c.id.padEnd(28)} exit=${c.exitCode} ${c.ms}ms ${c.note} | ${c.head.split('\n').find((l) => l.trim())?.slice(0, 110) ?? ''}`)
  console.log(lines.join('\n'))
})

describe.skipIf(process.platform !== 'win32')('real Windows', () => {
  describe('PowerShell scripts parse', () => {
    const scripts: [string, string][] = [
      ...Object.entries(DIAGNOSIS_SCRIPTS).map(([k, v]) => [`diagnosis:${k}`, v] as [string, string]),
      ...REPAIRS.filter((r) => r.exec.kind === 'ps').map((r) => [`repair:${r.id}`, substituteScript((r.exec as { script: string }).script, Object.fromEntries((r.params ?? []).map((p) => [p.name, p.type === 'int' ? 1234 : 'Wi-Fi'])))] as [string, string]),
      ...COMMANDS.filter((c) => c.exec.kind === 'ps').map((c) => [`command:${c.id}`, substituteScript((c.exec as { script: string }).script, defaultParams(c))] as [string, string])
    ]
    it.each(scripts)('%s', async (_name, script) => {
      const check = `$e = $null; $t = $null; [void][System.Management.Automation.Language.Parser]::ParseInput([Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${Buffer.from(script, 'utf8').toString('base64')}')), [ref]$t, [ref]$e); if ($e.Count) { $e | ForEach-Object { $_.Message }; exit 1 }`
      const r = await run(powershellPath(), ['-NoProfile', '-NonInteractive', '-EncodedCommand', encodePs(check)], 60_000)
      expect(r.out.trim(), r.out).toBe('')
      expect(r.code).toBe(0)
    })
  })

  describe('diagnoses run on real Windows', () => {
    const ids: DiagnosisId[] = ['network', 'slow', 'update', 'sound', 'disk', 'hang', 'startup', 'printer', 'services']
    it.each(ids)('%s', async (id) => {
      const d = await runDiagnosis(id)
      diagnoses[id] = d
      expect(d.errors, d.errors.join('\n')).toEqual([])
      expect(d.findings.length).toBeGreaterThan(0)
      expect(d.headline.length).toBeGreaterThan(5)
    }, 240_000)

    it('health summary', async () => {
      const h = await healthSummary()
      diagnoses['health'] = h as unknown as Diagnosis
      expect('error' in h ? h.error : '').toBe('')
    }, 120_000)
  })

  describe('safe library commands run', () => {
    const safe = COMMANDS.filter((c) => c.risk === 'safe' && !c.longRunning)
    it.each(safe.map((c) => [c.id, c] as const))('%s', async (_id, c) => {
      if (c.requires === 'domain' || c.requires === 'rsat') {
        // The app checks domain membership/RSAT before running these; CI runners are not domain-joined.
        const dom = await run(powershellPath(), ['-NoProfile', '-Command', '(Get-CimInstance Win32_ComputerSystem).PartOfDomain'], 30_000)
        if (!/true/i.test(dom.out)) { commands.push({ id: c.id, ok: true, exitCode: null, ms: 0, note: 'skipped: not domain-joined', head: '' }); return }
      }
      const values = defaultParams(c)
      let file: string | null
      let args: string[]
      if (c.exec.kind === 'exe') {
        file = resolveSystemOrPath(c.exec.file, c.exec.system, c.exec.subdir)
        args = substituteArgs(c.exec.args, values)
      } else if (c.exec.kind === 'cmd') {
        file = system32('cmd.exe'); args = ['/d', '/s', '/c', c.exec.line]
      } else {
        file = powershellPath(); args = psTextArgs(substituteScript(c.exec.script, values))
      }
      if (!file) {
        commands.push({ id: c.id, ok: false, exitCode: null, ms: 0, note: `executable not found (${c.exec.kind === 'exe' ? c.exec.file : ''})`, head: '' })
        return
      }
      const r = await run(file, args, (c.timeoutSec ?? 60) * 1000, c.exec.kind === 'exe' ? c.exec.env : undefined)
      const broken = /is not recognized as the name|ParserError|Unexpected token|Missing closing/i.test(r.out)
      commands.push({ id: c.id, ok: r.code === 0 && !broken, exitCode: r.code, ms: r.ms, note: broken ? 'script error' : '', head: r.out.trim().split(/\r?\n/).slice(0, 8).join('\n').slice(0, 600) })
      expect(broken, r.out.slice(0, 800)).toBe(false)
    }, 180_000)
  })
})
