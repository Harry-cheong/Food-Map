export interface LatLngLike {
  lat: number
  lng: number
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
