# NEXTERM Feature Audit (v0.2.0)

Every page and control, classified by what it really does. The evidence column explains how each item was checked.

**Classifications**
- **Functional**: performs a real operation and shows real results.
- **Partial**: works, with a stated limitation.
- **Needs dependency**: works only when a tool, permission or environment is present. NEXTERM detects this and says so.
- **Unsupported**: not available on that Windows edition or version.
- **Not implemented**: planned. It is shown as planned, never as a working control.

**Evidence**
- **Windows CI**: run for real on GitHub's Windows Server 2025 runner (`npm run test:windows`) for every push. It covers 63 PowerShell scripts parsed by the real PowerShell parser, 9 diagnoses, the health summary and 75 library commands.
- **Windows UI**: the built Electron app was launched on Windows CI, and these workflows were opened in the real UI: Internet, Slow PC, Windows Update, Low disk space.
- **User**: verified by the project owner on a Windows 11 PC.
- **Unit**: interpreter logic tested with realistic fixtures (`tests/diagnostics.test.ts`).
- **Unverified**: not yet run on real Windows. Treat with care.

## Guided troubleshooting (new)

| Feature | Status | Evidence | Notes |
|---|---|---|---|
| Internet not working / DNS | Functional | Windows CI + Windows UI + Unit | Covers adapters, DHCP (169.254), gateway, TCP to 1.1.1.1/8.8.8.8, system DNS and public DNS, captive portal (Microsoft NCSI) and proxy. A router that ignores ping is treated as normal when the internet works. |
| Computer running slowly | Functional | Windows CI + Windows UI + Unit | 2-second per-process CPU sample, memory, free space, disk type, startup count, uptime and power plan. Never offers to end protected system processes. |
| Windows Update failing | Functional | Windows CI + Windows UI + Unit | Update service start types, update history via the Windows Update COM API with HRESULT explanations, event log errors, free space and pending restart. |
| No sound | Functional | Windows CI + Unit | Reads real mute and volume through the Core Audio API. On CI (no audio hardware) it correctly reports "no sound hardware / no default device". |
| Low disk space | Functional | Windows CI + Windows UI + Unit | Sizes of Temp, Recycle Bin, Downloads and the update cache are measured, not estimated. |
| App not responding | Functional | Windows CI + Unit | Frozen windows plus hang/crash events (IDs 1002/1000) from the last 7 days with the faulting module. A PowerShell 5.1 empty-result bug was found and fixed on real Windows. |
| Startup takes too long | Partial | Windows CI + Unit | Startup items and enabled/disabled state are read from the registry. Boot duration needs administrator rights; without them NEXTERM says so instead of guessing. |
| Printer not working | Functional | Windows CI + Unit | Spooler, printers, offline state and queued or errored jobs. CI correctly reported "only virtual printers". |
| Windows service failing | Functional | Windows CI + Unit | Separates real failures from services that stop normally (exit 0/1077). On CI it found a real failure (Docker Engine, exit 1066). |
| Verification after a fix | Functional | Unit + UI | Re-runs every check and compares before and after. NEXTERM only says "Verified" when the checks pass. |
| Copy results / history | Functional | UI | History is stored locally in `troubleshoot-history.json`. |

## Repair actions (all require confirmation in a native dialog)

| Repair | Status | Admin | Rollback | Evidence |
|---|---|---|---|---|
| Flush DNS, renew IP, Winsock reset, TCP/IP reset | Functional | renew/reset: yes | None (stated) | Script parse on Windows CI; not executed on CI (would disconnect the runner) |
| Use public DNS / Reset DNS to automatic | Functional | Yes | Yes: each undoes the other | Parse on Windows CI · **Unverified execution** |
| End process | Functional | No | None (stated) | Parse on Windows CI · **Unverified execution** |
| Clear temporary files | Functional | No | None (stated) | Parse on Windows CI · **Unverified execution** |
| Empty Recycle Bin | Functional | No | None (stated) | Parse on Windows CI · **Unverified execution** |
| Restart / re-enable Windows Update services | Functional | Yes | Re-enable: manual (stated) | Parse on Windows CI · **Unverified execution** |
| Reset / restore Windows Update cache | Functional | Yes | Yes (restore action) | Parse on Windows CI · **Unverified execution** |
| Unmute and set volume, restart audio | Functional | Unmute: no | Unmute: manual | Parse on Windows CI · **Unverified execution** |
| Restart spooler, clear print queue | Functional | Yes | Queue clear: none (stated) | Parse on Windows CI · **Unverified execution** |
| Start service | Functional | Yes | Stop it again (stated) | Parse on Windows CI · **Unverified execution** |

