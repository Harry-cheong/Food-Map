import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { createItem, deleteItem, fetchMyItems } from '../api/places'
import { itemToPlace, placeToCreate, type Place } from '../types/place'
import { useAuthStore } from './auth'

export type PlaceFilter = 'personal' | 'following'

export type NewPlaceInput = Omit<Place, 'uid' | 'id'>

export const useLocationStore = defineStore('loc', () => {
  const places = ref<Place[]>([])
  const selected = ref<Place | null>(null)
  const searchQuery = ref('')
  const activeFilter = ref<PlaceFilter>('personal')
  const isSaving = ref(false)
  const isDeleting = ref(false)
  const isLoading = ref(false)
  const actionError = ref<string | null>(null)
  let authBound = false

  const filteredPlaces = computed(() => {
    if (activeFilter.value === 'following') return []

    const q = searchQuery.value.trim().toLowerCase()
    if (!q) return places.value

    return places.value.filter((place) => {
      const haystack = `${place.name} ${place.location} ${place.category} ${place.description}`.toLowerCase()
      return haystack.includes(q)
    })
  })

  async function loadMyPlaces(): Promise<boolean> {
    isLoading.value = true
    actionError.value = null

    const { data, error } = await fetchMyItems()
    if (!data) {
      actionError.value = error ?? 'Could not load your spots.'
      isLoading.value = false
      return false
    }

    places.value = data.map(itemToPlace)
    selected.value = null
    isLoading.value = false
    return true
  }

  async function addNewPlace(input: NewPlaceInput): Promise<Place | null> {
    isSaving.value = true
    actionError.value = null

    const { data, error } = await createItem(placeToCreate(input, true))
    if (!data) {
      actionError.value = error ?? 'Could not save this spot. Try again.'
      isSaving.value = false
      return null
    }

    const place = itemToPlace(data)
    places.value.push(place)
    isSaving.value = false
    return place
  }

  async function deletePlace(place: Place): Promise<boolean> {
    isDeleting.value = true
    actionError.value = null

    if (place.id != null) {
      const { error } = await deleteItem(place.id)
      if (error) {
        actionError.value = error
        isDeleting.value = false
        return false
      }
    }

    const index = places.value.findIndex((p) => p.uid === place.uid)
    if (index !== -1) places.value.splice(index, 1)
    if (selected.value?.uid === place.uid) selected.value = null

    isDeleting.value = false
    return true
  }

  function selectPlace(place: Place) {
    selected.value = place
  }

  function setSearchQuery(query: string) {
    searchQuery.value = query
  }

  function setFilter(filter: PlaceFilter) {
    activeFilter.value = filter
  }

  function clearPlaces() {
    places.value = []
    selected.value = null
  }

  /*
  	- Store owns place data lifecycle around auth:
	- login / session restore → load spots; logout → clear.
	- Call once from main.ts after Pinia is installed.
  */
  function bindAuthSession() {
    if (authBound) return
    authBound = true

    const auth = useAuthStore()

    watch(
      () => auth.token,
      (newVal, oldVal) => {
        if (newVal && newVal !== oldVal) {
          void loadMyPlaces()
        }
        if (!newVal && oldVal) {
          clearPlaces()
        }
      },
    )

    if (auth.isLoggedIn) {
      void loadMyPlaces()
    }
  }

  return {
    places,
    selected,
    searchQuery,
    activeFilter,
    filteredPlaces,
    isSaving,
    isDeleting,
    isLoading,
    actionError,
    loadMyPlaces,
    addNewPlace,
    deletePlace,
    selectPlace,
    setSearchQuery,
    setFilter,
    clearPlaces,
    bindAuthSession,
  }
})
