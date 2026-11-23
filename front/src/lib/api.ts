import { getSessionToken } from './session-token'
import type {
  AdminCommunityKitchenClaim,
  AdminCommunityKitchenProfile,
  AdminKitchenPhoto,
  AdminUser,
  ClaimStatus,
  CommunityKitchen,
  CommunityKitchenClaim,
  CommunityKitchenProfile,
  CommunityKitchenProfileInput,
  CommunityKitchenStats,
  CreateDonation,
  Donation,
  DonationRequest,
  DonationStatus,
  HealthResponse,
  KitchenPhoto,
  NotificationPage,
  PhotoCategory,
  RequestStatus,
  ReviewDecision,
  Stats,
  TokenResponse,
  User,
  UserRole,
} from '../types'

const defaultBaseUrl = '/api'
const configuredBaseUrl = import.meta.env.VITE_API_URL?.trim() || defaultBaseUrl
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

async function send(path: string, options: RequestInit = {}): Promise<Response> {
  const hasBody = options.body !== undefined
  const headers = new Headers(options.headers)
  headers.set('Accept', 'application/json')
  if (hasBody && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json')
  const token = getSessionToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)

  try {
    return await fetch(`${API_BASE}${path}`, {
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
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await send(path, options)
  const payload: unknown = response.status === 204 ? undefined : await response.json().catch(() => undefined)
  if (!response.ok) {
    const detail = typeof payload === 'object' && payload !== null && 'detail' in payload
      ? detailMessage(payload.detail)
      : null
    throw new ApiError(response.status, detail ?? `Error de servidor (${response.status}).`)
  }
  if (response.status !== 204 && payload === undefined) throw new Error('La respuesta del servidor no contiene datos válidos.')
  return payload as T
}

async function requestBlob(path: string): Promise<Blob> {
  const response = await send(path, { headers: { Accept: 'image/*,application/octet-stream' } })
  if (!response.ok) {
    const payload: unknown = await response.json().catch(() => undefined)
    const detail = typeof payload === 'object' && payload !== null && 'detail' in payload ? detailMessage(payload.detail) : null
    throw new ApiError(response.status, detail ?? `Error de servidor (${response.status}).`)
  }
  return response.blob()
}

const jsonBody = (data: unknown): string => JSON.stringify(data)
const queryString = (values: Record<string, string | number | boolean | undefined>): string => {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== '') query.set(key, String(value))
  }
  return query.size ? `?${query.toString()}` : ''
}

export function resolveMediaUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path
  const apiOrigin = new URL(API_BASE, window.location.origin)
  if (path.startsWith('/')) return new URL(path, apiOrigin.origin).toString()
  return new URL(path, `${API_BASE}/`).toString()
}

