// Read-only PowerShell diagnostics. Each script prints one JSON document.
// They only read state: no Set-*, Start-*, Stop-*, Remove-* or registry writes.
// Written for Windows PowerShell 5.1 (the version every Windows 10/11 PC has).
import { AUDIO_TYPE_SCRIPT } from '@shared/repairs'
import type { DiagnosisId } from '@shared/troubleshoot'

// Remove-TypeData: Windows PowerShell 5.1 otherwise serialises some arrays as {"value": [...], "Count": n}.
const HEAD = "$ErrorActionPreference = 'SilentlyContinue'; Remove-TypeData System.Array -ErrorAction SilentlyContinue;"

const NETWORK = `${HEAD}
$cfg = @(Get-NetIPConfiguration | Where-Object { $_.NetAdapter.Status -eq 'Up' } | ForEach-Object {
  [pscustomobject]@{
    alias = $_.InterfaceAlias; description = $_.InterfaceDescription
    ipv4 = @($_.IPv4Address | ForEach-Object { $_.IPAddress })
    gateway = @($_.IPv4DefaultGateway | ForEach-Object { $_.NextHop })
    dns = @($_.DNSServer | Where-Object { $_.AddressFamily -eq 2 } | ForEach-Object { $_.ServerAddresses } | Select-Object -Unique)
    dhcp = [string]$_.NetIPv4Interface.Dhcp
  } })
$adapters = @(Get-NetAdapter | Where-Object { $_.HardwareInterface } | ForEach-Object { [pscustomobject]@{ name = $_.Name; status = [string]$_.Status; desc = $_.InterfaceDescription } })
$gw = @()
foreach ($c in $cfg) { foreach ($g in $c.gateway) { if ($g -and $g -ne '0.0.0.0') { $gw += [pscustomobject]@{ gateway = $g; reachable = [bool](Test-Connection -ComputerName $g -Count 2 -Quiet) } } } }
$publicDns = $null
if ($cfg.Count -gt 0) { try { $null = Resolve-DnsName -Name 'www.microsoft.com' -Server '1.1.1.1' -DnsOnly -QuickTimeout -ErrorAction Stop; $publicDns = $true } catch { $publicDns = $false } }
$ie = Get-ItemProperty 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings'
[pscustomobject]@{ configs = $cfg; adapters = $adapters; gateways = $gw; publicDnsWorks = $publicDns; proxyEnabled = [bool]$ie.ProxyEnable; proxyServer = [string]$ie.ProxyServer; autoConfigUrl = [string]$ie.AutoConfigURL } | ConvertTo-Json -Depth 5 -Compress`

