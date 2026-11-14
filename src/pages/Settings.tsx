import { FolderOpen, RefreshCw } from 'lucide-react'
import { DASHBOARD_WIDGETS, useSettings, type TerminalThemeId } from '@/stores/settings'
import { TERMINAL_THEMES } from '@/features/terminal/themes'
import { useProfiles } from '@/features/terminal/TerminalWorkspace'
import { Badge, Button, Card, Field, PageHeader, Spinner, inputCls } from '@/components/ui'
import { useAsync } from '@/hooks/useAsync'
import { useApp } from '@/stores/app'

const FONTS = [
  "'Cascadia Mono', 'Cascadia Code', Consolas, 'Courier New', monospace",
  "'Cascadia Code', Consolas, monospace",
  "Consolas, 'Courier New', monospace",
  "'JetBrains Mono', Consolas, monospace",
  "'Fira Code', Consolas, monospace",
  "'Courier New', monospace"
]

export function SettingsPage() {
  const s = useSettings()
  const info = useApp((x) => x.info)
  const profiles = useProfiles()
  const log = useAsync(() => window.nexterm.logs.read())

  return (
    <div className="max-w-5xl">
      <PageHeader title="Settings" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Appearance & mode">
          <div className="flex flex-col gap-3">
            <Field label="Theme">
              <select className={inputCls} value={s.theme} onChange={(e) => s.set({ theme: e.target.value as 'dark' | 'light' })}>
                <option value="dark">Dark</option><option value="light">Light</option>
              </select>
            </Field>
            <Field label="Mode" hint="Easy Mode shows plain-language explanations and hides advanced pages. Advanced Mode shows commands, the terminal and every page.">
              <select className={inputCls} value={s.mode} onChange={(e) => s.set({ mode: e.target.value as 'easy' | 'advanced' })}>
                <option value="easy">Easy</option><option value="advanced">Advanced</option>
              </select>
            </Field>
            <Field label="Dashboard widgets">
              <div className="flex flex-wrap gap-2">
                {DASHBOARD_WIDGETS.map((w) => (
                  <label key={w} className="flex items-center gap-1.5 text-sm capitalize text-fg">
                    <input type="checkbox" checked={s.widgets.includes(w)} onChange={() => s.toggleWidget(w)} className="accent-[var(--accent)]" />{w}
                  </label>
                ))}
              </div>
            </Field>
          </div>
        </Card>

        <Card title="Terminal">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Default shell">
              <select className={inputCls} value={s.defaultProfile} onChange={(e) => s.set({ defaultProfile: e.target.value })}>
                <option value="">First detected</option>
                {profiles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Field>
            <Field label="Color scheme">
              <select className={inputCls} value={s.terminalTheme} onChange={(e) => s.set({ terminalTheme: e.target.value as TerminalThemeId })}>
                {Object.entries(TERMINAL_THEMES).map(([id, t]) => <option key={id} value={id}>{t.name}</option>)}
              </select>
            </Field>
            <Field label="Font">
              <select className={inputCls} value={s.fontFamily} onChange={(e) => s.set({ fontFamily: e.target.value })}>
                {FONTS.map((f) => <option key={f} value={f}>{f.split(',')[0].replace(/'/g, '')}</option>)}
              </select>
            </Field>
            <Field label={`Font size: ${s.fontSize}px`}>
              <input type="range" min={9} max={28} value={s.fontSize} onChange={(e) => s.set({ fontSize: Number(e.target.value) })} className="accent-[var(--accent)]" />
            </Field>
            <Field label="Cursor">
              <select className={inputCls} value={s.cursorStyle} onChange={(e) => s.set({ cursorStyle: e.target.value as 'block' | 'bar' | 'underline' })}>
                <option value="bar">Bar</option><option value="block">Block</option><option value="underline">Underline</option>
              </select>
            </Field>
            <Field label="Scrollback lines">
              <select className={inputCls} value={s.scrollback} onChange={(e) => s.set({ scrollback: Number(e.target.value) })}>
                {[1000, 5000, 10000, 50000].map((n) => <option key={n} value={n}>{n.toLocaleString()}</option>)}
              </select>
            </Field>
          </div>
        </Card>
      </div>

      <Card
        className="mt-4"
        title="Activity log"
        subtitle="Every command NEXTERM runs, launches and terminal sessions. Output, keystrokes and passwords are never logged."
        actions={
          <>
            <Button size="sm" variant="ghost" onClick={() => void log.reload()} icon={log.loading ? <Spinner className="h-3.5 w-3.5" /> : <RefreshCw className="h-3.5 w-3.5" />}>Refresh</Button>
            <Button size="sm" onClick={() => void window.nexterm.logs.openFolder()} icon={<FolderOpen className="h-3.5 w-3.5" />}>Open folder</Button>
          </>
        }
      >
        <div className="max-h-80 overflow-auto">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-panel text-muted"><tr className="border-b border-line"><th className="py-1.5 font-medium">Time</th><th className="font-medium">Type</th><th className="font-medium">Detail</th><th className="font-medium">Status</th></tr></thead>
            <tbody className="selectable">
              {(log.data ?? []).map((e, i) => (
                <tr key={i} className="border-b border-line/50 text-fg">
                  <td className="py-1 pr-3 whitespace-nowrap text-muted">{new Date(e.ts).toLocaleString()}</td>
                  <td className="pr-3"><Badge>{e.type}</Badge></td>
                  <td className="max-w-xl truncate pr-3 font-mono" title={e.detail}>{e.detail}</td>
                  <td className="whitespace-nowrap text-muted">{e.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {log.data && !log.data.length && <p className="py-3 text-sm text-muted">No activity yet.</p>}
        </div>
      </Card>

      <Card className="mt-4" title="About">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
          <dt className="text-muted">Version</dt><dd className="text-fg">NEXTERM {info?.version}</dd>
          <dt className="text-muted">Electron</dt><dd className="text-fg">{info?.electron}</dd>
          <dt className="text-muted">Platform</dt><dd className="text-fg">{info?.platform}</dd>
          <dt className="text-muted">Privileges</dt><dd className="text-fg">{info?.isAdmin ? 'Administrator' : 'Standard user'}</dd>
          <dt className="text-muted">Data folder</dt><dd className="selectable font-mono text-fg">{info?.userDataPath}</dd>
          <dt className="text-muted">License</dt><dd className="text-fg">MIT: free and open source</dd>
        </dl>
      </Card>
    </div>
  )
}
