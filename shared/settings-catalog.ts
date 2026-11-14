// Searchable catalog of Windows settings pages. The renderer only sends an id;
// the main process looks up the URI here and opens it.

export interface SettingEntry {
  id: string
  title: string
  section: string
  keywords: string
  uri: string
  /** Optional guided workflow or direct control inside NEXTERM. */
  problem?: string
}

export const SETTINGS: SettingEntry[] = [
  // Network
  { id: 'network-status', title: 'Network status', section: 'Network', uri: 'ms-settings:network-status', keywords: 'internet connection network reset troubleshoot', problem: 'internet' },
  { id: 'wifi', title: 'Wi-Fi', section: 'Network', uri: 'ms-settings:network-wifi', keywords: 'wireless wlan ssid hotspot connect' },
  { id: 'ethernet', title: 'Ethernet (change DNS / IP)', section: 'Network', uri: 'ms-settings:network-ethernet', keywords: 'cable lan change dns ip address static dhcp', problem: 'dns' },
  { id: 'network-advanced', title: 'Advanced network settings', section: 'Network', uri: 'ms-settings:network-advancedsettings', keywords: 'adapters network reset dns change adapter options' },
  { id: 'proxy', title: 'Proxy', section: 'Network', uri: 'ms-settings:network-proxy', keywords: 'proxy pac script vpn corporate' },
  { id: 'vpn', title: 'VPN', section: 'Network', uri: 'ms-settings:network-vpn', keywords: 'vpn tunnel remote' },
  { id: 'airplane', title: 'Airplane mode', section: 'Network', uri: 'ms-settings:network-airplanemode', keywords: 'flight mode radios' },
  { id: 'hotspot', title: 'Mobile hotspot', section: 'Network', uri: 'ms-settings:network-mobilehotspot', keywords: 'share internet tethering' },
  { id: 'data-usage', title: 'Data usage', section: 'Network', uri: 'ms-settings:datausage', keywords: 'metered bandwidth limit' },
  // Devices
  { id: 'bluetooth', title: 'Bluetooth & devices', section: 'Devices', uri: 'ms-settings:bluetooth', keywords: 'pair headphones mouse keyboard bluetooth' },
  { id: 'printers', title: 'Printers & scanners', section: 'Devices', uri: 'ms-settings:printers', keywords: 'printer scanner default print', problem: 'printer' },
  { id: 'mouse', title: 'Mouse', section: 'Devices', uri: 'ms-settings:mousetouchpad', keywords: 'pointer speed buttons scroll' },
  { id: 'touchpad', title: 'Touchpad', section: 'Devices', uri: 'ms-settings:devices-touchpad', keywords: 'gestures tap trackpad' },
  { id: 'typing', title: 'Typing', section: 'Devices', uri: 'ms-settings:typing', keywords: 'autocorrect keyboard spelling' },
  { id: 'autoplay', title: 'AutoPlay', section: 'Devices', uri: 'ms-settings:autoplay', keywords: 'usb drive memory card' },
  // System
  { id: 'display', title: 'Display & brightness', section: 'System', uri: 'ms-settings:display', keywords: 'screen brightness resolution scale monitor hdr' },
  { id: 'night-light', title: 'Night light', section: 'System', uri: 'ms-settings:nightlight', keywords: 'blue light warm screen' },
  { id: 'graphics', title: 'Graphics', section: 'System', uri: 'ms-settings:display-advancedgraphics', keywords: 'gpu performance app graphics preference' },
  { id: 'sound', title: 'Sound', section: 'System', uri: 'ms-settings:sound', keywords: 'audio output input speakers headphones volume', problem: 'sound' },
  { id: 'sound-devices', title: 'Sound devices', section: 'System', uri: 'ms-settings:sound-devices', keywords: 'audio device disable enable' },
  { id: 'volume-mixer', title: 'Volume mixer', section: 'System', uri: 'ms-settings:apps-volume', keywords: 'app volume per app audio' },
  { id: 'notifications', title: 'Notifications', section: 'System', uri: 'ms-settings:notifications', keywords: 'alerts banners do not disturb' },
  { id: 'focus', title: 'Focus / Do not disturb', section: 'System', uri: 'ms-settings:quiethours', keywords: 'quiet hours focus assist' },
  { id: 'power', title: 'Power & sleep', section: 'System', uri: 'ms-settings:powersleep', keywords: 'power settings sleep screen timeout power plan energy' },
  { id: 'battery', title: 'Battery saver', section: 'System', uri: 'ms-settings:batterysaver', keywords: 'battery usage laptop' },
  { id: 'storage', title: 'Storage', section: 'System', uri: 'ms-settings:storagesense', keywords: 'disk space storage sense cleanup free space', problem: 'disk' },
  { id: 'storage-recommendations', title: 'Cleanup recommendations', section: 'System', uri: 'ms-settings:storagerecommendations', keywords: 'free up space large files unused apps' },
  { id: 'multitasking', title: 'Multitasking', section: 'System', uri: 'ms-settings:multitasking', keywords: 'snap windows alt tab desktops' },
  { id: 'clipboard', title: 'Clipboard', section: 'System', uri: 'ms-settings:clipboard', keywords: 'clipboard history sync' },
  { id: 'remote-desktop', title: 'Remote Desktop', section: 'System', uri: 'ms-settings:remotedesktop', keywords: 'rdp allow remote connections' },
  { id: 'about', title: 'About (rename PC, specs)', section: 'System', uri: 'ms-settings:about', keywords: 'pc name rename device specifications product key' },
  { id: 'activation', title: 'Activation', section: 'System', uri: 'ms-settings:activation', keywords: 'license product key activate' },
  { id: 'troubleshoot', title: 'Troubleshoot', section: 'System', uri: 'ms-settings:troubleshoot', keywords: 'troubleshooters fix problems get help' },
  { id: 'recovery', title: 'Recovery', section: 'System', uri: 'ms-settings:recovery', keywords: 'reset this pc advanced startup go back' },
  // Apps
  { id: 'installed-apps', title: 'Installed apps', section: 'Apps', uri: 'ms-settings:appsfeatures', keywords: 'uninstall programs apps features' },
  { id: 'default-apps', title: 'Default apps', section: 'Apps', uri: 'ms-settings:defaultapps', keywords: 'browser pdf default program open with' },
  { id: 'startup-apps', title: 'Startup apps', section: 'Apps', uri: 'ms-settings:startupapps', keywords: 'startup applications boot login programs launch', problem: 'startup' },
  { id: 'optional-features', title: 'Optional features', section: 'Apps', uri: 'ms-settings:optionalfeatures', keywords: 'rsat openssh features add' },
  // Accounts
  { id: 'your-info', title: 'Your info', section: 'Accounts', uri: 'ms-settings:yourinfo', keywords: 'account microsoft account picture' },
  { id: 'sign-in', title: 'Sign-in options', section: 'Accounts', uri: 'ms-settings:signinoptions', keywords: 'pin password windows hello fingerprint face' },
  { id: 'work-access', title: 'Access work or school', section: 'Accounts', uri: 'ms-settings:workplace', keywords: 'domain azure ad mdm intune company' },
  { id: 'other-users', title: 'Other users', section: 'Accounts', uri: 'ms-settings:otherusers', keywords: 'add user family account local' },
  // Time & language
  { id: 'date-time', title: 'Date & time', section: 'Time & language', uri: 'ms-settings:dateandtime', keywords: 'clock timezone sync time' },
  { id: 'language', title: 'Language & region', section: 'Time & language', uri: 'ms-settings:regionlanguage', keywords: 'language keyboard layout region format arabic' },
  // Personalization
  { id: 'personalization', title: 'Personalization', section: 'Personalization', uri: 'ms-settings:personalization', keywords: 'theme wallpaper' },
  { id: 'colors', title: 'Colors (dark mode)', section: 'Personalization', uri: 'ms-settings:colors', keywords: 'dark mode light mode accent color' },
  { id: 'taskbar', title: 'Taskbar', section: 'Personalization', uri: 'ms-settings:taskbar', keywords: 'taskbar alignment icons tray' },
  { id: 'lock-screen', title: 'Lock screen', section: 'Personalization', uri: 'ms-settings:lockscreen', keywords: 'lock screen picture timeout' },
  // Privacy & security
  { id: 'windows-security', title: 'Windows Security', section: 'Privacy & security', uri: 'ms-settings:windowsdefender', keywords: 'antivirus defender virus protection security' },
  { id: 'firewall', title: 'Firewall & network protection', section: 'Privacy & security', uri: 'windowsdefender://network', keywords: 'firewall block allow app' },
  { id: 'microphone', title: 'Microphone permissions', section: 'Privacy & security', uri: 'ms-settings:privacy-microphone', keywords: 'mic microphone access app permissions' },
  { id: 'camera', title: 'Camera permissions', section: 'Privacy & security', uri: 'ms-settings:privacy-webcam', keywords: 'webcam camera access app permissions' },
  { id: 'location', title: 'Location permissions', section: 'Privacy & security', uri: 'ms-settings:privacy-location', keywords: 'gps location services' },
  { id: 'find-device', title: 'Find my device', section: 'Privacy & security', uri: 'ms-settings:findmydevice', keywords: 'lost laptop locate' },
  { id: 'developers', title: 'For developers', section: 'Privacy & security', uri: 'ms-settings:developers', keywords: 'developer mode sudo terminal' },
  // Update
  { id: 'windows-update', title: 'Windows Update', section: 'Windows Update', uri: 'ms-settings:windowsupdate', keywords: 'update check for updates patches', problem: 'update' },
  { id: 'update-history', title: 'Update history', section: 'Windows Update', uri: 'ms-settings:windowsupdate-history', keywords: 'installed updates failed uninstall updates' },
  { id: 'update-advanced', title: 'Advanced update options', section: 'Windows Update', uri: 'ms-settings:windowsupdate-options', keywords: 'active hours delivery optimization optional updates' },
  // Gaming & accessibility
  { id: 'game-mode', title: 'Game Mode', section: 'Gaming', uri: 'ms-settings:gaming-gamemode', keywords: 'games performance' },
  { id: 'accessibility', title: 'Accessibility', section: 'Accessibility', uri: 'ms-settings:easeofaccess-display', keywords: 'text size magnifier narrator contrast ease of access' }
]

export function searchSettings(query: string): SettingEntry[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (!words.length) return SETTINGS
  return SETTINGS.map((s) => {
    const hay = `${s.title} ${s.section} ${s.keywords}`.toLowerCase()
    let score = 0
    for (const w of words) {
      if (!hay.includes(w)) return { s, score: 0 }
      score += s.title.toLowerCase().includes(w) ? 3 : 1
    }
    return { s, score }
  })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.s)
}
