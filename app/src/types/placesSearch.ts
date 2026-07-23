import type { Place } from './place'

/** Live Google Places hit from GET /places/search. */
export interface PlaceSearchResult {
  google_place_id: string
  name: string
  formatted_address: string
  lat: number
  lng: number
  rating: number | null
  user_rating_count: number | null
  business_status: string | null
}

export interface PlaceSearchPage {
  items: PlaceSearchResult[]
  query: string
}

export function placesSearchUid(googlePlaceId: string): string {
  return `gsearch-${googlePlaceId}`
}

/** Map marker / shared list shape derived from a live Places search hit. */
export function searchResultToPlace(r: PlaceSearchResult): Place {
  const bits: string[] = []
  if (r.rating != null) {
    const ratings =
      r.user_rating_count != null ? ` (${r.user_rating_count} reviews)` : ''
    bits.push(`★ ${r.rating.toFixed(1)}${ratings}`)
  }
  if (r.business_status) bits.push(r.business_status.replace(/_/g, ' '))

  return {
    uid: placesSearchUid(r.google_place_id),
    name: r.name,
    lat: r.lat,
    lng: r.lng,
    location: r.formatted_address,
    category: 'Restaurant',
    description: bits.join(' · ') || r.formatted_address,
    listStatus: 'to_try',
  }
}
