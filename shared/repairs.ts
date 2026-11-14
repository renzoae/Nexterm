import type { CommandDef } from './types'

// Repair actions offered by guided troubleshooting. Each one is shown with its
// impact, risk, required permissions and rollback before the main process asks
// for confirmation. None of them run automatically.

const AUDIO_TYPE = `if (-not ('NxAudio' -as [type])) { Add-Type -TypeDefinition @'
using System.Runtime.InteropServices;
[Guid("5CDF2C82-841E-4546-9722-0CF74078229A"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IAudioEndpointVolume {
  int f(); int g(); int h(); int i();
  int SetMasterVolumeLevelScalar(float fLevel, System.Guid pguidEventContext);
  int j();
  int GetMasterVolumeLevelScalar(out float pfLevel);
  int k(); int l(); int m(); int n();
  int SetMute([MarshalAs(UnmanagedType.Bool)] bool bMute, System.Guid pguidEventContext);
  int GetMute(out bool pbMute);
}
[Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDevice { int Activate(ref System.Guid id, int clsCtx, int activationParams, out IAudioEndpointVolume aev); }
[Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDeviceEnumerator { int f(); int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice endpoint); }
[ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")] class MMDeviceEnumeratorComObject { }
public class NxAudio {
  static IAudioEndpointVolume Vol() {
    var e = new MMDeviceEnumeratorComObject() as IMMDeviceEnumerator;
    IMMDevice dev = null;
    Marshal.ThrowExceptionForHR(e.GetDefaultAudioEndpoint(0, 1, out dev));
    IAudioEndpointVolume epv = null;
    var iid = typeof(IAudioEndpointVolume).GUID;
    Marshal.ThrowExceptionForHR(dev.Activate(ref iid, 23, 0, out epv));
    return epv;
  }
  public static float GetVolume() { float v = -1; Marshal.ThrowExceptionForHR(Vol().GetMasterVolumeLevelScalar(out v)); return v; }
  public static void SetVolume(float v) { Marshal.ThrowExceptionForHR(Vol().SetMasterVolumeLevelScalar(v, System.Guid.Empty)); }
  public static bool GetMute() { bool m = false; Marshal.ThrowExceptionForHR(Vol().GetMute(out m)); return m; }
  public static void SetMute(bool m) { Marshal.ThrowExceptionForHR(Vol().SetMute(m, System.Guid.Empty)); }
}
'@ }`

/** Exported so the sound diagnosis can read volume and mute state with the same code. */
export const AUDIO_TYPE_SCRIPT = AUDIO_TYPE

const WU_SERVICES = "'wuauserv','bits','cryptsvc'"

