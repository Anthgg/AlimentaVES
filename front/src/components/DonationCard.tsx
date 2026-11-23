import type { Donation } from '../types'
import { expiryDetails, formatDate, formatNumber } from '../utils/format'
import { Icon } from './Icon'
import { StatusBadge } from './StatusBadge'

interface DonationCardProps {
  donation: Donation
  onReserve: (donation: Donation) => void
  onDeliver: (donation: Donation) => void
  onDetails: (donation: Donation) => void
  disabled: boolean
  compact?: boolean
}

export function DonationCard({ donation, onReserve, onDeliver, onDetails, disabled, compact = false }: DonationCardProps) {
  const expiry = expiryDetails(donation.expires_at)
  const unavailable = expiry.tone === 'expired'

  return (
    <article className={`donation-card${compact ? ' donation-card-compact' : ''}`}>
      <div className="donation-card-head">
        <span className="donation-kind"><Icon name="leaf" size={15} /> Donación de alimentos</span>
        <StatusBadge status={donation.status} />
      </div>
      <div className="donation-card-main">
        <h3><button type="button" className="donation-title-button" onClick={() => onDetails(donation)}>{donation.food_name}</button></h3>
        <p className="donor-line">Compartido por <strong>{donation.donor_name}</strong></p>
        <div className="quantity-block">
          <strong>{formatNumber(donation.quantity_kg)} <span>kg</span></strong>
          <small>cantidad registrada</small>
        </div>
        <div className="donation-details">
          <p><Icon name="pin" size={16} /><span>{donation.pickup_address}</span></p>
          <p className={`expiry-line expiry-${expiry.tone}`}><Icon name="clock" size={16} /><span>{expiry.label} · {formatDate(donation.expires_at)}</span></p>
          {donation.notes && <p className="donation-note">{donation.notes}</p>}
          {donation.reserved_by && <p className="reserved-by">Reservada por <strong>{donation.reserved_by}</strong></p>}
        </div>
      </div>
      <div className="donation-card-actions">
        {donation.status === 'available' && (
          <button className="button button-dark button-full" disabled={disabled || unavailable} onClick={() => onReserve(donation)}>
            {unavailable ? 'Donación vencida' : 'Reservar donación'} {!unavailable && <Icon name="arrow" size={16} />}
          </button>
        )}
        {donation.status === 'reserved' && (
          <button className="button button-outline button-full" disabled={disabled} onClick={() => onDeliver(donation)}>
            <Icon name="check" size={16} /> Confirmar entrega
          </button>
        )}
        {donation.status === 'delivered' && <span className="delivered-caption"><Icon name="check" size={15} /> Entrega confirmada</span>}
        <button type="button" className="donation-detail-link" onClick={() => onDetails(donation)}>Ver detalle <Icon name="arrow" size={14} /></button>
      </div>
    </article>
  )
}
