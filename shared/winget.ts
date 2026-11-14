import type { WingetPackage } from './types'
import { cleanOutput } from './text'

/**
 * Parse winget's fixed-width table output (search / list / upgrade).
 * winget has no stable JSON output in the CLI, so we locate the header row
 * (the line directly above the dashed separator) and slice columns by the
 * header's start positions.
 */
export function parseWingetTable(raw: string): WingetPackage[] {
  const lines = cleanOutput(raw).split('\n')
  const sepIdx = lines.findIndex((l) => /^-{10,}\s*$/.test(l.trim()) && l.trim().length > 10)
  if (sepIdx < 1) return []
  const header = lines[sepIdx - 1]
  const cols: { name: string; start: number }[] = []
  const re = /\S+/g
  let m: RegExpExecArray | null
  while ((m = re.exec(header))) cols.push({ name: m[0].toLowerCase(), start: m.index })
  if (cols.length < 2) return []

  const find = (...names: string[]) => cols.findIndex((c) => names.includes(c.name))
  const iName = 0
  const iId = find('id')
  const iVersion = find('version')
  const iAvail = find('available')
  const iSource = find('source')
  if (iId < 0 || iVersion < 0) return []

  const slice = (line: string, i: number) => {
    const start = cols[i].start
    const end = i + 1 < cols.length ? cols[i + 1].start : line.length
    return line.slice(start, end).trim()
  }

  const out: WingetPackage[] = []
  for (const line of lines.slice(sepIdx + 1)) {
    if (!line.trim()) continue
    if (/^\d+ (upgrades?|packages?) /i.test(line.trim())) break
    if (line.length < cols[iVersion].start) continue
    const pkg: WingetPackage = {
      name: slice(line, iName),
      id: slice(line, iId),
      version: slice(line, iVersion)
    }
    if (iAvail >= 0) pkg.available = slice(line, iAvail)
    if (iSource >= 0) pkg.source = slice(line, iSource)
    if (pkg.id) out.push(pkg)
  }
  return out
}