export const REPAIRS: CommandDef[] = [
  // ───── Network ─────
  { id: 'repair.ip-reset', name: 'Reset TCP/IP stack', category: 'networking', shells: ['cmd', 'powershell'], admin: true, risk: 'high',
    description: 'Rewrite the TCP/IP registry settings to defaults (netsh int ip reset).',
    explain: 'Resets the core network settings to Windows defaults. Static IP settings are lost. Restart required.',
    exec: { kind: 'exe', file: 'netsh.exe', args: ['int', 'ip', 'reset'], system: true },
    repair: { impact: 'Static IP addresses are removed. You must restart the PC.', rollback: null } },
  { id: 'repair.dns-public', name: 'Use public DNS (Cloudflare + Google)', category: 'networking', shells: ['powershell'], admin: true, risk: 'caution',
    description: 'Set the adapter DNS servers to 1.1.1.1 and 8.8.8.8.',
    explain: 'Switches this connection to reliable public DNS servers so website names resolve again.',
    params: [{ name: 'adapter', label: 'Adapter', type: 'name', kind: 'adapter' }],
    exec: { kind: 'ps', script: "Set-DnsClientServerAddress -InterfaceAlias {adapter} -ServerAddresses ('1.1.1.1','8.8.8.8') -ErrorAction Stop; Clear-DnsClientCache; Get-DnsClientServerAddress -InterfaceAlias {adapter} -AddressFamily IPv4 | Format-List InterfaceAlias, ServerAddresses" },
    repair: { impact: 'Only this adapter’s DNS servers change. Company networks may need their own DNS.', rollback: 'Run “Reset DNS to automatic” to undo.' } },
  { id: 'repair.dns-auto', name: 'Reset DNS to automatic', category: 'networking', shells: ['powershell'], admin: true, risk: 'caution',
    description: 'Remove manually set DNS servers so the adapter uses DNS from the router (DHCP).',
    explain: 'Lets your router choose the DNS servers again.',
    params: [{ name: 'adapter', label: 'Adapter', type: 'name', kind: 'adapter' }],
    exec: { kind: 'ps', script: 'Set-DnsClientServerAddress -InterfaceAlias {adapter} -ResetServerAddresses -ErrorAction Stop; Clear-DnsClientCache; Get-DnsClientServerAddress -InterfaceAlias {adapter} -AddressFamily IPv4 | Format-List InterfaceAlias, ServerAddresses' },
    repair: { impact: 'Manually entered DNS servers on this adapter are removed.', rollback: 'Set the DNS servers again manually or with “Use public DNS”.' } },

  // ───── Performance / processes / storage ─────
  { id: 'repair.proc-stop', name: 'End process', category: 'windows', shells: ['powershell'], admin: false, risk: 'high',
    description: 'Force-close one process by PID (Stop-Process -Force).',
    explain: 'Closes the program immediately. Anything unsaved in it is lost.',
    params: [{ name: 'pid', label: 'Process ID', type: 'int', min: 5, max: 2147483647, default: 0 }],
    exec: { kind: 'ps', script: '$p = Get-Process -Id {pid} -ErrorAction Stop; Stop-Process -Id {pid} -Force -ErrorAction Stop; "Ended $($p.ProcessName) (PID {pid})."' },
    repair: { impact: 'Unsaved work in that program is lost.', rollback: null } },
  { id: 'repair.clear-temp', name: 'Clear temporary files', category: 'windows', shells: ['powershell'], admin: false, risk: 'caution',
    description: 'Delete files older than 24 hours from your user Temp folder. Files in use are skipped.',
    explain: 'Removes leftover temporary files that programs no longer need.',
    exec: { kind: 'ps', script: "$t = $env:TEMP; $before = [int64](Get-ChildItem -LiteralPath $t -Recurse -Force -File -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum; $cut = (Get-Date).AddDays(-1); $n = 0; $skip = 0; Get-ChildItem -LiteralPath $t -Recurse -Force -File -ErrorAction SilentlyContinue | Where-Object { $_.LastWriteTime -lt $cut } | ForEach-Object { try { Remove-Item -LiteralPath $_.FullName -Force -ErrorAction Stop; $n++ } catch { $skip++ } }; Get-ChildItem -LiteralPath $t -Recurse -Force -Directory -ErrorAction SilentlyContinue | Sort-Object { $_.FullName.Length } -Descending | Where-Object { -not (Get-ChildItem -LiteralPath $_.FullName -Force -ErrorAction SilentlyContinue) } | ForEach-Object { Remove-Item -LiteralPath $_.FullName -Force -ErrorAction SilentlyContinue }; $after = [int64](Get-ChildItem -LiteralPath $t -Recurse -Force -File -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum; 'Deleted {0} files, skipped {1} in use. Freed {2:N1} MB.' -f $n, $skip, (($before - $after) / 1MB)" },
    timeoutSec: 600,
    repair: { impact: 'Old temporary files are deleted. Programs recreate what they need.', rollback: null } },
  { id: 'repair.empty-recycle', name: 'Empty Recycle Bin', category: 'windows', shells: ['powershell'], admin: false, risk: 'high',
    description: 'Permanently delete everything in the Recycle Bin (Clear-RecycleBin).',
    explain: 'Permanently deletes the files in your Recycle Bin.',
    exec: { kind: 'ps', script: "Clear-RecycleBin -Force -ErrorAction Stop; 'Recycle Bin emptied.'" },
    timeoutSec: 600,
    repair: { impact: 'Files in the Recycle Bin can no longer be restored.', rollback: null } },

  // ───── Windows Update ─────
  { id: 'repair.wu-restart', name: 'Restart Windows Update services', category: 'windows', shells: ['powershell'], admin: true, risk: 'caution',
    description: 'Restart wuauserv, BITS and Cryptographic Services.',
    explain: 'Restarts the background services Windows Update depends on.',
    exec: { kind: 'ps', script: `foreach ($n in ${WU_SERVICES}) { Restart-Service -Name $n -Force -ErrorAction Continue }; Get-Service ${WU_SERVICES} | Format-Table Status, StartType, Name -AutoSize` },
    repair: { impact: 'Downloads in progress restart. No settings change.', rollback: null } },
  { id: 'repair.wu-enable', name: 'Re-enable Windows Update services', category: 'windows', shells: ['powershell'], admin: true, risk: 'caution',
    description: 'Set disabled Windows Update services back to Manual start and start them.',
    explain: 'Turns the update services back on if something disabled them.',
    exec: { kind: 'ps', script: `foreach ($n in ${WU_SERVICES}) { $s = Get-Service $n -ErrorAction SilentlyContinue; if ($s -and $s.StartType -eq 'Disabled') { Set-Service -Name $n -StartupType Manual; "Set $n to Manual (was Disabled)." } }; foreach ($n in ${WU_SERVICES}) { Start-Service -Name $n -ErrorAction Continue }; Get-Service ${WU_SERVICES} | Format-Table Status, StartType, Name -AutoSize` },
    repair: { impact: 'If a company policy disabled updates, it may disable them again.', rollback: 'Set the services back to Disabled in Services (services.msc).' } },
  { id: 'repair.wu-reset-cache', name: 'Reset Windows Update cache', category: 'windows', shells: ['powershell'], admin: true, risk: 'high',
    description: 'Stop update services, rename SoftwareDistribution to SoftwareDistribution.nexterm-old, start services.',
    explain: 'Gives Windows Update a fresh download folder. Fixes many stuck or corrupt downloads.',
    exec: { kind: 'ps', script: `$ErrorActionPreference = 'Stop'; $sd = Join-Path $env:SystemRoot 'SoftwareDistribution'; $old = "$sd.nexterm-old"; foreach ($n in ${WU_SERVICES}) { Stop-Service -Name $n -Force }; if (Test-Path $old) { Remove-Item -LiteralPath $old -Recurse -Force; 'Removed previous backup.' }; Rename-Item -LiteralPath $sd -NewName 'SoftwareDistribution.nexterm-old'; "Renamed $sd to $old."; foreach ($n in ${WU_SERVICES}) { Start-Service -Name $n }; 'Services restarted. Open Windows Update and check for updates again.'` },
    timeoutSec: 300,
    repair: { impact: 'Update history in Settings is cleared and pending downloads start again.', rollback: 'Run “Restore previous update cache” to undo.' } },
  { id: 'repair.wu-restore-cache', name: 'Restore previous update cache', category: 'windows', shells: ['powershell'], admin: true, risk: 'caution',
    description: 'Undo “Reset Windows Update cache” by restoring SoftwareDistribution.nexterm-old.',
    explain: 'Puts the original update folder back.',
    exec: { kind: 'ps', script: `$ErrorActionPreference = 'Stop'; $sd = Join-Path $env:SystemRoot 'SoftwareDistribution'; $old = "$sd.nexterm-old"; if (-not (Test-Path $old)) { throw 'No backup found. Nothing to restore.' }; foreach ($n in ${WU_SERVICES}) { Stop-Service -Name $n -Force }; if (Test-Path $sd) { Remove-Item -LiteralPath $sd -Recurse -Force }; Rename-Item -LiteralPath $old -NewName 'SoftwareDistribution'; foreach ($n in ${WU_SERVICES}) { Start-Service -Name $n }; 'Previous update cache restored.'` },
    timeoutSec: 300,
    repair: { impact: 'The new update folder is deleted.', rollback: null } },

  // ───── Sound ─────
  { id: 'repair.audio-unmute', name: 'Unmute and set volume to 50%', category: 'hardware', shells: ['powershell'], admin: false, risk: 'caution',
    description: 'Unmute the default playback device and raise the volume to 50% if it is below 10%.',
    explain: 'Turns your sound back on.',
    exec: { kind: 'ps', script: `${AUDIO_TYPE}; [NxAudio]::SetMute($false); if ([NxAudio]::GetVolume() -lt 0.1) { [NxAudio]::SetVolume(0.5) }; 'Muted: {0}. Volume: {1:P0}' -f [NxAudio]::GetMute(), [NxAudio]::GetVolume()` },
    repair: { impact: 'Sound plays from the default speakers or headphones.', rollback: 'Press the mute key or lower the volume.' } },
  { id: 'repair.audio-restart', name: 'Restart audio services', category: 'hardware', shells: ['powershell'], admin: true, risk: 'caution',
    description: 'Restart Windows Audio and Windows Audio Endpoint Builder.',
    explain: 'Restarts the services that play sound.',
    exec: { kind: 'ps', script: "Restart-Service -Name AudioEndpointBuilder -Force -ErrorAction Continue; Start-Service -Name Audiosrv -ErrorAction Continue; Get-Service Audiosrv, AudioEndpointBuilder | Format-Table Status, Name, DisplayName -AutoSize" },
    repair: { impact: 'Sound cuts out for a few seconds.', rollback: null } },

  // ───── Printing ─────
  { id: 'repair.spooler-restart', name: 'Restart Print Spooler', category: 'windows', shells: ['powershell'], admin: true, risk: 'caution',
    description: 'Restart the Print Spooler service.',
    explain: 'Restarts the Windows service that sends jobs to printers.',
    exec: { kind: 'ps', script: 'Set-Service -Name Spooler -StartupType Automatic -ErrorAction Continue; Restart-Service -Name Spooler -Force -ErrorAction Stop; Get-Service Spooler | Format-List Status, StartType, DisplayName' },
    repair: { impact: 'Printing pauses for a few seconds.', rollback: null } },
  { id: 'repair.spooler-clear', name: 'Clear stuck print jobs', category: 'windows', shells: ['powershell'], admin: true, risk: 'high',
    description: 'Stop the spooler, delete all queued jobs in spool\\PRINTERS, start the spooler.',
    explain: 'Deletes every waiting print job so new ones can print.',
    exec: { kind: 'ps', script: "$q = Join-Path $env:SystemRoot 'System32\\spool\\PRINTERS'; Stop-Service -Name Spooler -Force -ErrorAction Stop; $files = @(Get-ChildItem -LiteralPath $q -File -Force -ErrorAction SilentlyContinue); $files | Remove-Item -Force -ErrorAction Continue; Start-Service -Name Spooler -ErrorAction Stop; \"Removed $($files.Count) queued job files. Spooler running.\"" },
    repair: { impact: 'All waiting print jobs are deleted and must be printed again.', rollback: null } },

  // ───── Services ─────
  { id: 'repair.service-start', name: 'Start service', category: 'windows', shells: ['powershell'], admin: true, risk: 'caution',
    description: 'Start one Windows service (Start-Service).',
    explain: 'Starts a service that should be running.',
    params: [{ name: 'service', label: 'Service', type: 'name', kind: 'service' }],
    exec: { kind: 'ps', script: 'Start-Service -Name {service} -ErrorAction Stop; Get-Service -Name {service} | Format-List Status, StartType, Name, DisplayName' },
    repair: { impact: 'The service starts now. If it keeps failing, the cause is usually its own configuration.', rollback: 'Stop it again in Services (services.msc).' } }
]
