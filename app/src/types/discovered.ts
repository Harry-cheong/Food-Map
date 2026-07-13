import type { Place } from './place'

/** Full row from GET /discovered (HGW → Places confirmation). */
export interface DiscoveredPlace {
  id: number
  source_url: string
  source_title: string | null
  source_category: string | null
  restaurant_name: string
  source_address: string | null
  google_place_id: string
  google_name: string
  formatted_address: string
  lat: number
  lng: number
  rating: number | null
  user_rating_count: number | null
  business_status: string | null
  confirmed_at: string
}

export interface DiscoveredPage {
  items: DiscoveredPlace[]
  total: number
  limit: number
  offset: number
  has_more: boolean
}

export function discoveredUid(id: number): string {
  return `disc-${id}`
}

/** Map marker / shared list shape derived from a discovered place. */
export function discoveredToPlace(d: DiscoveredPlace): Place {
  const bits: string[] = []
  if (d.rating != null) {
    const ratings =
      d.user_rating_count != null ? ` (${d.user_rating_count} reviews)` : ''
    bits.push(`★ ${d.rating.toFixed(1)}${ratings}`)
  }
  if (d.business_status) bits.push(d.business_status.replace(/_/g, ' '))
  if (d.source_title) bits.push(d.source_title)

  return {
    uid: discoveredUid(d.id),
    id: d.id,
    name: d.google_name || d.restaurant_name,
    lat: d.lat,
    lng: d.lng,
    location: d.formatted_address,
    category: d.source_category?.trim() || 'Discovered',
    description: bits.join(' · ') || d.restaurant_name,
  }
}
