import { commandsIn } from '@shared/commands'
import { ToolList } from '@/components/ToolCard'
import { Badge, Card, PageHeader } from '@/components/ui'
import { useApp } from '@/stores/app'

export function UsersPage() {
  const info = useApp((s) => s.info)
  return (
    <div>
      <PageHeader title="Users & Permissions" description="Read-only account, group and privilege diagnostics." />
      <Card className="mb-4" title="This session">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          {info?.isAdmin ? (
            <><Badge tone="warn">Elevated</Badge><span className="text-muted">NEXTERM is running as administrator. Be careful with system-changing tools.</span></>
          ) : (
            <><Badge>Standard</Badge><span className="text-muted">NEXTERM is running without elevation. Tools that need admin rights open a separate elevated window after a UAC prompt.</span></>
          )}
        </div>
      </Card>
      <ToolList commands={commandsIn('users')} />
    </div>
  )
}
