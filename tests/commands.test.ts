import { describe, expect, it } from 'vitest'
import { CATEGORIES, COMMANDS } from '@shared/commands'
import { defaultParams, displayCommand, validateParams } from '@shared/validation'

const PLACEHOLDER = /\{([a-z][a-zA-Z0-9]*)\}/g

function placeholders(c: (typeof COMMANDS)[number]): string[] {
  const src = c.exec.kind === 'exe' ? c.exec.args.join(' ') : c.exec.kind === 'cmd' ? c.exec.line : c.exec.script
  return [...src.matchAll(PLACEHOLDER)].map((m) => m[1])
}

describe('command registry', () => {
  it('has unique ids', () => {
    const ids = COMMANDS.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('uses known categories and covers every category', () => {
    const cats = new Set(CATEGORIES.map((c) => c.id))
    for (const c of COMMANDS) expect(cats.has(c.category)).toBe(true)
    for (const cat of cats) expect(COMMANDS.some((c) => c.category === cat)).toBe(true)
  })

  it.each(COMMANDS.map((c) => [c.id, c] as const))('%s: placeholders match declared params', (_id, c) => {
    const used = new Set(placeholders(c))
    const declared = new Set((c.params ?? []).map((p) => p.name))
    expect([...used].sort()).toEqual([...declared].sort())
  })

  it.each(COMMANDS.map((c) => [c.id, c] as const))('%s: defaults validate and preview renders', (_id, c) => {
    expect(validateParams(c, defaultParams(c)).ok).toBe(true)
    expect(displayCommand(c).length).toBeGreaterThan(0)
  })

  it('never allows parameters on cmd.exe commands', () => {
    for (const c of COMMANDS.filter((x) => x.exec.kind === 'cmd')) expect(c.params ?? []).toHaveLength(0)
  })

  it('has explanations and descriptions for Easy and Advanced modes', () => {
    for (const c of COMMANDS) {
      expect(c.explain.length).toBeGreaterThan(5)
      expect(c.description.length).toBeGreaterThan(5)
    }
  })

  it('marks state-changing tools as non-safe', () => {
    for (const id of ['net.flushdns', 'net.release', 'net.renew', 'net.winsock-reset', 'win.sfc', 'win.restart-explorer']) {
      expect(COMMANDS.find((c) => c.id === id)?.risk).not.toBe('safe')
    }
  })

  it('exe commands do not embed shell operators', () => {
    for (const c of COMMANDS) {
      if (c.exec.kind !== 'exe') continue
      for (const a of c.exec.args) expect(a).not.toMatch(/[&|<>^;`]/)
    }
  })
})
