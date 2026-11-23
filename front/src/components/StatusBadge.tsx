import type { DonationStatus } from '../types'
import { statusLabels } from '../utils/format'

export function StatusBadge({ status }: { status: DonationStatus }) {
  return <span className={`status-badge status-${status}`}><span className="status-dot" />{statusLabels[status]}</span>
}
