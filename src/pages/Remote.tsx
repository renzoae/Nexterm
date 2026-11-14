import { KeyRound, MonitorSmartphone, Pencil, Plug, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { commandsIn } from '@shared/commands'
import type { SshProfile } from '@shared/types'
import { ToolList } from '@/components/ToolCard'
import { Badge, Button, Card, ErrorNote, Field, InfoNote, PageHeader, inputCls } from '@/components/ui'
import { useAsync } from '@/hooks/useAsync'
import { useApp } from '@/stores/app'
import { useTerminals } from '@/stores/terminal'

type Draft = { id?: string; name: string; host: string; port: string; user: string; keyPath: string }
const EMPTY: Draft = { name: '', host: '', port: '22', user: '', keyPath: '' }

export function Remote() {
  const profiles = useAsync(() => window.nexterm.ssh.list())
  const history = useAsync(() => window.nexterm.ssh.history())
  const [draft, setDraft] = useState<Draft | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [rdp, setRdp] = useState({ host: '', port: '3389' })
  const [rdpMsg, setRdpMsg] = useState<string | null>(null)

  const save = async () => {
    if (!draft) return
    const r = await window.nexterm.ssh.save({
      id: draft.id, name: draft.name, host: draft.host, port: Number(draft.port), user: draft.user, keyPath: draft.keyPath || undefined
    })
    if (!r.ok) return setErr(r.error ?? 'Could not save profile')
    setErr(null)
    setDraft(null)
    void profiles.reload()
  }

  const connect = (p: SshProfile) => {
    useTerminals.getState().openTab({ sshProfileId: p.id, title: `SSH: ${p.name}` })
    useApp.getState().setPage('terminal')
    setTimeout(() => void history.reload(), 500)
  }

  const launchRdp = async () => {
    const port = Number(rdp.port || '3389')
    const r = await window.nexterm.launch.rdp(rdp.host.trim(), port)
    setRdpMsg(r.ok ? `Remote Desktop opened for ${rdp.host}` : r.error ?? 'Failed')
    if (r.ok) void history.reload()
  }

  return (
    <div>
      <PageHeader title="Remote Connections" description="Saved SSH profiles, Remote Desktop and connection history." />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card
          className="xl:col-span-2"
          title="SSH profiles"
          subtitle="Connections open in a terminal tab using the Windows OpenSSH client"
          actions={!draft && <Button variant="primary" size="sm" onClick={() => setDraft({ ...EMPTY })} icon={<Plus className="h-3.5 w-3.5" />}>New profile</Button>}
        >
          <div className="mb-3">
            <InfoNote>Passwords are never saved. SSH asks for them in the terminal, or use a private key file.</InfoNote>
          </div>
          {draft && (
            <div className="mb-4 rounded-md border border-line bg-panel-2 p-3">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <Field label="Name"><input className={inputCls} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Web server" /></Field>
                <Field label="Host"><input className={inputCls} value={draft.host} onChange={(e) => setDraft({ ...draft, host: e.target.value })} placeholder="10.0.0.5" /></Field>
                <Field label="User"><input className={inputCls} value={draft.user} onChange={(e) => setDraft({ ...draft, user: e.target.value })} placeholder="admin" /></Field>
                <Field label="Port"><input className={inputCls} value={draft.port} onChange={(e) => setDraft({ ...draft, port: e.target.value.replace(/\D/g, '') })} /></Field>
              </div>
              <div className="mt-3 flex items-end gap-2">
                <Field label="Private key (optional)">
                  <input className={`${inputCls} w-96`} value={draft.keyPath} readOnly placeholder="No key selected" />
                </Field>
                <Button onClick={async () => { const k = await window.nexterm.ssh.pickKey(); if (k) setDraft({ ...draft, keyPath: k }) }} icon={<KeyRound className="h-4 w-4" />}>Choose key</Button>
                {draft.keyPath && <Button variant="ghost" onClick={() => setDraft({ ...draft, keyPath: '' })}>Remove key</Button>}
              </div>
              {err && <div className="mt-3"><ErrorNote>{err}</ErrorNote></div>}
              <div className="mt-3 flex gap-2">
                <Button variant="primary" onClick={() => void save()}>Save profile</Button>
                <Button variant="ghost" onClick={() => { setDraft(null); setErr(null) }}>Cancel</Button>
              </div>
            </div>
          )}
          {profiles.data?.length ? (
            <ul className="divide-y divide-line">
              {profiles.data.map((p) => (
                <li key={p.id} className="flex items-center gap-3 py-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-fg">{p.name}</div>
                    <div className="font-mono text-xs text-muted">{p.user}@{p.host}:{p.port}{p.keyPath && ' · key auth'}</div>
                  </div>
                  <Button size="sm" variant="primary" onClick={() => connect(p)} icon={<Plug className="h-3.5 w-3.5" />}>Connect</Button>
                  <Button size="sm" variant="ghost" onClick={() => setDraft({ id: p.id, name: p.name, host: p.host, port: String(p.port), user: p.user, keyPath: p.keyPath ?? '' })} icon={<Pencil className="h-3.5 w-3.5" />} />
                  <Button size="sm" variant="ghost" onClick={async () => { await window.nexterm.ssh.remove(p.id); void profiles.reload() }} icon={<Trash2 className="h-3.5 w-3.5" />} />
                </li>
              ))}
            </ul>
          ) : !draft && <p className="text-sm text-muted">No saved profiles yet.</p>}
        </Card>

        <div className="flex flex-col gap-4">
          <Card title={<span className="flex items-center gap-2"><MonitorSmartphone className="h-4 w-4 text-accent" />Remote Desktop</span>} subtitle="Launches the Windows Remote Desktop client (mstsc)">
            <div className="flex items-end gap-2">
              <Field label="Computer"><input className={`${inputCls} w-40`} value={rdp.host} onChange={(e) => setRdp({ ...rdp, host: e.target.value })} placeholder="PC-042 or 10.0.0.8" onKeyDown={(e) => e.key === 'Enter' && void launchRdp()} /></Field>
              <Field label="Port"><input className={`${inputCls} w-20`} value={rdp.port} onChange={(e) => setRdp({ ...rdp, port: e.target.value.replace(/\D/g, '') })} /></Field>
              <Button variant="primary" onClick={() => void launchRdp()} disabled={!rdp.host.trim()}>Connect</Button>
            </div>
            {rdpMsg && <p className="mt-2 text-xs text-muted">{rdpMsg}</p>}
          </Card>
          <Card title="Connection history">
            {history.data?.length ? (
              <ul className="space-y-1.5 text-xs">
                {history.data.slice(0, 15).map((h, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <Badge tone={h.type === 'ssh' ? 'accent' : 'neutral'}>{h.type.toUpperCase()}</Badge>
                    <span className="selectable truncate font-mono text-fg">{h.target}</span>
                    <span className="ml-auto shrink-0 text-muted">{new Date(h.ts).toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="text-xs text-muted">No connections yet.</p>}
          </Card>
        </div>
      </div>
      <h2 className="mt-6 mb-3 text-sm font-semibold text-fg">Remote support checks</h2>
      <ToolList commands={commandsIn('remote')} />
    </div>
  )
}
