import { apiRequest } from './client'
import type { DiscoveredPage } from '../types/discovered'
import type { PlaceSearchPage } from '../types/placesSearch'
import type {
  ItemCreate,
  ItemListStatusUpdate,
  ItemResponse,
} from '../types/place'

/*
	- Typed place endpoints over the shared API client.
*/

export function fetchMyItems() {
  return apiRequest<ItemResponse[]>('/items/me')
}

export function createItem(item: ItemCreate) {
  return apiRequest<ItemResponse>('/items', { method: 'POST', body: item })
}

export function updateItemListStatus(id: number, body: ItemListStatusUpdate) {
  return apiRequest<ItemResponse>(`/items/${id}`, { method: 'PATCH', body })
}

export function deleteItem(id: number) {
  return apiRequest<{ message: string }>(`/delete/${id}`, { method: 'DELETE' })
}

export function fetchDiscovered(params: {
  limit?: number
  offset?: number
  q?: string
  sort?: 'recent' | 'rating' | 'reviews'
} = {}) {
  const search = new URLSearchParams()
  search.set('limit', String(params.limit ?? 15))
  search.set('offset', String(params.offset ?? 0))
  search.set('sort', params.sort ?? 'recent')
  const q = params.q?.trim()
  if (q) search.set('q', q)

  return apiRequest<DiscoveredPage>(`/discovered?${search.toString()}`, {
    auth: false,
  })
}

export function searchPlaces(q: string) {
  const search = new URLSearchParams()
  search.set('q', q.trim())
  return apiRequest<PlaceSearchPage>(`/places/search?${search.toString()}`, {
    auth: false,
  })
}

export function searchPlacesNearby(params: {
  lat: number
  lng: number
  radius: number
}) {
  const search = new URLSearchParams()
  search.set('lat', String(params.lat))
  search.set('lng', String(params.lng))
  search.set('radius', String(params.radius))
  return apiRequest<PlaceSearchPage>(`/places/nearby?${search.toString()}`, {
    auth: false,
  })
}