const SLOW = `${HEAD}
$os = Get-CimInstance Win32_OperatingSystem
$first = @{}; foreach ($p in Get-Process) { $t = $p.TotalProcessorTime; if ($t) { $first[$p.Id] = $t.TotalMilliseconds } }
$l1 = (Get-CimInstance Win32_Processor | Measure-Object LoadPercentage -Average).Average
Start-Sleep -Milliseconds 2000
$cores = [Environment]::ProcessorCount
$procs = @(Get-Process | Where-Object { $_.Id -gt 4 } | ForEach-Object {
  $c = 0; $t = $_.TotalProcessorTime
  if ($t -and $first.ContainsKey($_.Id)) { $c = [math]::Round(($t.TotalMilliseconds - $first[$_.Id]) / 20 / $cores, 1) }
  [pscustomobject]@{ pid = $_.Id; name = $_.ProcessName; cpu = $c; memMB = [math]::Round($_.WorkingSet64 / 1MB); responding = $_.Responding; win = ($_.MainWindowHandle -ne 0) } })
$l2 = (Get-CimInstance Win32_Processor | Measure-Object LoadPercentage -Average).Average
$loads = @(@($l1, $l2) | Where-Object { $_ -ne $null })
$cpu = $null; if ($loads.Count) { $cpu = [math]::Round(($loads | Measure-Object -Average).Average) }
$sd = Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='$env:SystemDrive'"
$media = $null
try { $num = (Get-Partition -DriveLetter $env:SystemDrive[0] -ErrorAction Stop | Get-Disk -ErrorAction Stop).Number; $media = [string](Get-PhysicalDisk | Where-Object { $_.DeviceId -eq [string]$num } | Select-Object -First 1).MediaType } catch {}
[pscustomobject]@{
  cpuLoad = $cpu
  memTotalKB = [int64]$os.TotalVisibleMemorySize; memFreeKB = [int64]$os.FreePhysicalMemory
  topCpu = @($procs | Sort-Object cpu -Descending | Select-Object -First 8 pid, name, cpu, memMB)
  topMem = @($procs | Sort-Object memMB -Descending | Select-Object -First 8 pid, name, cpu, memMB)
  notResponding = @($procs | Where-Object { $_.win -and -not $_.responding } | Select-Object pid, name)
  sysDrive = [pscustomobject]@{ id = [string]$sd.DeviceID; size = [int64]$sd.Size; free = [int64]$sd.FreeSpace }
  sysMediaType = $media
  startupCount = @(Get-CimInstance Win32_StartupCommand).Count
  uptimeHours = [math]::Round(((Get-Date) - $os.LastBootUpTime).TotalHours, 1)
  powerPlan = ((powercfg /getactivescheme) -join ' ')
} | ConvertTo-Json -Depth 4 -Compress`

const UPDATE = `${HEAD}
$svc = @(Get-Service wuauserv, bits, cryptsvc, TrustedInstaller, UsoSvc | ForEach-Object { [pscustomobject]@{ name = $_.Name; display = $_.DisplayName; status = [string]$_.Status; startType = [string]$_.StartType } })
$hist = @(); $histErr = $null
try {
  $h = (New-Object -ComObject Microsoft.Update.Session).CreateUpdateSearcher()
  $n = $h.GetTotalHistoryCount()
  if ($n -gt 0) { $hist = @($h.QueryHistory(0, [math]::Min(40, $n)) | Where-Object { $_.Title } | ForEach-Object { [pscustomobject]@{ title = $_.Title; date = $_.Date.ToUniversalTime().ToString('o'); result = [int]$_.ResultCode; hresult = ('0x{0:X8}' -f $_.HResult) } }) }
} catch { $histErr = $_.Exception.Message }
$events = @(Get-WinEvent -FilterHashtable @{ LogName = 'System'; ProviderName = 'Microsoft-Windows-WindowsUpdateClient'; Level = 2; StartTime = (Get-Date).AddDays(-30) } -MaxEvents 20 | ForEach-Object {
  $m = ($_.Message -replace '\\s+', ' '); if ($m.Length -gt 240) { $m = $m.Substring(0, 240) + '...' }
  [pscustomobject]@{ time = $_.TimeCreated.ToUniversalTime().ToString('o'); id = $_.Id; message = $m } })
$reboot = (Test-Path 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\WindowsUpdate\\Auto Update\\RebootRequired') -or (Test-Path 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Component Based Servicing\\RebootPending')
$d = Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='$env:SystemDrive'"
$cache = [int64](Get-ChildItem -LiteralPath (Join-Path $env:SystemRoot 'SoftwareDistribution\\Download') -Recurse -Force -File | Measure-Object Length -Sum).Sum
$hf = Get-HotFix | Where-Object { $_.InstalledOn } | Sort-Object InstalledOn -Descending | Select-Object -First 1
$last = $null; if ($hf) { $last = [pscustomobject]@{ id = $hf.HotFixID; date = $hf.InstalledOn.ToUniversalTime().ToString('o') } }
[pscustomobject]@{ services = $svc; history = $hist; historyError = $histErr; events = $events; rebootPending = [bool]$reboot; freeBytes = [int64]$d.FreeSpace; sizeBytes = [int64]$d.Size; downloadCacheBytes = $cache; lastHotfix = $last; backupExists = (Test-Path (Join-Path $env:SystemRoot 'SoftwareDistribution.nexterm-old')) } | ConvertTo-Json -Depth 5 -Compress`

