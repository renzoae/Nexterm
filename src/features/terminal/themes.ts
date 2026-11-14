import type { ITheme } from '@xterm/xterm'
import type { TerminalThemeId } from '@/stores/settings'

export const TERMINAL_THEMES: Record<TerminalThemeId, { name: string; theme: ITheme }> = {
  nexterm: {
    name: 'NEXTERM Dark',
    theme: {
      background: '#0a101c', foreground: '#dbe4f0', cursor: '#22d3ee', cursorAccent: '#0a101c', selectionBackground: '#22d3ee44',
      black: '#1b2435', red: '#f87171', green: '#4ade80', yellow: '#facc15', blue: '#60a5fa', magenta: '#c084fc', cyan: '#22d3ee', white: '#cbd5e1',
      brightBlack: '#64748b', brightRed: '#fca5a5', brightGreen: '#86efac', brightYellow: '#fde047', brightBlue: '#93c5fd', brightMagenta: '#d8b4fe', brightCyan: '#67e8f9', brightWhite: '#f8fafc'
    }
  },
  campbell: {
    name: 'Campbell',
    theme: {
      background: '#0c0c0c', foreground: '#cccccc', cursor: '#ffffff', selectionBackground: '#ffffff40',
      black: '#0c0c0c', red: '#c50f1f', green: '#13a10e', yellow: '#c19c00', blue: '#0037da', magenta: '#881798', cyan: '#3a96dd', white: '#cccccc',
      brightBlack: '#767676', brightRed: '#e74856', brightGreen: '#16c60c', brightYellow: '#f9f1a5', brightBlue: '#3b78ff', brightMagenta: '#b4009e', brightCyan: '#61d6d6', brightWhite: '#f2f2f2'
    }
  },
  solarized: {
    name: 'Solarized Dark',
    theme: {
      background: '#002b36', foreground: '#839496', cursor: '#93a1a1', selectionBackground: '#073642',
      black: '#073642', red: '#dc322f', green: '#859900', yellow: '#b58900', blue: '#268bd2', magenta: '#d33682', cyan: '#2aa198', white: '#eee8d5',
      brightBlack: '#586e75', brightRed: '#cb4b16', brightGreen: '#586e75', brightYellow: '#657b83', brightBlue: '#839496', brightMagenta: '#6c71c4', brightCyan: '#93a1a1', brightWhite: '#fdf6e3'
    }
  },
  light: {
    name: 'One Light',
    theme: {
      background: '#fafafa', foreground: '#383a42', cursor: '#0284c7', selectionBackground: '#0284c733',
      black: '#383a42', red: '#e45649', green: '#50a14f', yellow: '#c18401', blue: '#4078f2', magenta: '#a626a4', cyan: '#0184bc', white: '#a0a1a7',
      brightBlack: '#696c77', brightRed: '#e45649', brightGreen: '#50a14f', brightYellow: '#c18401', brightBlue: '#4078f2', brightMagenta: '#a626a4', brightCyan: '#0184bc', brightWhite: '#202227'
    }
  }
}
