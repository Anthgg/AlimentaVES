export type DonationStatus = 'available' | 'reserved' | 'delivered'
export type UserRole = 'donor' | 'kitchen' | 'admin'
export type ClaimStatus = 'pending' | 'approved' | 'rejected'
export type ProfileStatus = 'pending' | 'published' | 'rejected'
export type RequestStatus = 'pending' | 'approved' | 'rejected'
export type PhotoCategory = 'profile' | 'cover' | 'gallery' | 'food'
export type ReviewDecision = 'approved' | 'rejected'

export interface Donation {
  id: string
  donor_name: string
  food_name: string
  quantity_kg: number
  pickup_address: string
  expires_at: string
  notes: string | null
  status: DonationStatus
  reserved_by: string | null
  created_at: string
  delivered_at: string | null
}

export type CreateDonation = Pick<
  Donation,
  'donor_name' | 'food_name' | 'quantity_kg' | 'pickup_address' | 'expires_at' | 'notes'
>

export interface Stats {
  available: number
  reserved: number
  delivered: number
  kilograms_delivered: number
  estimated_servings: number
}

export interface HealthResponse {
  status: string
}

export interface User {
  id: string
  email: string
  role: UserRole
  created_at: string
}

export interface TokenResponse {
  access_token: string
  token_type: 'bearer'
  expires_in: number
}

export interface CommunityKitchen {
  id: number
  source_code: string
  name: string
  district: string
  ubigeo: string
  address: string | null
  latitude: number | null
  longitude: number | null
  modality: string | null
  source_status: string | null
  users_count: number | null
  source_url: string
  downloaded_at: string
  verified_at: string | null
  created_at: string
  updated_at: string
}

export interface CommunityKitchenStats {
  total: number
  located: number
  district_count: number
  status_breakdown: Record<string, number>
  records_with_reported_users: number
  source_reported_users_total: number
}

export interface CommunityKitchenClaim {
  id: string
  kitchen_id: number
  status: ClaimStatus
  submitted_at: string
  reviewed_at: string | null
}

export interface AdminCommunityKitchenClaim extends CommunityKitchenClaim {
  account_id: string
  account_email: string
  kitchen_name: string
  reviewed_by: string | null
}

export interface CommunityKitchenProfile {
  id: string
  kitchen_id: number
  description: string | null
  operating_hours: string | null
  institutional_location: string | null
  needs: string | null
  status: ProfileStatus
  submitted_at: string
  reviewed_at: string | null
}

export type CommunityKitchenProfileInput = Pick<CommunityKitchenProfile, 'description' | 'operating_hours' | 'institutional_location' | 'needs'>

export interface AdminCommunityKitchenProfile extends CommunityKitchenProfile {
  kitchen_name: string
  submitted_by: string | null
  submitter_email: string | null
  reviewed_by: string | null
}

export interface KitchenPhoto {
  id: string
  kitchen_id: number
  profile_id: string
  category: PhotoCategory
  content_type: string
  size_bytes: number
  width: number
  height: number
  status: string
  url: string
  uploaded_at: string
}

/** Fields confirmed in the backend admin photo queue handler. */
export interface AdminKitchenPhoto {
  id: string
  kitchen_id: number
  profile_id: string
  category: PhotoCategory
  content_type: string
  size_bytes: number
  width: number
  height: number
  status: string
  uploaded_by: string
  uploaded_at: string
  kitchen_name: string
  preview_url: string
}

export interface DonationRequest {
  id: string
  donation_id: string
  kitchen_id: number
  requested_by: string
  status: RequestStatus
  submitted_at: string
  reviewed_by: string | null
  reviewed_at: string | null
  donation_status: string
}

export interface AdminUser extends User {
  is_active: boolean
}

export interface Notification {
  id: string
  notification_type: string
  title: string
  body: string
  related_type: string | null
  related_id: string | null
  created_at: string
  read_at: string | null
}

export interface NotificationPage {
  notifications: Notification[]
  unread_count: number
}
