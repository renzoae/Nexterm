// Text helpers for cleaning process output for display.

// eslint-disable-next-line no-control-regex
const ANSI = /\u001b\[[0-9;?]*[ -/]*[@-~]|\u001b\][^\u0007]*(\u0007|\u001b\\)/g

/**
 * Normalise console output: strip ANSI sequences, apply carriage returns
 * (progress spinners redraw a line with \r) and backspaces, and drop other
 * control characters.
 */
export function cleanOutput(text: string): string {
  const noAnsi = text.replace(ANSI, '')
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
