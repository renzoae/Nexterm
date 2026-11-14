import {
  Bot, Code2, Cpu, FileText, HeartPulse, LibraryBig, LifeBuoy, MonitorSmartphone, Network, Package, Settings,
  ShieldCheck, SlidersHorizontal, SquareTerminal, Users, Wrench, Building2, type LucideIcon
} from 'lucide-react'
import type { Mode } from '@/stores/settings'

export type PageId =
  | 'fix' | 'dashboard' | 'winsettings' | 'reports' | 'toolkit' | 'terminal' | 'network' | 'troubleshooting' | 'hardware' | 'users'
  | 'ad' | 'remote' | 'software' | 'developer' | 'ai' | 'library' | 'settings'

export interface NavItem {
  id: PageId
  label: string
  icon: LucideIcon
  modes: Mode[]
  description: string
}

// Easy Mode shows problem-first pages only. Advanced Mode adds the technician tools.
export const NAV: NavItem[] = [
  { id: 'fix', label: 'Fix a Problem', icon: LifeBuoy, modes: ['easy', 'advanced'], description: 'Guided troubleshooting for common problems' },
  { id: 'dashboard', label: 'Health Center', icon: HeartPulse, modes: ['easy', 'advanced'], description: 'What needs attention on this PC' },
  { id: 'winsettings', label: 'Windows Settings', icon: SlidersHorizontal, modes: ['easy', 'advanced'], description: 'Search and open any Windows setting' },
  { id: 'terminal', label: 'Terminal', icon: SquareTerminal, modes: ['advanced'], description: 'PowerShell, CMD, WSL and SSH sessions' },
  { id: 'toolkit', label: 'IT Support Toolkit', icon: Wrench, modes: ['advanced'], description: 'All diagnostics by category' },
  { id: 'network', label: 'Network', icon: Network, modes: ['easy', 'advanced'], description: 'Adapters, DNS and connectivity' },
  { id: 'hardware', label: 'Hardware', icon: Cpu, modes: ['easy', 'advanced'], description: 'CPU, memory, disks and processes' },
  { id: 'software', label: 'Software', icon: Package, modes: ['easy', 'advanced'], description: 'Install and update apps with winget' },
  { id: 'remote', label: 'Remote Connections', icon: MonitorSmartphone, modes: ['easy', 'advanced'], description: 'SSH profiles and Remote Desktop' },
  { id: 'reports', label: 'Support Report', icon: FileText, modes: ['easy', 'advanced'], description: 'Device report and troubleshooting history' },
  { id: 'troubleshooting', label: 'Windows Tools', icon: ShieldCheck, modes: ['advanced'], description: 'Repair tools, services and events' },
  { id: 'users', label: 'Users & Permissions', icon: Users, modes: ['advanced'], description: 'Accounts, groups and privileges' },
  { id: 'ad', label: 'Active Directory', icon: Building2, modes: ['advanced'], description: 'Domain diagnostics' },
  { id: 'developer', label: 'Developer Workspace', icon: Code2, modes: ['advanced'], description: 'Dev tool detection and utilities' },
  { id: 'library', label: 'Command Library', icon: LibraryBig, modes: ['advanced'], description: 'Searchable command database' },
  { id: 'ai', label: 'AI Assistant', icon: Bot, modes: ['advanced'], description: 'Planned for a later release' },
  { id: 'settings', label: 'Settings', icon: Settings, modes: ['easy', 'advanced'], description: 'Appearance, terminal and activity log' }
]
