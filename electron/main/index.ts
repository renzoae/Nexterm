import { app, BrowserWindow, nativeTheme, session, shell } from 'electron'
import { join } from 'node:path'
import { registerIpc } from '../ipc/register'
import { cancelAllFor } from '../services/executor'
import { killAllTerminals } from '../terminal/pty-manager'

// Security baseline: every renderer is sandboxed. The only exception is a
// Linux root session started explicitly with --no-sandbox (CI containers),
// where Chromium cannot create its sandbox at all.
const linuxRootNoSandbox = process.platform === 'linux' && process.getuid?.() === 0 && app.commandLine.hasSwitch('no-sandbox')
if (!linuxRootNoSandbox) app.enableSandbox()

if (!app.requestSingleInstanceLock()) {
  app.quit()
}

let mainWindow: BrowserWindow | null = null
const devUrl = process.env.ELECTRON_RENDERER_URL

function createWindow(): void {
  const isWin = process.platform === 'win32'
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 980,
    minHeight: 620,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#0b1220',
    title: 'NEXTERM',
    icon: join(__dirname, '../../assets/icon.png'),
    titleBarStyle: isWin ? 'hidden' : 'default',
    titleBarOverlay: isWin ? { color: '#0b1220', symbolColor: '#cbd5e1', height: 40 } : false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      spellcheck: false
    }
  })

  const wc = mainWindow.webContents
  const wcId = wc.id

  mainWindow.once('ready-to-show', () => mainWindow?.show())

  // No in-app navigation or popups. http(s) links open in the default browser.
  wc.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  wc.on('will-navigate', (e, url) => {
    if (!(devUrl && url.startsWith(devUrl))) e.preventDefault()
  })
  wc.on('will-attach-webview', (e) => e.preventDefault())

  // Clean up child processes owned by this window.
  wc.on('destroyed', () => {
    killAllTerminals(wcId)
    cancelAllFor(wcId)
  })

  if (devUrl) void mainWindow.loadURL(devUrl)
  else void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
}

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  }
})

app.whenReady().then(() => {
  nativeTheme.themeSource = 'dark'
  // Deny every permission request (camera, geolocation, notifications, ...).
  session.defaultSession.setPermissionRequestHandler((_wc, _perm, cb) => cb(false))
  session.defaultSession.setPermissionCheckHandler(() => false)

  registerIpc()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('before-quit', () => {
  killAllTerminals()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
