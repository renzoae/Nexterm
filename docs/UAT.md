# User Acceptance Testing (v0.2.0)

**Test machines**
- **Windows CI**: GitHub Actions `windows-latest` (Windows Server 2025 Datacenter VM, administrator, no audio device, no printer, wired network). Runs on every push via `npm run test:windows` and the UI smoke test.
- **Owner's PC**: Windows 11. Install with the one-line command was verified.
- **Unit fixtures**: realistic broken-machine data for the cases a healthy CI machine cannot reproduce.

A healthy CI machine can prove that checks run and report correctly. It cannot prove repairs fix a broken PC, so those rows are marked as needing real-world confirmation.

---

## Scenario A: No internet connection

| | Result |
|---|---|
| **What works** | On real Windows the workflow ran in the app in about 11 s. It checked the adapter, IP, gateway, internet reachability (TCP), DNS (system resolver and 1.1.1.1), web access (Microsoft NCSI) and proxy, and reported "Your internet connection is working". Unit fixtures confirm the diagnosis for: not connected, DHCP failure (169.254.x.x), router reachable but ISP down, broken DNS server, captive portal, and proxy. |
| **What fails** | Nothing failed. Note: Azure blocks ICMP, so the router "does not answer ping". NEXTERM correctly treats this as normal because the internet works. |
| **Needs permissions** | Diagnosis: none. Renew IP, public DNS, reset DNS, Winsock and TCP/IP reset need admin (elevated window + UAC). Flush DNS does not. |
| **Needs improvement** | Repairs have not yet been run against a genuinely broken network. Wi-Fi signal strength is not yet part of the diagnosis. |

## Scenario B: Computer is slow

| | Result |
|---|---|
| **What works** | On real Windows: CPU 1% (2-second per-process sample), memory 18% of 16 GB, C: 19% free, 3 startup apps, recently restarted → "No performance problem found right now". The result also advises running the check while the PC is slow. Unit fixtures confirm it names the heavy process and offers to end it (never system processes), and flags full memory, a full disk, many startup apps, long uptime, HDD and Power saver. |
| **What fails** | Nothing failed. |
| **Needs permissions** | Diagnosis: none. Ending a process the user owns: none. Ending an elevated process fails with "access denied", which is shown honestly. |
| **Needs improvement** | A single check is a snapshot. Intermittent slowness needs the check to be run at that moment. A background trend would cost resources, so it was deliberately not added. |

## Scenario C: Windows Update fails

| | Result |
|---|---|
| **What works** | On real Windows: update services enabled, update history read through the Windows Update API (2 recent successes, 0 failures), no update errors in the event log, 28 GB free, no pending restart → "Windows Update looks healthy". Unit fixtures confirm error codes are explained (e.g. 0x800F081F → run DISM) and that the matching repairs are offered: DISM, SFC, restart services, reset the cache with a **real rollback** (restore action), and re-enable disabled services. Low space and pending restart are also detected. |
| **What fails** | Nothing failed. |
| **Needs permissions** | Diagnosis: none (the update history COM API works as a standard user). All update repairs need admin. |
| **Needs improvement** | The cache reset and restore should be confirmed on a PC with a genuinely stuck update. CBS.log parsing for feature-update failures is not included. |

## Scenario D: Technician needs device information

| | Result |
|---|---|
| **What works** | Support Report gathers device, Windows build, CPU, RAM, GPUs, disks, storage, network adapters, DNS, internet and DNS status, 24 h error count with top sources, last successful update, failed updates, pending restart, startup count, recent troubleshooting history and the full results of checks run in this session. Copy to clipboard or save as `.md`. The health summary was verified on real Windows (16 errors in 24 h, top source Security-SPP). |
| **What fails** | Nothing failed. |
| **Needs permissions** | None. The report notes whether it was generated as an administrator. |
| **Needs improvement** | No PDF export yet. The installed software list is not included, to keep the report short; it is available in the Software page. |

---

## Other workflows run on real Windows

| Workflow | Real result on CI | Correct? |
|---|---|---|
| No sound | "Windows cannot find any sound hardware" (VM has none) | Yes |
| Printer | "No printer is installed" (only Microsoft Print to PDF) | Yes |
| Services | Found Docker Engine stopped with exit code 1066; offered "Start Docker Engine" | Yes, a real failure |
| Startup | 3 items; boot time "needs administrator rights" | Yes, honest about the missing data |
| Low disk space | Both drives above 15% free; measured Temp at 333 MB | Yes |
| App not responding | No frozen windows. Exposed a PowerShell 5.1 bug, now fixed. | Yes, after the fix |

## How to reproduce

```powershell
npm ci
npm run test:windows        # real diagnostics + commands on this PC
npm run smoke               # opens the app and screenshots every page
```
