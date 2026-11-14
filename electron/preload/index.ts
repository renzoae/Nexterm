// Preload runs in a sandboxed, context-isolated world. It exposes a narrow,
// typed API. No Node.js APIs, no generic `invoke(channel)` and no way to run
// arbitrary commands are exposed to the renderer.
import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { CH, type NexTermApi } from '@shared/api'

function subscribe<T extends unknown[]>(channel: string, cb: (...args: T) => void): () => void {
  const listener = (_e: IpcRendererEvent, ...args: unknown[]) => cb(...(args as T))
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

const api: NexTermApi = {
  app: {
    info: () => ipcRenderer.invoke(CH.appInfo),
    setTheme: (theme) => ipcRenderer.invoke(CH.appSetTheme, theme)
  },
  commands: {
    run: (commandId, params) => ipcRenderer.invoke(CH.cmdRun, commandId, params),
    cancel: (runId) => ipcRenderer.invoke(CH.cmdCancel, runId),
    runElevated: (commandId, params) => ipcRenderer.invoke(CH.cmdRunElevated, commandId, params),
    onOutput: (cb) => subscribe(CH.cmdOutput, cb),
    onExit: (cb) => subscribe(CH.cmdExit, cb)
  },
  system: {
    overview: () => ipcRenderer.invoke(CH.sysOverview),
    live: () => ipcRenderer.invoke(CH.sysLive),
    processes: () => ipcRenderer.invoke(CH.sysProcesses),
    network: () => ipcRenderer.invoke(CH.netOverview),
    domain: () => ipcRenderer.invoke(CH.domainStatus),
    devTools: () => ipcRenderer.invoke(CH.devDetect)
  },
  terminal: {
    profiles: () => ipcRenderer.invoke(CH.termProfiles),
    create: (opts) => ipcRenderer.invoke(CH.termCreate, opts),
    write: (id, data) => ipcRenderer.send(CH.termWrite, id, data),
    resize: (id, cols, rows) => ipcRenderer.send(CH.termResize, id, cols, rows),
    kill: (id) => ipcRenderer.send(CH.termKill, id),
    onData: (cb) => subscribe(CH.termData, cb),
    onExit: (cb) => subscribe(CH.termExit, cb)
  },
  launch: {
    tools: () => ipcRenderer.invoke(CH.launchTools),
    tool: (id) => ipcRenderer.invoke(CH.launchTool, id),
    rdp: (host, port) => ipcRenderer.invoke(CH.launchRdp, host, port),
    openExternal: (url) => ipcRenderer.invoke(CH.openExternal, url)
  },
  ssh: {
    list: () => ipcRenderer.invoke(CH.sshList),
    save: (p) => ipcRenderer.invoke(CH.sshSave, p),
    remove: (id) => ipcRenderer.invoke(CH.sshRemove, id),
    history: () => ipcRenderer.invoke(CH.sshHistory),
    pickKey: () => ipcRenderer.invoke(CH.sshPickKey)
  },
  winget: {
    search: (q) => ipcRenderer.invoke(CH.wingetSearch, q),
    installed: () => ipcRenderer.invoke(CH.wingetInstalled),
    upgrades: () => ipcRenderer.invoke(CH.wingetUpgrades),
    action: (action, id) => ipcRenderer.invoke(CH.wingetAction, action, id)
  },
  logs: {
    read: () => ipcRenderer.invoke(CH.logsRead),
    openFolder: () => ipcRenderer.invoke(CH.logsOpenFolder)
  },
  clipboard: {
    read: () => ipcRenderer.invoke(CH.clipRead),
    write: (text) => ipcRenderer.invoke(CH.clipWrite, text)
  }
}

contextBridge.exposeInMainWorld('nexterm', api)
