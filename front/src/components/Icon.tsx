import type { ReactNode } from 'react'

export type IconName = 'leaf' | 'arrow' | 'search' | 'package' | 'pin' | 'clock' | 'check' | 'plus' | 'refresh' | 'close'

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
}

export function Icon({ name, size = 18, className = '' }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg aria-hidden="true" className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      {iconShapes[name]}
    </svg>
  )
}