Repairs are deliberately **not** executed by automated tests, because they change the machine. They are built from the same validated templates as the commands that do run on CI. Their first real executions should be watched, and results reported in an issue.

## Other pages

| Page / feature | Status | Evidence | Notes |
|---|---|---|---|
| Health Center | Functional | Windows CI (health summary) + UI | CPU and RAM come from the OS every 3 s and pause while the window is hidden. Update status, 24 h errors and startup count load on demand. |
| Windows Settings search | Functional | Unit | 60 settings pages. Only `ms-settings:` and `windowsdefender:` URIs from the catalog can be opened. |
| Support Report | Functional | Unit + UI | Identifying details (computer name, user name, full MAC and IPv6 addresses) are hidden by default. No credentials are collected. |
| Favorites | Functional | UI | Star any tool; favorites appear on Fix a Problem. |
| Terminal (PowerShell, PowerShell 7, CMD, WSL, Git Bash, SSH) | Functional | User (install) + Linux UI | Loaded only when first opened. Windows PowerShell no longer inherits PowerShell 7's module path. |
| IT Support Toolkit / Command Library | Functional | Windows CI: 66 of 75 safe commands succeed | The 9 that fail on CI fail for environmental reasons that NEXTERM reports correctly: ICMP blocked (ping), no Wi-Fi (wlan), no winget on Server, no WSL distribution, no `.gitconfig`, Docker engine stopped. |
| Admin tools when not elevated | Functional | Unit | Open a visible elevated window after a UAC prompt. Output appears in that window, and verification is done by re-checking. |
| winget (search, install, update, uninstall) | Needs dependency | Unverified on CI | winget is not installed on Windows Server runners. It works on standard Windows 10/11 with App Installer. |
| Active Directory tools | Needs dependency | Windows CI (skipped: not domain-joined) | Requires a domain-joined PC. Account lookup also requires RSAT. |
| BitLocker, Secure Boot, TPM | Needs dependency | Windows CI | Require admin. On the VM they report "not present", which is a correct result. |
| Wi-Fi status | Needs dependency | Windows CI | Requires a Wi-Fi adapter (the WLAN service). |
| Remote Desktop launcher, SSH profiles | Functional | Unverified on real Windows | Uses mstsc and the built-in OpenSSH client. Passwords are never stored. |
| Developer Workspace | Partial | Windows CI | Tool detection and JSON formatter work. Monaco editor and Git operations are not implemented (shown as planned). |
| AI Assistant | Not implemented | — | Shown as "Planned", with no input box, so nothing pretends to work. It is now hidden in Easy Mode. |
| Activity log | Functional | UI | Logs actions and results, never output, keystrokes or passwords. |

## Fixed in this upgrade

- Windows PowerShell 5.1 serializes some arrays as `{value, Count}` and empty results as `{}`. These crashed the app-hang interpreter on real Windows. Fixed in the scripts (`Remove-TypeData System.Array`, explicit arrays) and in the parser.
- Error output from PowerShell appeared as raw CLIXML (XML) in output panels. It is now merged into readable text (`2>&1`), and leftover CLIXML is decoded.
- A `PSModulePath` inherited from PowerShell 7 broke Windows PowerShell 5.1 modules (e.g. `Get-ExecutionPolicy`). NEXTERM now removes it for 5.1.
- A single service event in a week no longer marks the PC as having a problem.
- Clicking the current page in the sidebar now resets it (for example, back to the problem list).
- Removed hidden background work: the persistent PowerShell process used for system info is gone, and live CPU/RAM no longer spawn PowerShell every 2 s.
- The process list no longer auto-refreshes every 5 s by default.
- The renderer bundle was not minified. It is now minified and code-split: main bundle 331 KB, and the terminal (425 KB) loads on first use.
