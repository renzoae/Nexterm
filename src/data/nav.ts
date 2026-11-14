import {
  Activity, Bot, Code2, Cpu, LayoutDashboard, LibraryBig, MonitorSmartphone, Network, Package, Settings,
  ShieldCheck, SquareTerminal, Users, Wrench, Building2, type LucideIcon
} from 'lucide-react'
import type { Mode } from '@/stores/settings'

export type PageId =
  | 'dashboard' | 'toolkit' | 'terminal' | 'network' | 'troubleshooting' | 'hardware' | 'users'
  | 'ad' | 'remote' | 'software' | 'developer' | 'ai' | 'library' | 'settings'

export interface NavItem {
  id: PageId
  label: string
  icon: LucideIcon
  modes: Mode[]
  description: string
}

export const NAV: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, modes: ['easy', 'advanced'], description: 'Live overview of this PC' },
  { id: 'toolkit', label: 'IT Support Toolkit', icon: Wrench, modes: ['easy', 'advanced'], description: 'All diagnostics by category' },
  { id: 'terminal', label: 'Terminal', icon: SquareTerminal, modes: ['advanced'], description: 'PowerShell, CMD, WSL and SSH sessions' },
  { id: 'network', label: 'Network Diagnostics', icon: Network, modes: ['easy', 'advanced'], description: 'Adapters, DNS and connectivity' },
  { id: 'troubleshooting', label: 'Windows Troubleshooting', icon: ShieldCheck, modes: ['easy', 'advanced'], description: 'Repair tools, services and events' },
  { id: 'hardware', label: 'Hardware Monitoring', icon: Cpu, modes: ['easy', 'advanced'], description: 'CPU, memory, disks and processes' },
  { id: 'users', label: 'Users & Permissions', icon: Users, modes: ['easy', 'advanced'], description: 'Accounts, groups and privileges' },
  { id: 'ad', label: 'Active Directory', icon: Building2, modes: ['advanced'], description: 'Domain diagnostics' },
  { id: 'remote', label: 'Remote Connections', icon: MonitorSmartphone, modes: ['easy', 'advanced'], description: 'SSH profiles and Remote Desktop' },
  { id: 'software', label: 'Software Management', icon: Package, modes: ['easy', 'advanced'], description: 'Install and update apps with winget' },
  { id: 'developer', label: 'Developer Workspace', icon: Code2, modes: ['advanced'], description: 'Dev tool detection and utilities' },
  { id: 'ai', label: 'AI Assistant', icon: Bot, modes: ['easy', 'advanced'], description: 'Planned for a later release' },
  { id: 'library', label: 'Command Library', icon: LibraryBig, modes: ['advanced'], description: 'Searchable command database' },
  { id: 'settings', label: 'Settings', icon: Settings, modes: ['easy', 'advanced'], description: 'Appearance, terminal and activity log' }
]

export const ACTIVITY_ICON = Activity
