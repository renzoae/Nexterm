import type { CommandDef, ParamSpec, ParamValues } from './types'

// Strict allow-list validators. Values that pass these checks contain no shell
// metacharacters, quotes, whitespace or path separators.
const HOSTNAME = /^(?=.{1,253}$)[A-Za-z0-9](?:[A-Za-z0-9-]{0,62})(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,62}))*\.?$/
const IPV4 = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/
const IPV6 = /^[0-9A-Fa-f:.]{2,45}$/
const DRIVE = /^[A-Za-z]:$/

export function isValidHost(v: string): boolean {
  if (typeof v !== 'string' || v.length === 0 || v.length > 253) return false
  if (IPV4.test(v)) return true
  if (v.includes(':')) return IPV6.test(v) && v.split(':').length >= 3
  return HOSTNAME.test(v)
}

export function isValidPort(v: unknown): boolean {
  return Number.isInteger(v) && (v as number) >= 1 && (v as number) <= 65535
}

export function validateParam(spec: ParamSpec, raw: unknown): { ok: true; value: string | number } | { ok: false; error: string } {
  switch (spec.type) {
    case 'host': {
      const v = typeof raw === 'string' ? raw.trim() : ''
      return isValidHost(v) ? { ok: true, value: v } : { ok: false, error: `${spec.label}: enter a valid host name or IP address` }
    }
    case 'int': {
      const n = typeof raw === 'number' ? raw : typeof raw === 'string' && /^\d+$/.test(raw.trim()) ? Number(raw.trim()) : NaN
      return Number.isInteger(n) && n >= spec.min && n <= spec.max
        ? { ok: true, value: n }
        : { ok: false, error: `${spec.label}: enter a whole number from ${spec.min} to ${spec.max}` }
    }
    case 'drive': {
      const v = typeof raw === 'string' ? raw.trim().toUpperCase() : ''
      return DRIVE.test(v) ? { ok: true, value: v } : { ok: false, error: `${spec.label}: enter a drive letter such as C:` }
    }
    case 'choice': {
      return typeof raw === 'string' && spec.choices.includes(raw)
        ? { ok: true, value: raw }
        : { ok: false, error: `${spec.label}: choose one of ${spec.choices.join(', ')}` }
    }
  }
}

export function validateParams(def: CommandDef, input: unknown): { ok: true; values: ParamValues } | { ok: false; error: string } {
  const values: ParamValues = {}
  const src = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>
  const specs = def.params ?? []
  for (const key of Object.keys(src)) {
    if (!specs.some((s) => s.name === key)) return { ok: false, error: `Unknown parameter: ${key}` }
  }
  for (const spec of specs) {
    const raw = src[spec.name] ?? spec.default
    const r = validateParam(spec, raw)
    if (!r.ok) return r
    values[spec.name] = r.value
  }
  return { ok: true, values }
}

export function defaultParams(def: CommandDef): ParamValues {
  const out: ParamValues = {}
  for (const p of def.params ?? []) if (p.default !== undefined) out[p.name] = p.default
  return out
}

/** Quote a value as a PowerShell single-quoted literal. */
export function psQuote(v: string): string {
  return `'${v.replace(/'/g, "''")}'`
}

const PLACEHOLDER = /\{([a-z][a-zA-Z0-9]*)\}/g

/** Substitute validated values into an argv template. Each template arg stays a single argv element. */
export function substituteArgs(args: string[], values: ParamValues): string[] {
  return args.map((a) => a.replace(PLACEHOLDER, (_m, k: string) => {
    if (!(k in values)) throw new Error(`Missing parameter ${k}`)
    return String(values[k])
  }))
}

/** Substitute validated values into a PowerShell script. Strings become quoted literals, numbers stay bare. */
export function substituteScript(script: string, values: ParamValues): string {
  return script.replace(PLACEHOLDER, (_m, k: string) => {
    if (!(k in values)) throw new Error(`Missing parameter ${k}`)
    const v = values[k]
    return typeof v === 'number' ? String(v) : psQuote(v)
  })
}

/** Human-readable command preview, identical to what the main process executes. */
export function displayCommand(def: CommandDef, values: ParamValues = defaultParams(def)): string {
  const ex = def.exec
  if (ex.kind === 'exe') {
    const args = substituteArgs(ex.args, values).map((a) => (/\s/.test(a) ? `"${a}"` : a))
    return [ex.file.replace(/\.exe$/i, ''), ...args].join(' ')
  }
  if (ex.kind === 'cmd') return ex.line
  return substituteScript(ex.script, values)
}

// SSH profile validation
const SSH_USER = /^[A-Za-z0-9._][A-Za-z0-9._\\-]{0,63}$/
export function isValidSshUser(v: string): boolean {
  return SSH_USER.test(v)
}

const WINGET_ID = /^[A-Za-z0-9][A-Za-z0-9.\-_+]{0,127}$/
export function isValidWingetId(v: string): boolean {
  return WINGET_ID.test(v)
}

const WINGET_QUERY = /^[A-Za-z0-9][A-Za-z0-9 .\-_+]{0,63}$/
export function isValidWingetQuery(v: string): boolean {
  return WINGET_QUERY.test(v)
}

const DISTRO = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/
export function isValidDistroName(v: string): boolean {
  return DISTRO.test(v)
}
