import type { CreateDonation, Donation, DonationStatus, Stats } from '../types'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(API + path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  })
  if (!response.ok) {
    const error = await response.json().catch(() => null) as { detail?: unknown } | null
    const detail = error?.detail
    throw new Error(typeof detail === 'string' ? detail : 'Error de servidor (' + response.status + ')')
  }
  return response.json() as Promise<T>
}

export const api = {
  listDonations: (status?: DonationStatus) =>
    request<Donation[]>('/donations' + (status ? '?status=' + status : '')),
  getDonation: (id: string) =>
    request<Donation>('/donations/' + encodeURIComponent(id)),
  createDonation: (data: CreateDonation) =>
    request<Donation>('/donations', { method: 'POST', body: JSON.stringify(data) }),
  reserve: (id: string, reservedBy: string) =>
    request<Donation>('/donations/' + encodeURIComponent(id) + '/reserve', {
      method: 'PATCH',
      body: JSON.stringify({ reserved_by: reservedBy }),
    }),
  deliver: (id: string) =>
    request<Donation>('/donations/' + encodeURIComponent(id) + '/deliver', { method: 'PATCH' }),
  stats: () => request<Stats>('/stats'),
}
