import type { DomainStatus } from '@shared/types'
import { isWindows } from './paths'
import { runPsJson } from './powershell'

let cache: { at: number; value: DomainStatus } | null = null

export async function getDomainStatus(force = false): Promise<DomainStatus> {
  if (!isWindows) return { supported: false, partOfDomain: false, domain: '', workgroup: '', rsatInstalled: false }
  if (!force && cache && Date.now() - cache.at < 60_000) return cache.value
  try {
    const r = await runPsJson<{ PartOfDomain: boolean; Domain: string; Workgroup: string | null; Rsat: boolean }>(
      '$cs = Get-CimInstance Win32_ComputerSystem; [pscustomobject]@{ PartOfDomain = [bool]$cs.PartOfDomain; Domain = [string]$cs.Domain; Workgroup = [string]$cs.Workgroup; Rsat = [bool](Get-Module -ListAvailable -Name ActiveDirectory) } | ConvertTo-Json -Compress'
    )
    const value: DomainStatus = {
      supported: true,
      partOfDomain: !!r.PartOfDomain,
      domain: r.Domain ?? '',
      workgroup: r.Workgroup ?? '',
      rsatInstalled: !!r.Rsat
    }
    cache = { at: Date.now(), value }
    return value
  } catch (e) {
    return { supported: true, partOfDomain: false, domain: '', workgroup: '', rsatInstalled: false, error: (e as Error).message }
  }
}