const SOUND = `${HEAD}
$svc = @(Get-Service Audiosrv, AudioEndpointBuilder | ForEach-Object { [pscustomobject]@{ name = $_.Name; display = $_.DisplayName; status = [string]$_.Status; startType = [string]$_.StartType } })
$dev = @(Get-CimInstance Win32_SoundDevice | ForEach-Object { [pscustomobject]@{ name = $_.Name; status = [string]$_.Status } })
$ep = @(Get-PnpDevice -Class AudioEndpoint -PresentOnly | ForEach-Object { [pscustomobject]@{ name = $_.FriendlyName; status = [string]$_.Status } })
$vol = $null
try {
  $ErrorActionPreference = 'Stop'
  ${AUDIO_TYPE_SCRIPT}
  $vol = [pscustomobject]@{ ok = $true; muted = [NxAudio]::GetMute(); level = [NxAudio]::GetVolume() }
} catch { $vol = [pscustomobject]@{ ok = $false; error = $_.Exception.Message } }
$ErrorActionPreference = 'SilentlyContinue'
[pscustomobject]@{ services = $svc; devices = $dev; endpoints = $ep; volume = $vol } | ConvertTo-Json -Depth 4 -Compress`

const DISK = `${HEAD}
function SizeOf($p) { if ($p -and (Test-Path -LiteralPath $p)) { [int64](Get-ChildItem -LiteralPath $p -Recurse -Force -File | Measure-Object Length -Sum).Sum } else { $null } }
$vols = @(Get-CimInstance Win32_LogicalDisk -Filter 'DriveType=3' | ForEach-Object { [pscustomobject]@{ id = $_.DeviceID; label = [string]$_.VolumeName; size = [int64]$_.Size; free = [int64]$_.FreeSpace } })
$shell = New-Object -ComObject Shell.Application
$dlPath = $null; try { $dlPath = $shell.NameSpace('shell:Downloads').Self.Path } catch {}
if (-not $dlPath) { $dlPath = Join-Path $env:USERPROFILE 'Downloads' }
$rb = $null; try { $rb = [int64]0; foreach ($i in $shell.NameSpace(10).Items()) { $s = $i.ExtendedProperty('Size'); if ($s) { $rb += [int64]$s } } } catch { $rb = $null }
[pscustomobject]@{ volumes = $vols; systemDrive = $env:SystemDrive; tempBytes = (SizeOf $env:TEMP); downloadsBytes = (SizeOf $dlPath); updateCacheBytes = (SizeOf (Join-Path $env:SystemRoot 'SoftwareDistribution\\Download')); recycleBytes = $rb } | ConvertTo-Json -Depth 4 -Compress`

const HANG = `${HEAD}
$nr = @(Get-Process | Where-Object { $_.MainWindowHandle -ne 0 -and -not $_.Responding } | ForEach-Object { [pscustomobject]@{ pid = $_.Id; name = $_.ProcessName; title = $_.MainWindowTitle } })
$since = (Get-Date).AddDays(-7)
function Grp($events, $withModule) { @($events | Group-Object { [string]$_.Properties[0].Value } | Sort-Object Count -Descending | Select-Object -First 10 | ForEach-Object {
  $l = $_.Group | Sort-Object TimeCreated -Descending | Select-Object -First 1
  $when = ''; if ($l -and $l.TimeCreated) { $when = $l.TimeCreated.ToUniversalTime().ToString('o') }
  $mod = ''; if ($withModule -and $l -and $l.Properties.Count -gt 3) { $mod = [string]$l.Properties[3].Value }
  [pscustomobject]@{ app = [string]$_.Name; count = [int]$_.Count; last = $when; module = $mod } }) }
$h = @(Get-WinEvent -FilterHashtable @{ LogName = 'Application'; ProviderName = 'Application Hang'; Id = 1002; StartTime = $since } -MaxEvents 300)
$c = @(Get-WinEvent -FilterHashtable @{ LogName = 'Application'; ProviderName = 'Application Error'; Id = 1000; StartTime = $since } -MaxEvents 300)
$hangs = @(Grp $h $false); $crashes = @(Grp $c $true)
[pscustomobject]@{ notResponding = $nr; hangs = $hangs; crashes = $crashes } | ConvertTo-Json -Depth 4 -Compress`

