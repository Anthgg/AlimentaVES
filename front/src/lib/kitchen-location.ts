import type { CommunityKitchen } from '../types'

export function hasValidCoordinates(kitchen: CommunityKitchen): kitchen is CommunityKitchen & { latitude: number; longitude: number } {
  return typeof kitchen.latitude === 'number'
    && typeof kitchen.longitude === 'number'
    && Number.isFinite(kitchen.latitude)
    && Number.isFinite(kitchen.longitude)
    && Math.abs(kitchen.latitude) <= 90
    && Math.abs(kitchen.longitude) <= 180
}

export function openStreetMapUrl(kitchen: CommunityKitchen): string | null {
  if (!hasValidCoordinates(kitchen)) return null
  const { latitude, longitude } = kitchen
  const params = new URLSearchParams({ mlat: String(latitude), mlon: String(longitude) })
  return `https://www.openstreetmap.org/?${params.toString()}#map=16/${latitude}/${longitude}`
}