export const api = {
  health: () => request<HealthResponse>('/health'),
  register: (email: string, password: string) => request<User>('/auth/register', { method: 'POST', body: jsonBody({ email, password }) }),
  login: (email: string, password: string) => request<TokenResponse>('/auth/login', { method: 'POST', body: jsonBody({ email, password }) }),
  me: () => request<User>('/auth/me'),
  logout: () => request<void>('/auth/logout', { method: 'POST' }),
  listDonations: (status?: DonationStatus) => request<Donation[]>(`/donations${queryString({ status })}`),
  getDonation: (id: string) => request<Donation>(`/donations/${encodeURIComponent(id)}`),
  createDonation: (data: CreateDonation) => request<Donation>('/donations', { method: 'POST', body: jsonBody(data) }),
  reserve: (id: string, reservedBy: string) => request<Donation>(`/donations/${encodeURIComponent(id)}/reserve`, { method: 'PATCH', body: jsonBody({ reserved_by: reservedBy }) }),
  deliver: (id: string) => request<Donation>(`/donations/${encodeURIComponent(id)}/deliver`, { method: 'PATCH' }),
  stats: () => request<Stats>('/stats'),
  listCommunityKitchens: (options: { name?: string; district?: string; limit?: number; offset?: number } = {}) =>
    request<CommunityKitchen[]>(`/community-kitchens${queryString(options)}`),
  getCommunityKitchen: (id: number) => request<CommunityKitchen>(`/community-kitchens/${id}`),
  communityKitchenStats: () => request<CommunityKitchenStats>('/community-kitchens/stats'),
  claimKitchen: (id: number) => request<CommunityKitchenClaim>(`/community-kitchens/${id}/claims`, { method: 'POST', body: '{}' }),
  publicKitchenProfile: (id: number) => request<CommunityKitchenProfile>(`/community-kitchens/${id}/profile`),
  submitKitchenProfile: (id: number, data: CommunityKitchenProfileInput) => request<CommunityKitchenProfile>(`/community-kitchens/${id}/profile`, { method: 'PUT', body: jsonBody(data) }),
  listKitchenPhotos: (id: number, category?: PhotoCategory) => request<KitchenPhoto[]>(`/community-kitchens/${id}/photos${queryString({ category })}`),
  uploadKitchenPhoto: (id: number, profileId: string, category: PhotoCategory, file: File) => {
    const body = new FormData()
    body.set('profile_id', profileId)
    body.set('category', category)
    body.set('file', file)
    return request<KitchenPhoto>(`/community-kitchens/${id}/photos`, { method: 'POST', body })
  },
  listDonationRequests: (status?: RequestStatus) => request<DonationRequest[]>(`/donation-requests${queryString({ status })}`),
  createDonationRequest: (donationId: string, kitchenId: number) => request<DonationRequest>(`/donations/${encodeURIComponent(donationId)}/requests`, { method: 'POST', body: jsonBody({ kitchen_id: kitchenId }) }),
  getDonationRequest: (id: string) => request<DonationRequest>(`/donation-requests/${encodeURIComponent(id)}`),
  listNotifications: (options: { unreadOnly?: boolean; limit?: number; offset?: number } = {}) => request<NotificationPage>(`/notifications${queryString({ unread_only: options.unreadOnly, limit: options.limit, offset: options.offset })}`),
  markNotificationRead: (id: string) => request<NotificationPage['notifications'][number]>(`/notifications/${encodeURIComponent(id)}/read`, { method: 'PATCH' }),
  markAllNotificationsRead: () => request<void>('/notifications/read-all', { method: 'PATCH' }),
  adminUsers: (options: { role?: UserRole; limit?: number; offset?: number } = {}) => request<AdminUser[]>(`/admin/users${queryString(options)}`),
  adminKitchens: (options: { name?: string; district?: string; limit?: number; offset?: number } = {}) => request<CommunityKitchen[]>(`/admin/community-kitchens${queryString(options)}`),
  adminDonations: (status?: DonationStatus) => request<Donation[]>(`/admin/donations${queryString({ status })}`),
  adminClaims: (status: ClaimStatus = 'pending') => request<AdminCommunityKitchenClaim[]>(`/admin/community-kitchen-claims${queryString({ status })}`),
  reviewClaim: (id: string, decision: ReviewDecision) => request<CommunityKitchenClaim>(`/admin/community-kitchen-claims/${encodeURIComponent(id)}/decision`, { method: 'PATCH', body: jsonBody({ decision }) }),
  adminProfiles: (status: 'pending' | 'published' | 'rejected' = 'pending') => request<AdminCommunityKitchenProfile[]>(`/admin/community-kitchen-profiles${queryString({ status })}`),
  reviewProfile: (id: string, decision: ReviewDecision) => request<CommunityKitchenProfile>(`/admin/community-kitchen-profiles/${encodeURIComponent(id)}/decision`, { method: 'PATCH', body: jsonBody({ decision }) }),
  adminPhotos: () => request<AdminKitchenPhoto[]>('/admin/community-kitchen-photos'),
  adminPhotoContent: (id: string) => requestBlob(`/admin/community-kitchen-photos/${encodeURIComponent(id)}/content`),
  reviewPhoto: (id: string, decision: ReviewDecision) => request<KitchenPhoto>(`/admin/community-kitchen-photos/${encodeURIComponent(id)}/decision`, { method: 'PATCH', body: jsonBody({ decision }) }),
  adminRequests: (status?: RequestStatus) => request<DonationRequest[]>(`/admin/donation-requests${queryString({ status })}`),
  reviewDonationRequest: (id: string, decision: ReviewDecision) => request<DonationRequest>(`/admin/donation-requests/${encodeURIComponent(id)}/decision`, { method: 'PATCH', body: jsonBody({ decision }) }),
}
