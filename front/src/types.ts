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
