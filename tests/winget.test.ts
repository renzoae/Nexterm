import { describe, expect, it } from 'vitest'
import { parseWingetTable } from '@shared/winget'
import { cleanOutput, decodeOutput } from '@shared/text'

const SEARCH = [
  '   - \r   \\ \r   | \r                                                                                                                        ',
  'Name               Id                           Version   Match        Source',
  '---------------------------------------------------------------------------',
  '7-Zip              7zip.7zip                    24.09     Tag: 7zip    winget',
  'NanaZip            M2Team.NanaZip               5.0.1263.0             winget',
  'Visual Studio Code Microsoft.VisualStudioCode   1.95.3                 winget'
].join('\r\n')

const UPGRADE = [
  'Name                 Id                       Version      Available    Source',
  '------------------------------------------------------------------------------',
  'Git                  Git.Git                  2.46.0       2.47.1       winget',
  'PowerShell 7-x64     Microsoft.PowerShell     7.4.5.0      7.4.6.0      winget',
  '2 upgrades available.'
].join('\n')

describe('winget table parser', () => {
  it('parses search output with spinner noise', () => {
    const r = parseWingetTable(SEARCH)
    expect(r).toHaveLength(3)
    expect(r[0]).toMatchObject({ name: '7-Zip', id: '7zip.7zip', version: '24.09', source: 'winget' })
    expect(r[2].id).toBe('Microsoft.VisualStudioCode')
  })

  it('parses upgrade output and stops at the summary line', () => {
    const r = parseWingetTable(UPGRADE)
    expect(r).toEqual([
      { name: 'Git', id: 'Git.Git', version: '2.46.0', available: '2.47.1', source: 'winget' },
      { name: 'PowerShell 7-x64', id: 'Microsoft.PowerShell', version: '7.4.5.0', available: '7.4.6.0', source: 'winget' }
    ])
  })

  it('returns [] for messages without a table', () => {
    expect(parseWingetTable('No package found matching input criteria.')).toEqual([])
  })
})

describe('output cleaning', () => {
  it('strips ANSI and applies carriage returns', () => {
    expect(cleanOutput('\u001b[32mOK\u001b[0m\r\n10%\r50%\r100%\n')).toBe('OK\n100%\n')
  })
  it('decodes UTF-16LE output', () => {
    const buf = new Uint8Array(Buffer.from('Ubuntu\r\nDebian\r\n', 'utf16le'))
    expect(decodeOutput(buf)).toBe('Ubuntu\r\nDebian\r\n')
  })
  it('decodes UTF-8 output', () => {
    expect(decodeOutput(new Uint8Array(Buffer.from('héllo', 'utf8')))).toBe('héllo')
  })
})

describe('CLIXML decoding', () => {
  it('turns PowerShell CLIXML errors into text', async () => {
    const { cleanOutput } = await import('@shared/text')
    const raw = '#< CLIXML\r\n<Objs Version="1.1.0.1" xmlns="http://schemas.microsoft.com/powershell/2004/04"><S S="Error">Import-Module : The module &apos;X&apos; was not found_x000D__x000A_</S><S S="Error">At line:1_x000D__x000A_</S></Objs>'
    expect(cleanOutput(raw)).toBe("Import-Module : The module 'X' was not found\nAt line:1\n")
  })
})