const STARTUP = `${HEAD}
$approved = @{}
$base = 'Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\StartupApproved'
foreach ($k in @("HKCU:\\$base\\Run", "HKCU:\\$base\\Run32", "HKCU:\\$base\\StartupFolder", "HKLM:\\$base\\Run", "HKLM:\\$base\\Run32", "HKLM:\\$base\\StartupFolder")) {
  $key = Get-Item -LiteralPath $k
  if ($key) { foreach ($n in $key.GetValueNames()) { $b = $key.GetValue($n); if ($b -is [byte[]] -and $b.Length -gt 0) { $approved[$n] = (($b[0] % 2) -eq 0) } } } }
$items = @(Get-CimInstance Win32_StartupCommand | ForEach-Object {
  $en = $true
  foreach ($cand in @($_.Name, "$($_.Name).lnk", [IO.Path]::GetFileName([string]$_.Command))) { if ($cand -and $approved.ContainsKey($cand)) { $en = $approved[$cand]; break } }
  [pscustomobject]@{ name = $_.Name; command = $_.Command; location = $_.Location; enabled = $en } })
$boot = $null; $bootErr = $null
try {
  $e = Get-WinEvent -FilterHashtable @{ LogName = 'Microsoft-Windows-Diagnostics-Performance/Operational'; Id = 100 } -MaxEvents 1 -ErrorAction Stop
  $x = [xml]$e.ToXml(); $boot = [int64](($x.Event.EventData.Data | Where-Object { $_.Name -eq 'BootTime' }).'#text')
} catch { $bootErr = $_.Exception.Message }
$hb = (Get-ItemProperty 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Power').HiberbootEnabled
$fast = $null; if ($hb -ne $null) { $fast = [bool]$hb }
$os = Get-CimInstance Win32_OperatingSystem
[pscustomobject]@{ items = $items; bootMs = $boot; bootError = $bootErr; fastStartup = $fast; uptimeHours = [math]::Round(((Get-Date) - $os.LastBootUpTime).TotalHours, 1) } | ConvertTo-Json -Depth 4 -Compress`

const PRINTER = `${HEAD}
$s = Get-Service Spooler
$sp = $null; if ($s) { $sp = [pscustomobject]@{ name = $s.Name; status = [string]$s.Status; startType = [string]$s.StartType } }
$map = @{ 1 = 'Other'; 2 = 'Unknown'; 3 = 'Idle'; 4 = 'Printing'; 5 = 'Warming up'; 6 = 'Stopped'; 7 = 'Offline' }
$pr = @(); $prErr = $null
try {
  $jobs = @(Get-CimInstance Win32_PrintJob)
  $pr = @(Get-CimInstance Win32_Printer -ErrorAction Stop | ForEach-Object {
    $pn = $_.Name
    $mine = @($jobs | Where-Object { ([string]$_.Name).StartsWith("$pn,") })
    $st = $map[[int]$_.PrinterStatus]; if (-not $st) { $st = [string]$_.PrinterStatus }
    [pscustomobject]@{ name = $pn; status = $st; offline = [bool]($_.WorkOffline -or [int]$_.PrinterStatus -eq 7); isDefault = [bool]$_.Default; port = [string]$_.PortName; jobs = $mine.Count; errorJobs = @($mine | Where-Object { $_.Status -ne 'OK' -or ([string]$_.JobStatus) -match 'Error' }).Count } })
} catch { $prErr = $_.Exception.Message }
[pscustomobject]@{ spooler = $sp; printers = $pr; printersError = $prErr } | ConvertTo-Json -Depth 4 -Compress`

