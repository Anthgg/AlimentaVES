import { Icon, type IconName } from './Icon'

export function MetricCard({ value, label, detail, icon }: { value: string; label: string; detail: string; icon: IconName }) {
  return (
    <article className="metric-card">
      <span className="metric-icon"><Icon name={icon} size={19} /></span>
      <div className="metric-value">{value}</div>
      <div className="metric-label">{label}</div>
      <div className="metric-detail">{detail}</div>
    </article>
  )
}
