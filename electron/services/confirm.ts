import { BrowserWindow, dialog, type WebContents } from 'electron'
import type { Risk } from '@shared/types'

/**
 * Native confirmation dialog shown by the main process. Because it lives in
 * the main process, a compromised renderer cannot skip it.
 */
export async function confirmAction(
  sender: WebContents,
  opts: { title: string; message: string; command: string; risk: Risk; admin?: boolean; note?: string; confirmLabel?: string }
): Promise<boolean> {
  const win = BrowserWindow.fromWebContents(sender) ?? undefined
  const riskText = opts.risk === 'high' ? 'HIGH: may disrupt the system or connectivity' : opts.risk === 'caution' ? 'Caution: changes system state' : 'Read-only'
  const detail = [
    'Exact command:',
    opts.command,
    '',
    `Risk: ${riskText}`,
    opts.admin ? 'Requires administrator privileges.' : '',
    opts.note ?? ''
  ].filter((l, i, a) => l !== '' || (i > 0 && a[i - 1] !== '')).join('\n')
  const options = {
    type: opts.risk === 'high' ? ('warning' as const) : ('question' as const),
    title: opts.title,
    message: opts.message,
    detail,
    buttons: ['Cancel', opts.confirmLabel ?? 'Run'],
    defaultId: 0,
    cancelId: 0,
    noLink: true
  }
  const res = win ? await dialog.showMessageBox(win, options) : await dialog.showMessageBox(options)
  return res.response === 1
}
