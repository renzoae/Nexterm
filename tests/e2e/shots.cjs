// Smoke test: boots the built app, visits every page and saves screenshots.
// Usage: npm run build && electron tests/e2e/shots.cjs <outDir>
const { app } = require('electron')
if (process.getuid && process.getuid() === 0) app.commandLine.appendSwitch('no-sandbox') // CI containers run as root
const { mkdirSync, writeFileSync } = require('node:fs')
const { join } = require('node:path')
const out = process.argv[process.argv.length - 1]
mkdirSync(out, { recursive: true })
const pages = ['Dashboard', 'IT Support Toolkit', 'Network Diagnostics', 'Windows Troubleshooting', 'Hardware Monitoring', 'Users & Permissions', 'Remote Connections', 'Software Management', 'AI Assistant', 'Settings']
const advanced = ['Terminal', 'Active Directory', 'Developer Workspace', 'Command Library']
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const errors = []
app.on('browser-window-created', (_e, win) => {
  win.webContents.on('console-message', (e) => { if (e.level === 'error') errors.push(e.message) })
  win.webContents.once('did-finish-load', async () => {
    const wc = win.webContents
    const click = (label) => wc.executeJavaScript(`(() => { const b=[...document.querySelectorAll('aside nav button')].find(x=>x.textContent.trim()===${JSON.stringify(label)}); if(b){b.click(); return true} return false })()`)
    const shot = async (name) => { await sleep(2500); const img = await wc.capturePage(); writeFileSync(join(out, name + '.png'), img.toPNG()) }
    await sleep(3000)
    for (const p of pages) { await click(p); await shot('easy-' + p.replace(/\W+/g, '_')) }
    await wc.executeJavaScript(`[...document.querySelectorAll('[role=radio]')].find(b=>b.textContent==='advanced').click()`)
    for (const p of [...advanced, 'Dashboard', 'Network Diagnostics']) { await click(p); await shot('adv-' + p.replace(/\W+/g, '_')) }
    await wc.executeJavaScript(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'k',ctrlKey:true,bubbles:true}))`)
    await shot('adv-palette')
    await wc.executeJavaScript(`document.querySelector('input[placeholder^="Type a page"]').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`)
    await wc.executeJavaScript(`document.querySelector('button[title="Toggle theme"]').click()`)
    await click('Hardware Monitoring'); await shot('light-hardware')
    writeFileSync(join(out, 'console-errors.txt'), errors.join('\n'))
    app.quit()
  })
})
require('../../out/main/index.js')
