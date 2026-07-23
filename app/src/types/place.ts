/*
	- Shared place + API shapes (serializable app data only — no Leaflet objects).
*/

export type ListStatus = 'to_try' | 'tried'

export interface Place {
  /* Stable client key for list/map sync (`id-123` once saved). */
  uid: string
  id?: number
  name: string
  lat: number
  lng: number
  /* Human-readable address */
  location: string
  category: string
  description: string
  listStatus: ListStatus
}

export interface ItemCreate {
  name: string
  lat: number
  lng: number
  location: string
  category: string
  description: string
  public: boolean
  list_status: ListStatus
}

export interface ItemResponse extends ItemCreate {
  id: number
  submitted_by_user_id: number
  created_at: string
}

export interface ItemListStatusUpdate {
  list_status: ListStatus
}

export function itemToPlace(item: ItemResponse): Place {
  return {
    uid: `id-${item.id}`,
    id: item.id,
    name: item.name,
    lat: item.lat,
    lng: item.lng,
    location: item.location,
    category: item.category,
    description: item.description,
    listStatus: item.list_status ?? 'to_try',
  }
}

export function placeToCreate(
  place: Omit<Place, 'uid' | 'id'>,
  isPublic = true,
): ItemCreate {
  return {
    name: place.name,
    lat: place.lat,
    lng: place.lng,
    location: place.location,
    category: place.category,
    description: place.description,
    public: isPublic,
    list_status: place.listStatus ?? 'to_try',
  }
}
