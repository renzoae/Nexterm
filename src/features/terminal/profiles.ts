import { useEffect, useState } from 'react'
import type { TerminalProfile } from '@shared/types'
import { useSettings } from '@/stores/settings'
import { useTerminals } from '@/stores/terminal'

// Kept separate from the terminal UI so pages can use these helpers without
// loading xterm.js (the terminal is lazy-loaded on first use).

let profilesCache: Promise<TerminalProfile[]> | null = null
export function getProfiles(): Promise<TerminalProfile[]> {
  profilesCache ??= window.nexterm.terminal.profiles()
  return profilesCache
}

export function useProfiles(): TerminalProfile[] {
  const [profiles, setProfiles] = useState<TerminalProfile[]>([])
  useEffect(() => {
    void getProfiles().then(setProfiles)
  }, [])
  return profiles
}

export async function openDefaultTerminal(): Promise<void> {
  const profiles = await getProfiles()
  const pref = useSettings.getState().defaultProfile
  const p = profiles.find((x) => x.id === pref) ?? profiles[0]
  if (p) useTerminals.getState().openTab({ profileId: p.id, title: p.name })
}
