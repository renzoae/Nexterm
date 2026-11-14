# Contributing to NEXTERM

Thanks for helping!

1. Fork and clone, then run `npm ci`.
2. `npm run dev` starts the app with hot reload.
3. Before opening a pull request, run `npm run check` (typecheck, lint and tests).
4. Keep pull requests focused, and describe how you tested on Windows.

## Guidelines

- New diagnostics go in `shared/commands.ts`. Prefer read-only commands and set `risk` honestly.
- Never add an IPC channel that runs arbitrary input. See [SECURITY.md](SECURITY.md).
- Do not display fabricated data. If something cannot be measured, say so in the UI.
- Mark unfinished features as planned instead of shipping buttons that do nothing.
