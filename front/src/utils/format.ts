import type { DonationStatus } from '../types'

export type ExpiryTone = 'urgent' | 'soon' | 'normal' | 'expired'

export function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Fecha por confirmar'
  return date.toLocaleString('es-PE', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/Lima',
  })
}

export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return '—'
  return new Intl.NumberFormat('es-PE', { maximumFractionDigits: 1 }).format(value)
}

export function expiryDetails(value: string): { label: string; tone: ExpiryTone } {
  const expiry = new Date(value).getTime()
  if (Number.isNaN(expiry)) return { label: 'Vencimiento por confirmar', tone: 'normal' }
  const remaining = expiry - Date.now()
  if (remaining <= 0) return { label: 'Vencido', tone: 'expired' }
  if (remaining <= 24 * 60 * 60 * 1000) return { label: 'Vence en menos de 24 h', tone: 'urgent' }
  const days = Math.ceil(remaining / (24 * 60 * 60 * 1000))
  return { label: `Vence en ${days} ${days === 1 ? 'día' : 'días'}`, tone: days <= 3 ? 'soon' : 'normal' }
}

export function minimumDateTime(): string {
  const now = new Date()
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset())
  return now.toISOString().slice(0, 16)
}

export const statusLabels: Record<DonationStatus, string> = {
  available: 'Disponible',
  reserved: 'Reservada',
  delivered: 'Entregada',
}
