import clsx from 'clsx'
import { ArrowDown, ArrowUp, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { SearchAddon } from '@xterm/addon-search'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { useSettings } from '@/stores/settings'
import { useTerminals, type Pane } from '@/stores/terminal'
import { TERMINAL_THEMES } from './themes'

interface Props {
  tabId: string
  pane: Pane
  active: boolean
  visible: boolean
}

/** One xterm.js instance bound to one node-pty session in the main process. */
export function TerminalPane({ tabId, pane, active, visible }: Props) {
  const host = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const searchRef = useRef<SearchAddon | null>(null)
  const ptyId = useRef<string | null>(null)
  const [exited, setExited] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const settings = useSettings()

  // Create terminal + PTY once per pane.
  useEffect(() => {
    const s = useSettings.getState()
    const term = new Terminal({
      fontFamily: s.fontFamily,
      fontSize: s.fontSize,
      cursorStyle: s.cursorStyle,
      cursorBlink: true,
      scrollback: s.scrollback,
      allowProposedApi: true,
      theme: TERMINAL_THEMES[s.terminalTheme].theme
    })
    const fit = new FitAddon()
    const search = new SearchAddon()
    term.loadAddon(fit)
    term.loadAddon(search)
    term.loadAddon(new WebLinksAddon((_e, uri) => void window.nexterm.launch.openExternal(uri)))
    term.open(host.current!)
    termRef.current = term
    fitRef.current = fit
    searchRef.current = search
    try { fit.fit() } catch { /* not visible yet */ }

    let disposed = false
    let gotData = false
    const unData = window.nexterm.terminal.onData((id, data) => {
      if (id !== ptyId.current) return
      term.write(data)
      if (!gotData) {
        gotData = true
        const input = useTerminals.getState().consumeInitialInput(pane.paneId)
        if (input) setTimeout(() => window.nexterm.terminal.write(id, input), 400)
      }
    })
    const unExit = window.nexterm.terminal.onExit((id, code) => {
      if (id !== ptyId.current) return
      setExited(code)
      term.write(`\r\n\x1b[90m[process exited with code ${code}. Press Enter to close this pane]\x1b[0m\r\n`)
      ptyId.current = null
    })

    term.attachCustomKeyEventHandler((ev) => {
      if (ev.type !== 'keydown') return true
      const key = ev.key.toLowerCase()
      if (ev.ctrlKey && ev.shiftKey && key === 'c') {
        const sel = term.getSelection()
        if (sel) void window.nexterm.clipboard.write(sel)
        return false
      }
      if (ev.ctrlKey && ev.shiftKey && key === 'v') {
        void window.nexterm.clipboard.read().then((t) => t && term.paste(t))
        return false
      }
      if (ev.ctrlKey && ev.shiftKey && key === 'f') {
        setSearchOpen(true)
        return false
      }
      // Let app-level shortcuts through.
      if (ev.ctrlKey && ev.shiftKey && ['t', 'w', 'd', 'e'].includes(key)) return false
      if (ev.ctrlKey && key === 'k' && !ev.shiftKey) return false
      return true
    })

    term.onData((d) => {
      if (ptyId.current) window.nexterm.terminal.write(ptyId.current, d)
      else if (d === '\r') useTerminals.getState().closePane(tabId, pane.paneId)
    })
    term.onResize(({ cols, rows }) => {
      if (ptyId.current) window.nexterm.terminal.resize(ptyId.current, cols, rows)
    })
    term.onTitleChange((t) => t && useTerminals.getState().setPaneTitle(pane.paneId, t.slice(0, 60)))

    void window.nexterm.terminal
      .create({ profileId: pane.profileId, sshProfileId: pane.sshProfileId, cols: term.cols, rows: term.rows })
      .then((r) => {
        if (disposed) {
          if (r.id) window.nexterm.terminal.kill(r.id)
          return
        }
        if (!r.ok || !r.id) {
          setError(r.error ?? 'Could not start shell')
          term.write(`\x1b[31m${r.error ?? 'Could not start shell'}\x1b[0m\r\n`)
          return
        }
        ptyId.current = r.id
        if (r.title) useTerminals.getState().setPaneTitle(pane.paneId, r.title)
        window.nexterm.terminal.resize(r.id, term.cols, term.rows)
      })

    const ro = new ResizeObserver(() => {
      if (host.current && host.current.offsetWidth > 0) {
        try { fit.fit() } catch { /* ignore */ }
      }
    })
    ro.observe(host.current!)

    // Right click: copy selection if any, otherwise paste (Windows Terminal behaviour).
    const el = host.current!
    const onContext = (e: MouseEvent) => {
      e.preventDefault()
      const sel = term.getSelection()
      if (sel) {
        void window.nexterm.clipboard.write(sel)
        term.clearSelection()
      } else {
        void window.nexterm.clipboard.read().then((t) => t && term.paste(t))
      }
    }
    el.addEventListener('contextmenu', onContext)

    return () => {
      disposed = true
      el.removeEventListener('contextmenu', onContext)
      ro.disconnect()
      unData()
      unExit()
      if (ptyId.current) window.nexterm.terminal.kill(ptyId.current)
      ptyId.current = null
      term.dispose()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Apply settings changes live.
  useEffect(() => {
    const t = termRef.current
    if (!t) return
    t.options.fontFamily = settings.fontFamily
    t.options.fontSize = settings.fontSize
    t.options.cursorStyle = settings.cursorStyle
    t.options.scrollback = settings.scrollback
    t.options.theme = TERMINAL_THEMES[settings.terminalTheme].theme
    try { fitRef.current?.fit() } catch { /* ignore */ }
  }, [settings.fontFamily, settings.fontSize, settings.cursorStyle, settings.scrollback, settings.terminalTheme])

  useEffect(() => {
    if (visible && active) {
      requestAnimationFrame(() => {
        try { fitRef.current?.fit() } catch { /* ignore */ }
        termRef.current?.focus()
      })
    }
  }, [visible, active])

  const find = (dir: 'next' | 'prev') => {
    if (!query) return
    const opts = { caseSensitive: false, decorations: { matchOverviewRuler: '#22d3ee', activeMatchColorOverviewRuler: '#3b82f6', matchBackground: '#22d3ee55', activeMatchBackground: '#3b82f6aa' } }
    if (dir === 'next') searchRef.current?.findNext(query, opts)
    else searchRef.current?.findPrevious(query, opts)
  }

  const bg = TERMINAL_THEMES[settings.terminalTheme].theme.background
  return (
    <div
      className={clsx('relative h-full w-full', active ? 'ring-1 ring-accent/40 ring-inset' : '')}
      style={{ background: bg }}
      onMouseDown={() => useTerminals.getState().setActive(tabId, pane.paneId)}
    >
      <div ref={host} className="h-full w-full overflow-hidden" />
      {searchOpen && (
        <div className="absolute top-2 right-4 z-10 flex items-center gap-1 rounded-md border border-line bg-panel p-1 shadow-lg">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') find(e.shiftKey ? 'prev' : 'next')
              if (e.key === 'Escape') { setSearchOpen(false); searchRef.current?.clearDecorations(); termRef.current?.focus() }
            }}
            placeholder="Search output"
            className="h-7 w-48 rounded bg-bg px-2 text-xs text-fg focus:outline-none"
          />
          <button className="rounded p-1 text-muted hover:bg-hover hover:text-fg" onClick={() => find('prev')} title="Previous (Shift+Enter)"><ArrowUp className="h-3.5 w-3.5" /></button>
          <button className="rounded p-1 text-muted hover:bg-hover hover:text-fg" onClick={() => find('next')} title="Next (Enter)"><ArrowDown className="h-3.5 w-3.5" /></button>
          <button className="rounded p-1 text-muted hover:bg-hover hover:text-fg" onClick={() => { setSearchOpen(false); searchRef.current?.clearDecorations() }} title="Close (Esc)"><X className="h-3.5 w-3.5" /></button>
        </div>
      )}
      {(error || exited !== null) && <span className="sr-only">{error ?? `exited ${exited}`}</span>}
    </div>
  )
}
