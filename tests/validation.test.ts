import { describe, expect, it } from 'vitest'
import { getCommand } from '@shared/commands'
import { displayCommand, isValidHost, isValidSshUser, isValidWingetId, psQuote, substituteArgs, substituteScript, validateParams } from '@shared/validation'

describe('host validation', () => {
  it.each(['1.1.1.1', 'example.com', 'sub.domain.co.uk', 'PC-042', 'localhost', '::1', 'fe80::1', '2001:db8::1'])('accepts %s', (h) => {
    expect(isValidHost(h)).toBe(true)
  })
  it.each([
    '', ' ', 'a b', 'host;calc', 'host&whoami', 'host|dir', '$(whoami)', '`calc`', "it's", '"quoted"', '-n', '../etc', 'a'.repeat(254),
    'host\nnext', 'C:\\Windows', '%TEMP%'
  ])('rejects %j', (h) => {
    expect(isValidHost(h)).toBe(false)
  })
})

describe('command parameter validation', () => {
  const ping = getCommand('net.ping')!

  it('applies defaults', () => {
    const r = validateParams(ping, {})
    expect(r).toEqual({ ok: true, values: { host: '1.1.1.1', count: 4 } })
  })

  it('rejects injection in host', () => {
    const r = validateParams(ping, { host: '8.8.8.8 & del C:\\x' })
    expect(r.ok).toBe(false)
  })

  it('rejects out-of-range integers', () => {
    expect(validateParams(ping, { count: 0 }).ok).toBe(false)
    expect(validateParams(ping, { count: 101 }).ok).toBe(false)
    expect(validateParams(ping, { count: '5; rm' }).ok).toBe(false)
  })

  it('rejects unknown parameters', () => {
    expect(validateParams(ping, { host: '1.1.1.1', extra: 'x' }).ok).toBe(false)
  })

  it('accepts numeric strings for int params', () => {
    expect(validateParams(ping, { count: '10' })).toEqual({ ok: true, values: { host: '1.1.1.1', count: 10 } })
  })

  it('only accepts listed choices', () => {
    const ev = getCommand('win.events')!
    expect(validateParams(ev, { log: 'Security' }).ok).toBe(false)
    expect(validateParams(ev, { log: 'System' }).ok).toBe(true)
  })

  it('normalises drive letters', () => {
    const c = getCommand('win.chkdsk-scan')!
    expect(validateParams(c, { drive: 'd:' })).toEqual({ ok: true, values: { drive: 'D:' } })
    expect(validateParams(c, { drive: 'C:\\' }).ok).toBe(false)
  })
})

describe('argv and script building', () => {
  it('keeps each template arg as a single argv element', () => {
    expect(substituteArgs(['-n', '{count}', '{host}'], { count: 4, host: 'example.com' })).toEqual(['-n', '4', 'example.com'])
  })

  it('quotes strings and leaves numbers bare in PowerShell', () => {
    expect(substituteScript('Test-NetConnection -ComputerName {host} -Port {port}', { host: 'example.com', port: 443 })).toBe(
      "Test-NetConnection -ComputerName 'example.com' -Port 443"
    )
  })

  it('escapes single quotes', () => {
    expect(psQuote("a'b")).toBe("'a''b'")
  })

  it('throws on missing parameters', () => {
    expect(() => substituteArgs(['{host}'], {})).toThrow()
  })

  it('renders a readable preview', () => {
    expect(displayCommand(getCommand('net.ping')!)).toBe('ping -n 4 1.1.1.1')
    expect(displayCommand(getCommand('net.ipconfig-all')!)).toBe('ipconfig /all')
  })
})

describe('other validators', () => {
  it('ssh users', () => {
    expect(isValidSshUser('admin')).toBe(true)
    expect(isValidSshUser('CORP\\jdoe')).toBe(true)
    expect(isValidSshUser('-oProxyCommand=calc')).toBe(false)
    expect(isValidSshUser('a b')).toBe(false)
  })
  it('winget ids', () => {
    expect(isValidWingetId('Microsoft.VisualStudioCode')).toBe(true)
    expect(isValidWingetId('7zip.7zip')).toBe(true)
    expect(isValidWingetId('x && calc')).toBe(false)
    expect(isValidWingetId('--override')).toBe(false)
  })
})
