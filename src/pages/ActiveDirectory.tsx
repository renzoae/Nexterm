import { RefreshCw } from 'lucide-react'
import { commandsIn } from '@shared/commands'
import { ToolList } from '@/components/ToolCard'
import { Badge, Button, Card, InfoNote, PageHeader, Spinner } from '@/components/ui'
import { useAsync } from '@/hooks/useAsync'

export function ActiveDirectory() {
  const { data, loading, reload } = useAsync(() => window.nexterm.system.domain())
  return (
    <div>
      <PageHeader
        title="Active Directory"
        description="Domain membership and domain controller diagnostics. Tools marked “Domain-joined PC” report that a domain is required when run on a workgroup PC."
        actions={<Button onClick={() => void reload()} disabled={loading} icon={loading ? <Spinner /> : <RefreshCw className="h-4 w-4" />}>Re-check</Button>}
      />
      <Card className="mb-4" title="Domain status">
        {!data ? <Spinner /> : !data.supported ? (
          <p className="text-sm text-muted">Active Directory diagnostics are only available on Windows.</p>
        ) : (
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <Badge tone={data.partOfDomain ? 'ok' : 'neutral'}>{data.partOfDomain ? 'Domain-joined' : 'Not domain-joined'}</Badge>
            <span className="text-fg">{data.partOfDomain ? data.domain : `Workgroup: ${data.workgroup || 'WORKGROUP'}`}</span>
            <Badge tone={data.rsatInstalled ? 'ok' : 'neutral'}>{data.rsatInstalled ? 'RSAT ActiveDirectory module installed' : 'RSAT not installed'}</Badge>
            {data.error && <span className="text-xs text-danger">{data.error}</span>}
          </div>
        )}
      </Card>
      {data && data.supported && !data.rsatInstalled && (
        <div className="mb-4">
          <InfoNote>To enable account lookups, install RSAT: Settings › System › Optional features › “RSAT: Active Directory Domain Services and Lightweight Directory Services Tools”.</InfoNote>
        </div>
      )}
      <ToolList commands={commandsIn('active-directory')} />
    </div>
  )
}
