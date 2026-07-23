export interface LatLngLike {
  lat: number
  lng: number
}

export interface GeocodeResult extends LatLngLike {
  label: string
}

/*
	- Reverse-geocode coordinates via Nominatim (OpenStreetMap).
	- Falls back to a lat/lng string when the lookup fails.
*/
export async function reverseGeocode(coordinates: LatLngLike): Promise<string> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${coordinates.lat}&lon=${coordinates.lng}&format=json`,
      {
        headers: {
          Accept: 'application/json',
        },
      },
    )
    if (!response.ok) throw new Error('Geocode failed')

    const payload = await response.json()
    const road =
      payload.address?.road ??
      payload.address?.neighbourhood ??
      payload.address?.suburb
    const postcode = payload.address?.postcode
    const parts = [road, postcode ? `Singapore ${postcode}` : 'Singapore'].filter(Boolean)
    return parts.join(', ')
  } catch {
    return `${coordinates.lat.toFixed(5)}, ${coordinates.lng.toFixed(5)}`
  }
}

/*
	- Forward-geocode an address / place name via Nominatim (SG-biased).
*/
export async function forwardGeocode(query: string): Promise<GeocodeResult | null> {
  const term = query.trim()
  if (!term) return null

  try {
    const params = new URLSearchParams({
      q: term,
      format: 'json',
      limit: '1',
      countrycodes: 'sg',
    })
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?${params.toString()}`,
      {
        headers: {
          Accept: 'application/json',
        },
      },
    )
    if (!response.ok) throw new Error('Forward geocode failed')

    const payload = (await response.json()) as Array<{
      lat: string
      lon: string
      display_name?: string
    }>
    const hit = payload[0]
    if (!hit) return null

    const lat = Number(hit.lat)
    const lng = Number(hit.lon)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null

    return {
      lat,
      lng,
      label: hit.display_name || term,
    }
  } catch {
    return null
  }
}