const SERVICES = `${HEAD}
$st = @(Get-CimInstance Win32_Service -Filter "StartMode='Auto' AND State<>'Running'" | ForEach-Object { [pscustomobject]@{ name = $_.Name; display = $_.DisplayName; exitCode = [int64]$_.ExitCode; delayed = [bool]$_.DelayedAutoStart } })
$ev = @(Get-WinEvent -FilterHashtable @{ LogName = 'System'; ProviderName = 'Service Control Manager'; Id = 7000, 7001, 7009, 7011, 7022, 7023, 7024, 7031, 7034; StartTime = (Get-Date).AddDays(-7) } -MaxEvents 300 |
  Group-Object { [string]$_.Properties[0].Value } | Sort-Object Count -Descending | Select-Object -First 15 | ForEach-Object {
    $l = $_.Group | Sort-Object TimeCreated -Descending | Select-Object -First 1
    $m = ($l.Message -replace '\\s+', ' '); if ($m.Length -gt 220) { $m = $m.Substring(0, 220) + '...' }
    [pscustomobject]@{ service = $_.Name; count = $_.Count; last = $l.TimeCreated.ToUniversalTime().ToString('o'); ids = (($_.Group | Select-Object -ExpandProperty Id -Unique) -join ','); message = $m } })
[pscustomobject]@{ stopped = $st; events = $ev } | ConvertTo-Json -Depth 4 -Compress`

/** Lightweight summary for the Health Center (one PowerShell call, run on demand). */
export const HEALTH = `${HEAD}
$err = @(Get-WinEvent -FilterHashtable @{ LogName = 'System', 'Application'; Level = 1, 2; StartTime = (Get-Date).AddHours(-24) } -MaxEvents 500)
$top = @($err | Group-Object ProviderName | Sort-Object Count -Descending | Select-Object -First 5 | ForEach-Object { [pscustomobject]@{ source = $_.Name; count = $_.Count } })
$reboot = (Test-Path 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\WindowsUpdate\\Auto Update\\RebootRequired') -or (Test-Path 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Component Based Servicing\\RebootPending')
$last = $null; $failed = 0; $histErr = $null
try {
  $h = (New-Object -ComObject Microsoft.Update.Session).CreateUpdateSearcher(); $n = $h.GetTotalHistoryCount()
  if ($n -gt 0) {
    $items = @($h.QueryHistory(0, [math]::Min(40, $n)) | Where-Object { $_.Title })
    $ok = $items | Where-Object { $_.ResultCode -eq 2 -or $_.ResultCode -eq 3 } | Sort-Object Date -Descending | Select-Object -First 1
    if ($ok) { $last = [pscustomobject]@{ title = $ok.Title; date = $ok.Date.ToUniversalTime().ToString('o') } }
    $failed = @($items | Where-Object { ($_.ResultCode -eq 4 -or $_.ResultCode -eq 5) -and $_.Date -gt (Get-Date).AddDays(-30) }).Count
  }
} catch { $histErr = $_.Exception.Message }
$wuDisabled = @(Get-Service wuauserv, bits | Where-Object { [string]$_.StartType -eq 'Disabled' }).Count
[pscustomobject]@{ errors24h = $err.Count; topErrorSources = $top; rebootPending = [bool]$reboot; lastUpdate = $last; failedUpdates30d = $failed; historyError = $histErr; startupCount = @(Get-CimInstance Win32_StartupCommand).Count; wuDisabled = $wuDisabled } | ConvertTo-Json -Depth 4 -Compress`

export const DIAGNOSIS_SCRIPTS: Record<Exclude<DiagnosisId, never>, string> = {
  network: NETWORK, slow: SLOW, update: UPDATE, sound: SOUND, disk: DISK, hang: HANG, startup: STARTUP, printer: PRINTER, services: SERVICES
}
