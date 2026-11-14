import { execFile } from 'node:child_process'
import { homedir } from 'node:os'
import type { DevTool } from '@shared/types'
import { findOnPath, isWindows, resolveSystemOrPath, system32 } from './paths'

interface Probe {
  id: string
  name: string
  file: string
  args: string[]
  system?: boolean
  viaCmd?: boolean
  env?: Record<string, string>
  hint: string
}

const PROBES: Probe[] = [
  { id: 'git', name: 'Git', file: 'git.exe', args: ['--version'], hint: 'winget install --id Git.Git -e' },
  { id: 'node', name: 'Node.js', file: 'node.exe', args: ['--version'], hint: 'winget install --id OpenJS.NodeJS.LTS -e' },
  { id: 'npm', name: 'npm', file: 'npm.cmd', args: ['--version'], viaCmd: true, hint: 'Installed together with Node.js' },
  { id: 'python', name: 'Python', file: 'python.exe', args: ['--version'], hint: 'winget install --id Python.Python.3.13 -e' },
  { id: 'pwsh', name: 'PowerShell 7', file: 'pwsh.exe', args: ['--version'], hint: 'winget install --id Microsoft.PowerShell -e' },
  { id: 'docker', name: 'Docker', file: 'docker.exe', args: ['--version'], hint: 'winget install --id Docker.DockerDesktop -e' },
  { id: 'wsl', name: 'WSL', file: 'wsl.exe', args: ['--version'], system: true, env: { WSL_UTF8: '1' }, hint: 'Run "wsl --install" in an elevated terminal' },
  { id: 'winget', name: 'winget', file: 'winget.exe', args: ['--version'], hint: 'Install "App Installer" from the Microsoft Store' },
  { id: 'code', name: 'VS Code', file: 'code.cmd', args: ['--version'], viaCmd: true, hint: 'winget install --id Microsoft.VisualStudioCode -e' }
]

function probe(p: Probe): Promise<DevTool> {
  const base = { id: p.id, name: p.name, hint: p.hint }
  const path = p.system ? resolveSystemOrPath(p.file, true) : findOnPath(p.file)
  if (!path) return Promise.resolve({ ...base, found: false, version: '' })
  const [file, args] =
    p.viaCmd && isWindows ? [system32('cmd.exe'), ['/d', '/s', '/c', `${p.file.replace(/\.cmd$/, '')} ${p.args.join(' ')}`]] : [path, p.args]
  return new Promise((resolve) => {
    execFile(file, args, { timeout: 8000, windowsHide: true, cwd: homedir(), env: { ...process.env, ...p.env } }, (err, stdout) => {
      const out = stdout?.toString().replace(/\0/g, '').trim() ?? ''
      // A non-zero exit (e.g. the Microsoft Store "python" alias) means the tool is not usable.
      if (err) return resolve({ ...base, found: false, version: '' })
      resolve({ ...base, found: true, version: out.split('\n')[0].trim() })
    })
  })
}

export function detectDevTools(): Promise<DevTool[]> {
  return Promise.all(PROBES.map(probe))
}
