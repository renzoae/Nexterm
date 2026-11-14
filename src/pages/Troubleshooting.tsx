import { commandsIn } from '@shared/commands'
import { LaunchGrid } from '@/components/LaunchGrid'
import { ToolList } from '@/components/ToolCard'
import { InfoNote, PageHeader } from '@/components/ui'

export function Troubleshooting() {
  return (
    <div>
      <PageHeader title="Windows Troubleshooting" description="Repair tools, services, processes, updates and event logs." />
      <LaunchGrid ids={['devmgmt', 'eventvwr', 'services', 'diskmgmt', 'compmgmt', 'resmon', 'perfmon', 'ncpa', 'winupdate', 'taskmgr', 'msinfo32', 'appwiz', 'sysprops', 'printers']} />
      <div className="mb-4">
        <InfoNote>
          Repair order for corrupted system files: run <b>DISM Restore Health</b> first, then <b>System File Checker</b>. Both need administrator rights and can take a long time.
        </InfoNote>
      </div>
      <ToolList commands={commandsIn('windows')} />
      <h2 className="mt-6 mb-3 text-sm font-semibold text-fg">Security checks</h2>
      <ToolList commands={commandsIn('security')} />
    </div>
  )
}
