// Text helpers for cleaning process output for display.

// eslint-disable-next-line no-control-regex
const ANSI = /\u001b\[[0-9;?]*[ -/]*[@-~]|\u001b\][^\u0007]*(\u0007|\u001b\\)/g

/**
 * Normalise console output: strip ANSI sequences, apply carriage returns
 * (progress spinners redraw a line with \r) and backspaces, and drop other
 * control characters.
 */
/** Convert PowerShell CLIXML error output (written to stderr by powershell.exe) into plain text. */
export function decodeClixml(text: string): string {
  if (!text.includes('#< CLIXML')) return text
  return text.replace(/#< CLIXML\r?\n?/g, '').replace(/<Objs[^>]*>([\s\S]*?)<\/Objs>/g, (_m, body: string) =>
    [...body.matchAll(/<S S="[^"]*">([\s\S]*?)<\/S>/g)]
      .map((x) => x[1])
      .join('')
      .replace(/_x000D__x000A_/g, '\n')
      .replace(/_x([0-9A-F]{4})_/g, (_n, hex: string) => String.fromCharCode(parseInt(hex, 16)))
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&')
  )
}

export function cleanOutput(text: string): string {
  const noAnsi = decodeClixml(text).replace(ANSI, '')
  const lines = noAnsi.replace(/\r\n/g, '\n').split('\n')
  return lines
    .map((line) => {
      const parts = line.split('\r')
      let out = parts[parts.length - 1]
      for (let i = parts.length - 1; i >= 0; i--) {
        if (parts[i].trim().length) { out = parts[i]; break }
      }
      let res = ''
      for (const ch of out) {
        if (ch === '\b') res = res.slice(0, -1)
        else res += ch
      }
      // eslint-disable-next-line no-control-regex
      return res.replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '')
    })
    .join('\n')
}

/** Detect UTF-16LE output (e.g. from wsl.exe) and decode it; otherwise UTF-8. */
export function decodeOutput(buf: Uint8Array): string {
  if (buf.length >= 4) {
    let zeros = 0
    const sample = Math.min(buf.length, 200)
    for (let i = 1; i < sample; i += 2) if (buf[i] === 0) zeros++
    if (zeros > sample / 4) return new TextDecoder('utf-16le').decode(buf)
  }
  return new TextDecoder('utf-8').decode(buf)
}
