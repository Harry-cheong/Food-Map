import { apiRequest } from './client'
import type { ItemCreate, ItemResponse } from '../types/place'

/*
	- Typed place endpoints over the shared API client.
*/

export function fetchMyItems() {
  return apiRequest<ItemResponse[]>('/items/me')
}

export function createItem(item: ItemCreate) {
  return apiRequest<ItemResponse>('/items', { method: 'POST', body: item })
}

export function deleteItem(id: number) {
  return apiRequest<{ message: string }>(`/delete/${id}`, { method: 'DELETE' })
}
