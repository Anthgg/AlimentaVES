export type DonationStatus = 'available' | 'reserved' | 'delivered'

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
