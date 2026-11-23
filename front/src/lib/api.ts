import type { CommunityKitchen, CreateDonation, Donation, DonationStatus, HealthResponse, Stats } from '../types'

const configuredBaseUrl = import.meta.env.VITE_API_URL?.trim() || 'http://localhost:8000/api'
const API_BASE = configuredBaseUrl.replace(/\/+$/, '')
const REQUEST_TIMEOUT_MS = 12_000

export class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

function detailMessage(detail: unknown): string | null {
  if (typeof detail === 'string' && detail.trim()) return detail.trim()
  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) => typeof item === 'object' && item !== null && 'msg' in item ? String(item.msg) : '')
      .filter(Boolean)
    if (messages.length) return messages.join('. ')
  }
  return null
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const hasBody = options.body !== undefined
  const headers = new Headers(options.headers)
  headers.set('Accept', 'application/json')
  if (hasBody) headers.set('Content-Type', 'application/json')

  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
      signal: options.signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  } catch (cause) {
    if (cause instanceof Error && (cause.name === 'TimeoutError' || cause.name === 'AbortError')) {
      throw new Error('La solicitud tardó demasiado. Inténtalo nuevamente.')
    }
    throw cause
  }

  const payload: unknown = response.status === 204
    ? null
    : await response.json().catch(() => null)

  if (!response.ok) {
    const detail = typeof payload === 'object' && payload !== null && 'detail' in payload
      ? detailMessage(payload.detail)
      : null
    throw new ApiError(response.status, detail ?? `Error de servidor (${response.status}).`)
  }

  if (payload === null) throw new Error('La respuesta del servidor no contiene datos válidos.')
  return payload as T
}

export const api = {
  health: () => request<HealthResponse>('/health'),
  listDonations: (status?: DonationStatus) => {
    const query = status ? `?${new URLSearchParams({ status })}` : ''
    return request<Donation[]>(`/donations${query}`)
  },
  getDonation: (id: string) => request<Donation>(`/donations/${encodeURIComponent(id)}`),
  createDonation: (data: CreateDonation) =>
    request<Donation>('/donations', { method: 'POST', body: JSON.stringify(data) }),
  reserve: (id: string, reservedBy: string) =>
    request<Donation>(`/donations/${encodeURIComponent(id)}/reserve`, {
      method: 'PATCH',
      body: JSON.stringify({ reserved_by: reservedBy }),
    }),
  deliver: (id: string) =>
    request<Donation>(`/donations/${encodeURIComponent(id)}/deliver`, { method: 'PATCH' }),
  stats: () => request<Stats>('/stats'),
  listCommunityKitchens: (options: { name?: string; district?: string; limit?: number; offset?: number } = {}) => {
    const params = new URLSearchParams()
    if (options.name?.trim()) params.set('name', options.name.trim())
    if (options.district?.trim()) params.set('district', options.district.trim())
    if (options.limit !== undefined) params.set('limit', String(options.limit))
    if (options.offset !== undefined) params.set('offset', String(options.offset))
    const query = params.size ? `?${params.toString()}` : ''
    return request<CommunityKitchen[]>(`/community-kitchens${query}`)
  },
}
