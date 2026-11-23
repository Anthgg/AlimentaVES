import { useCallback, useEffect, useState } from 'react'
import { api } from '../lib/api'
import { friendlyError } from '../lib/errors'
import type { Donation } from '../types'
import { expiryDetails, formatDate, formatNumber } from '../utils/format'
import { DialogFrame } from './DialogFrame'
import { Icon } from './Icon'
import { StatusBadge } from './StatusBadge'

interface DonationDetailsDialogProps {
  initialDonation: Donation
  busy: boolean
  onClose: () => void
  onReserve: (donation: Donation) => void
  onDeliver: (donation: Donation) => void
}

export function DonationDetailsDialog({ initialDonation, busy, onClose, onReserve, onDeliver }: DonationDetailsDialogProps) {
  const [donation, setDonation] = useState(initialDonation)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadDetails = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setDonation(await api.getDonation(initialDonation.id))
    } catch (cause) {
      setError(friendlyError(cause))
    } finally {
      setLoading(false)
    }
  }, [initialDonation.id])

  useEffect(() => { void loadDetails() }, [loadDetails])

  const expiry = expiryDetails(donation.expires_at)
  const canReserve = donation.status === 'available' && expiry.tone !== 'expired' && !error

  return (
    <DialogFrame labelledBy="details-dialog-title" describedBy="details-dialog-description" onClose={onClose}>
      <button type="button" className="dialog-close" aria-label="Cerrar detalle" onClick={onClose} disabled={busy}><Icon name="close" size={19} /></button>
      <span className="dialog-kicker">DETALLE DE LA DONACIÓN</span>
      <h2 id="details-dialog-title">{donation.food_name}</h2>
      <p id="details-dialog-description" className="dialog-food">Publicada por {donation.donor_name}</p>
      {loading && <p className="dialog-loading" role="status">Actualizando información…</p>}
      {error && <div className="dialog-error" role="alert"><span>{error}</span><button type="button" className="text-link" onClick={() => void loadDetails()} disabled={loading}>Reintentar</button></div>}
      <div className="details-summary"><strong>{formatNumber(donation.quantity_kg)} <span>kg</span></strong><StatusBadge status={donation.status} /></div>
      <dl className="details-list">
        <div><dt>Punto de recojo</dt><dd>{donation.pickup_address}</dd></div>
        <div><dt>Vencimiento</dt><dd>{expiry.label} · {formatDate(donation.expires_at)}</dd></div>
        <div><dt>Registrada</dt><dd>{formatDate(donation.created_at)}</dd></div>
        {donation.reserved_by && <div><dt>Comedor que reservó</dt><dd>{donation.reserved_by}</dd></div>}
        {donation.delivered_at && <div><dt>Entrega confirmada</dt><dd>{formatDate(donation.delivered_at)}</dd></div>}
        {donation.notes && <div><dt>Indicaciones</dt><dd>{donation.notes}</dd></div>}
      </dl>
      {donation.status === 'available' && <button className="button button-dark button-full" onClick={() => onReserve(donation)} disabled={busy || loading || !canReserve}>{canReserve ? 'Reservar donación' : 'Donación vencida'} <Icon name="arrow" size={16} /></button>}
      {donation.status === 'reserved' && <button className="button button-outline button-full" onClick={() => onDeliver(donation)} disabled={busy || loading || Boolean(error)}><Icon name="check" size={16} /> Confirmar entrega</button>}
      {donation.status === 'delivered' && <p className="delivered-caption"><Icon name="check" size={15} /> Entrega confirmada</p>}
    </DialogFrame>
  )
}
