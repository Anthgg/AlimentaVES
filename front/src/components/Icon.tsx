import type { ReactNode } from 'react'

export type IconName = 'leaf' | 'arrow' | 'search' | 'package' | 'pin' | 'clock' | 'check' | 'plus' | 'refresh' | 'close' | 'menu' | 'people' | 'grain' | 'bell' | 'shield' | 'image' | 'calendar' | 'info'

const iconShapes: Record<IconName, ReactNode> = {
  leaf: <><path d="M20.5 3.5C11 3.5 5 7.7 5 14a6.5 6.5 0 0 0 6.5 6.5c6.3 0 9-7.7 9-17Z" /><path d="M3.5 21c3-5 7-8.5 12-11" /></>,
  arrow: <><path d="M4 12h15" /><path d="m13 5 7 7-7 7" /></>,
  search: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4.5 4.5" /></>,
  package: <><path d="m12 3 8 4.3v9.4L12 21l-8-4.3V7.3L12 3Z" /><path d="m4.4 7.5 7.6 4 7.6-4M12 12v9M8 5.2l8 4.2" /></>,
  pin: <><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" /><circle cx="12" cy="10" r="2.2" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  check: <><path d="m5 12 4.2 4.2L19 6.8" /></>,
  plus: <><path d="M12 5v14M5 12h14" /></>,
  refresh: <><path d="M20 7v5h-5M4 17v-5h5" /><path d="M5.8 9A7 7 0 0 1 18 6.4L20 12M4 12l2 5.6A7 7 0 0 0 18.2 15" /></>,
  close: <><path d="m6 6 12 12M18 6 6 18" /></>,
  menu: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
  people: <><path d="M16.5 20v-1.4a3.3 3.3 0 0 0-3.3-3.3H7.3A3.3 3.3 0 0 0 4 18.6V20" /><circle cx="10.25" cy="7.3" r="3.25" /><path d="M16.2 4.3a3.25 3.25 0 0 1 0 6.2M20 20v-1.4a3.3 3.3 0 0 0-2.6-3.2" /></>,
  grain: <><path d="M12 21V4m0 5c-3.3 0-5.2-1.9-5.5-4.8C9.7 4.2 12 5.8 12 9Zm0 4c-3.3 0-5.2-1.9-5.5-4.8C9.7 8.2 12 9.8 12 13Zm0-4c3.3 0 5.2-1.9 5.5-4.8C14.3 4.2 12 5.8 12 9Zm0 4c3.3 0 5.2-1.9 5.5-4.8C14.3 8.2 12 9.8 12 13Z" /></>,
  bell: <><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></>,
  shield: <><path d="M12 3 20 6v5c0 5-3.2 8.4-8 10-4.8-1.6-8-5-8-10V6l8-3Z" /><path d="m8.5 12 2.2 2.2 4.8-4.8" /></>,
  image: <><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8.5" cy="9" r="1.5" /><path d="m21 15-5-5L5 20" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5m0-8h.01" /></>,
}

export function Icon({ name, size = 18, className = '' }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg aria-hidden="true" className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      {iconShapes[name]}
    </svg>
  )
}
