import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import {
  createItem,
  deleteItem,
  fetchDiscovered,
  fetchMyItems,
  searchPlaces,
} from '../api/places'
import {
  discoveredToPlace,
  type DiscoveredPlace,
} from '../types/discovered'
import {
  placesSearchUid,
  searchResultToPlace,
  type PlaceSearchResult,
} from '../types/placesSearch'
import { itemToPlace, placeToCreate, type Place } from '../types/place'
import { useAuthStore } from './auth'

export type PlaceFilter = 'personal' | 'following' | 'discovered'
export type DiscoveredSort = 'recent' | 'rating' | 'reviews'

export type NewPlaceInput = Omit<Place, 'uid' | 'id'>

const DISCOVERED_PAGE_SIZE = 15
const PLACES_SEARCH_MIN_LEN = 2

export const useLocationStore = defineStore('loc', () => {
  const places = ref<Place[]>([])
  const discoveredPlaces = ref<DiscoveredPlace[]>([])
  const discoveredTotal = ref(0)
  const discoveredHasMore = ref(false)
  const discoveredSort = ref<DiscoveredSort>('recent')
  const selected = ref<Place | null>(null)
  const selectedDiscovered = ref<DiscoveredPlace | null>(null)
  const selectedSearchResult = ref<PlaceSearchResult | null>(null)
  const searchQuery = ref('')
  const placesSearchQuery = ref('')
  const placesSearchResults = ref<PlaceSearchResult[]>([])
  const isSearchingPlaces = ref(false)
  const placesSearchError = ref<string | null>(null)
  const activeFilter = ref<PlaceFilter>('personal')
  const isSaving = ref(false)
  const isDeleting = ref(false)
  const isLoading = ref(false)
  const isLoadingDiscovered = ref(false)
  const actionError = ref<string | null>(null)
  let authBound = false
  let searchTimer: ReturnType<typeof setTimeout> | null = null
  let placesSearchTimer: ReturnType<typeof setTimeout> | null = null
  let placesSearchGeneration = 0

  const hasPlacesSearchOverlay = computed(
    () =>
      placesSearchResults.value.length > 0 || selectedSearchResult.value != null,
  )

  const filteredPlaces = computed(() => {
    if (activeFilter.value === 'following') return []
    if (activeFilter.value === 'discovered') {
      return discoveredPlaces.value.map(discoveredToPlace)
    }

    const q = searchQuery.value.trim().toLowerCase()
    if (!q) return places.value

    return places.value.filter((place) => {
      const haystack = `${place.name} ${place.location} ${place.category} ${place.description}`.toLowerCase()
      return haystack.includes(q)
    })
  })

  /** Places currently shown on the map (search overlay, personal, or discovered). */
  const mapPlaces = computed(() => {
    if (hasPlacesSearchOverlay.value) {
      const mapped = placesSearchResults.value.map(searchResultToPlace)
      if (selectedSearchResult.value) {
        const uid = placesSearchUid(selectedSearchResult.value.google_place_id)
        if (!mapped.some((p) => p.uid === uid)) {
          mapped.unshift(searchResultToPlace(selectedSearchResult.value))
        }
      }
      return mapped
    }
    if (activeFilter.value === 'discovered') {
      return discoveredPlaces.value.map(discoveredToPlace)
    }
    if (activeFilter.value === 'following') return []
    return places.value
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
    selectedDiscovered.value = null
    selectedSearchResult.value = null
    isLoading.value = false
    return true
  }

  async function loadDiscovered(opts: { reset?: boolean } = {}): Promise<boolean> {
    const reset = opts.reset ?? false
    if (isLoadingDiscovered.value) return false
    if (!reset && !discoveredHasMore.value) return false

    isLoadingDiscovered.value = true
    actionError.value = null

    const offset = reset ? 0 : discoveredPlaces.value.length
    const { data, error } = await fetchDiscovered({
      limit: DISCOVERED_PAGE_SIZE,
      offset,
      q: searchQuery.value,
      sort: discoveredSort.value,
    })

    if (!data) {
      actionError.value = error ?? 'Could not load discovered places.'
      isLoadingDiscovered.value = false
      return false
    }

    if (reset) {
      discoveredPlaces.value = data.items
      selected.value = null
      selectedDiscovered.value = null
      selectedSearchResult.value = null
    } else {
      const seen = new Set(discoveredPlaces.value.map((d) => d.id))
      for (const item of data.items) {
        if (!seen.has(item.id)) discoveredPlaces.value.push(item)
      }
    }

    discoveredTotal.value = data.total
    discoveredHasMore.value = data.has_more
    isLoadingDiscovered.value = false
    return true
  }

  async function runPlacesSearch(query: string): Promise<void> {
    const term = query.trim()
    const generation = ++placesSearchGeneration

    if (term.length < PLACES_SEARCH_MIN_LEN) {
      placesSearchResults.value = []
      placesSearchError.value = null
      isSearchingPlaces.value = false
      return
    }

    isSearchingPlaces.value = true
    placesSearchError.value = null

    const { data, error } = await searchPlaces(term)
    if (generation !== placesSearchGeneration) return

    if (!data) {
      placesSearchResults.value = []
      placesSearchError.value = error ?? 'Could not search restaurants.'
      isSearchingPlaces.value = false
      return
    }

    placesSearchResults.value = data.items
    placesSearchError.value = null
    isSearchingPlaces.value = false
  }

  function setPlacesSearchQuery(query: string) {
    placesSearchQuery.value = query
    if (placesSearchTimer) clearTimeout(placesSearchTimer)

    const term = query.trim()
    if (term.length < PLACES_SEARCH_MIN_LEN) {
      placesSearchGeneration += 1
      placesSearchResults.value = []
      placesSearchError.value = null
      isSearchingPlaces.value = false
      return
    }

    placesSearchTimer = setTimeout(() => {
      void runPlacesSearch(term)
    }, 300)
  }

  function clearPlacesSearch() {
    if (placesSearchTimer) clearTimeout(placesSearchTimer)
    placesSearchGeneration += 1
    placesSearchQuery.value = ''
    placesSearchResults.value = []
    placesSearchError.value = null
    isSearchingPlaces.value = false
    selectedSearchResult.value = null
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

  async function saveSearchResult(): Promise<Place | null> {
    const result = selectedSearchResult.value
    if (!result) return null

    const auth = useAuthStore()
    if (!auth.isLoggedIn) {
      auth.openLogin()
      return null
    }

    const bits: string[] = []
    if (result.rating != null) {
      const ratings =
        result.user_rating_count != null
          ? ` (${result.user_rating_count} reviews)`
          : ''
      bits.push(`★ ${result.rating.toFixed(1)}${ratings}`)
    }

    const place = await addNewPlace({
      name: result.name,
      lat: result.lat,
      lng: result.lng,
      location: result.formatted_address,
      category: 'Restaurant',
      description: bits.join(' · '),
    })

    if (!place) return null

    clearPlacesSearch()
    activeFilter.value = 'personal'
    selected.value = place
    selectedDiscovered.value = null
    return place
  }

  async function deletePlace(place: Place): Promise<boolean> {
    if (activeFilter.value === 'discovered') return false
    if (hasPlacesSearchOverlay.value) return false

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
    if (selected.value?.uid === place.uid) {
      selected.value = null
      selectedDiscovered.value = null
      selectedSearchResult.value = null
    }

    isDeleting.value = false
    return true
  }

  function selectPlace(place: Place) {
    if (hasPlacesSearchOverlay.value) {
      const hit =
        placesSearchResults.value.find(
          (r) => placesSearchUid(r.google_place_id) === place.uid,
        ) ??
        (selectedSearchResult.value &&
        placesSearchUid(selectedSearchResult.value.google_place_id) === place.uid
          ? selectedSearchResult.value
          : null)
      if (hit) {
        selectSearchResult(hit)
        return
      }
    }

    selected.value = place
    selectedSearchResult.value = null
    if (activeFilter.value === 'discovered' && place.id != null) {
      selectedDiscovered.value =
        discoveredPlaces.value.find((d) => d.id === place.id) ?? null
    } else {
      selectedDiscovered.value = null
    }
  }

  function selectDiscovered(place: DiscoveredPlace) {
    selectedDiscovered.value = place
    selectedSearchResult.value = null
    selected.value = discoveredToPlace(place)
  }

  function selectSearchResult(place: PlaceSearchResult) {
    selectedSearchResult.value = place
    selectedDiscovered.value = null
    selected.value = searchResultToPlace(place)
  }

  function clearSelection() {
    selected.value = null
    selectedDiscovered.value = null
    selectedSearchResult.value = null
  }

  function setSearchQuery(query: string) {
    searchQuery.value = query
  }

  function setFilter(filter: PlaceFilter) {
    if (activeFilter.value === filter) return
    activeFilter.value = filter
    clearSelection()

    if (filter === 'discovered') {
      void loadDiscovered({ reset: true })
    }
  }

  function setDiscoveredSort(sort: DiscoveredSort) {
    if (discoveredSort.value === sort) return
    discoveredSort.value = sort
    if (activeFilter.value === 'discovered') {
      void loadDiscovered({ reset: true })
    }
  }

  function clearPlaces() {
    places.value = []
    clearSelection()
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

    watch(searchQuery, () => {
      if (activeFilter.value !== 'discovered') return
      if (searchTimer) clearTimeout(searchTimer)
      searchTimer = setTimeout(() => {
        void loadDiscovered({ reset: true })
      }, 300)
    })

    if (auth.isLoggedIn) {
      void loadMyPlaces()
    }
  }

  return {
    places,
    discoveredPlaces,
    discoveredTotal,
    discoveredHasMore,
    discoveredSort,
    selected,
    selectedDiscovered,
    selectedSearchResult,
    searchQuery,
    placesSearchQuery,
    placesSearchResults,
    isSearchingPlaces,
    placesSearchError,
    hasPlacesSearchOverlay,
    activeFilter,
    filteredPlaces,
    mapPlaces,
    isSaving,
    isDeleting,
    isLoading,
    isLoadingDiscovered,
    actionError,
    loadMyPlaces,
    loadDiscovered,
    runPlacesSearch,
    setPlacesSearchQuery,
    clearPlacesSearch,
    saveSearchResult,
    addNewPlace,
    deletePlace,
    selectPlace,
    selectDiscovered,
    selectSearchResult,
    clearSelection,
    setSearchQuery,
    setFilter,
    setDiscoveredSort,
    clearPlaces,
    bindAuthSession,
  }
})
