# Security Policy

NEXTERM executes system commands, so security reports are taken seriously.

## Reporting a vulnerability

Please **do not open a public issue**. Use GitHub's private reporting instead:
**Security › Report a vulnerability** on this repository.

Include the version, steps to reproduce and the impact. You should get a response within 7 days.

## Scope

In scope: command or argument injection, bypassing confirmation dialogs, privilege escalation,
IPC or preload abuse, remote content execution, and secrets written to disk.

## Design rules contributors must keep

- The renderer never sends executables, raw command lines or shell strings to the main process.
- Every new IPC channel validates its sender and its arguments.
- System-changing actions are confirmed in the main process, never only in the UI.
- No silent elevation and no stored passwords.
