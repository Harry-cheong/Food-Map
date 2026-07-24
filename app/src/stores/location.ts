import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import {
  createItem,
  deleteItem,
  fetchDiscovered,
  fetchMyItems,
  searchPlaces,
  searchPlacesNearby,
  updateItemListStatus,
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
import {
  itemToPlace,
  placeToCreate,
  type ListStatus,
  type Place,
} from '../types/place'
import { useAuthStore } from './auth'

export type PlaceFilter = 'personal' | 'following'
export type PersonalListFilter = 'to_try' | 'tried'
export type DiscoveredSort = 'recent' | 'rating' | 'reviews'
export type NearbyRadiusM = 500 | 1000 | 2000 | 5000
export type NearbySort = 'distance' | 'rating' | 'reviews'

export type NewPlaceInput = Omit<Place, 'uid' | 'id'>

const DISCOVERED_PAGE_SIZE = 15
const PLACES_SEARCH_MIN_LEN = 2
export const NEARBY_RADIUS_PRESETS: NearbyRadiusM[] = [500, 1000, 2000, 5000]
export const NEARBY_MIN_RATING_OPTIONS = [null, 3.5, 4, 4.5] as const
export const NEARBY_MIN_REVIEWS_OPTIONS = [null, 25, 50, 100] as const
export type NearbyMinRating = (typeof NEARBY_MIN_RATING_OPTIONS)[number]
export type NearbyMinReviews = (typeof NEARBY_MIN_REVIEWS_OPTIONS)[number]

export const useLocationStore = defineStore('loc', () => {
  const places = ref<Place[]>([])
  const discoveredPlaces = ref<DiscoveredPlace[]>([])
  const discoveredTotal = ref(0)
  const discoveredHasMore = ref(false)
  const discoveredSort = ref<DiscoveredSort>('recent')
  const discoveredSearchQuery = ref('')
  const selected = ref<Place | null>(null)
  const selectedDiscovered = ref<DiscoveredPlace | null>(null)
  const selectedSearchResult = ref<PlaceSearchResult | null>(null)
  const searchQuery = ref('')
  const placesSearchQuery = ref('')
  const placesSearchResults = ref<PlaceSearchResult[]>([])
  const isSearchingPlaces = ref(false)
  const placesSearchError = ref<string | null>(null)
  const nearbyRadiusM = ref<NearbyRadiusM>(1000)
  const nearbyActive = ref(false)
  const nearbySort = ref<NearbySort>('distance')
  const nearbyMinRating = ref<NearbyMinRating>(null)
  const nearbyMinReviews = ref<NearbyMinReviews>(null)
  const activeFilter = ref<PlaceFilter>('personal')
  const personalListFilter = ref<PersonalListFilter>('to_try')
  const isSaving = ref(false)
  const isDeleting = ref(false)
  const isUpdatingListStatus = ref(false)
  const isLoading = ref(false)
  const isLoadingDiscovered = ref(false)
  const actionError = ref<string | null>(null)
  let authBound = false
  let discoveredSearchTimer: ReturnType<typeof setTimeout> | null = null
  let placesSearchTimer: ReturnType<typeof setTimeout> | null = null
  let placesSearchGeneration = 0

  const hasPlacesSearchOverlay = computed(
    () =>
      placesSearchResults.value.length > 0 || selectedSearchResult.value != null,
  )

  const personalPlaces = computed(() =>
    places.value.filter((place) => place.listStatus === personalListFilter.value),
  )

  const toTryCount = computed(
    () => places.value.filter((p) => p.listStatus === 'to_try').length,
  )

  const triedCount = computed(
    () => places.value.filter((p) => p.listStatus === 'tried').length,
  )

  const savedGooglePlaceIds = computed(() => {
    const ids = new Set<string>()
    for (const place of places.value) {
      if (place.googlePlaceId) ids.add(place.googlePlaceId)
    }
    return ids
  })

  const filteredPlaces = computed(() => {
    if (activeFilter.value === 'following') return []

    const q = searchQuery.value.trim().toLowerCase()
    if (!q) return personalPlaces.value

    return personalPlaces.value.filter((place) => {
      const haystack = `${place.name} ${place.location} ${place.category} ${place.description}`.toLowerCase()
      return haystack.includes(q)
    })
  })

  const filteredNearbyResults = computed(() => {
    if (!nearbyActive.value) return []

    const q = searchQuery.value.trim().toLowerCase()
    let results = placesSearchResults.value

    if (q) {
      results = results.filter((place) => {
        const haystack = [
          place.name,
          place.formatted_address,
          place.business_status ?? '',
          place.rating != null ? String(place.rating) : '',
        ]
          .join(' ')
          .toLowerCase()
        return haystack.includes(q)
      })
    }

    const minRating = nearbyMinRating.value
    if (minRating != null) {
      results = results.filter(
        (place) => place.rating != null && place.rating >= minRating,
      )
    }

    const minReviews = nearbyMinReviews.value
    if (minReviews != null) {
      results = results.filter(
        (place) =>
          place.user_rating_count != null && place.user_rating_count >= minReviews,
      )
    }

    if (nearbySort.value === 'distance') return results

    return [...results].sort((a, b) => {
      if (nearbySort.value === 'rating') {
        const ar = a.rating ?? -1
        const br = b.rating ?? -1
        if (br !== ar) return br - ar
        return (b.user_rating_count ?? 0) - (a.user_rating_count ?? 0)
      }

      const ac = a.user_rating_count ?? -1
      const bc = b.user_rating_count ?? -1
      if (bc !== ac) return bc - ac
      return (b.rating ?? 0) - (a.rating ?? 0)
    })
  })

  /** Places currently shown on the map (search overlay or personal). */
  const mapPlaces = computed(() => {
    if (hasPlacesSearchOverlay.value) {
      const source = nearbyActive.value
        ? filteredNearbyResults.value
        : placesSearchResults.value
      const mapped = source.map(searchResultToPlace)
      if (selectedSearchResult.value) {
        const uid = placesSearchUid(selectedSearchResult.value.google_place_id)
        if (!mapped.some((p) => p.uid === uid)) {
          mapped.unshift(searchResultToPlace(selectedSearchResult.value))
        }
      }
      return mapped
    }
    if (activeFilter.value === 'following') return []
    return personalPlaces.value
  })

  const discoveredMapPlaces = computed(() =>
    discoveredPlaces.value.map(discoveredToPlace),
  )

  function isGooglePlaceSaved(googlePlaceId: string | null | undefined): boolean {
    if (!googlePlaceId) return false
    return savedGooglePlaceIds.value.has(googlePlaceId)
  }

  function findByGooglePlaceId(googlePlaceId: string): Place | null {
    return places.value.find((p) => p.googlePlaceId === googlePlaceId) ?? null
  }

  async function resolveConflictPlace(googlePlaceId: string): Promise<Place | null> {
    const existing = findByGooglePlaceId(googlePlaceId)
    if (existing) return existing
    await loadMyPlaces()
    return findByGooglePlaceId(googlePlaceId)
  }

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
      q: discoveredSearchQuery.value,
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
    nearbyActive.value = false

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
    nearbyActive.value = false
    searchQuery.value = ''
  }

  function setNearbyRadius(radius: NearbyRadiusM) {
    nearbyRadiusM.value = radius
  }

  function setNearbySort(sort: NearbySort) {
    nearbySort.value = sort
  }

  function setNearbyMinRating(rating: NearbyMinRating) {
    nearbyMinRating.value = rating
  }

  function setNearbyMinReviews(count: NearbyMinReviews) {
    nearbyMinReviews.value = count
  }

  function resetNearbyFilters() {
    nearbySort.value = 'distance'
    nearbyMinRating.value = null
    nearbyMinReviews.value = null
    searchQuery.value = ''
  }

  async function runNearbySearch(origin: {
    lat: number
    lng: number
  }, radiusM: NearbyRadiusM = nearbyRadiusM.value): Promise<boolean> {
    const generation = ++placesSearchGeneration
    nearbyRadiusM.value = radiusM
    nearbyActive.value = true
    placesSearchQuery.value = ''
    resetNearbyFilters()
    isSearchingPlaces.value = true
    placesSearchError.value = null
    selectedSearchResult.value = null

    const { data, error } = await searchPlacesNearby({
      lat: origin.lat,
      lng: origin.lng,
      radius: radiusM,
    })
    if (generation !== placesSearchGeneration) return false

    if (!data) {
      placesSearchResults.value = []
      placesSearchError.value = error ?? 'Could not search nearby restaurants.'
      isSearchingPlaces.value = false
      return false
    }

    placesSearchResults.value = data.items
    placesSearchError.value = null
    isSearchingPlaces.value = false
    return true
  }

  function clearNearbySearch() {
    clearPlacesSearch()
    resetNearbyFilters()
  }

  async function addNewPlace(
    input: NewPlaceInput,
    opts: { switchToPersonal?: boolean } = {},
  ): Promise<Place | null> {
    const switchToPersonal = opts.switchToPersonal ?? true
    isSaving.value = true
    actionError.value = null

    const payload: NewPlaceInput = {
      ...input,
      listStatus: input.listStatus ?? 'to_try',
    }

    if (payload.googlePlaceId && isGooglePlaceSaved(payload.googlePlaceId)) {
      const existing = findByGooglePlaceId(payload.googlePlaceId)
      isSaving.value = false
      return existing
    }

    const { data, error, status } = await createItem(placeToCreate(payload, true))
    if (!data) {
      if (status === 409 && payload.googlePlaceId) {
        const existing = await resolveConflictPlace(payload.googlePlaceId)
        isSaving.value = false
        return existing
      }
      actionError.value = error ?? 'Could not save this spot. Try again.'
      isSaving.value = false
      return null
    }

    const place = itemToPlace(data)
    if (!places.value.some((p) => p.uid === place.uid)) {
      places.value.push(place)
    }
    if (switchToPersonal) {
      personalListFilter.value = place.listStatus
      activeFilter.value = 'personal'
    }
    isSaving.value = false
    return place
  }

  async function saveSearchResult(
    listStatus: ListStatus = 'to_try',
  ): Promise<Place | null> {
    const result = selectedSearchResult.value
    if (!result) return null

    const auth = useAuthStore()
    if (!auth.isLoggedIn) {
      auth.openLogin()
      return null
    }

    if (isGooglePlaceSaved(result.google_place_id)) {
      return findByGooglePlaceId(result.google_place_id)
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
      listStatus,
      googlePlaceId: result.google_place_id,
    })

    if (!place) return null

    clearPlacesSearch()
    activeFilter.value = 'personal'
    selected.value = place
    selectedDiscovered.value = null
    return place
  }

  async function saveDiscoveredPlace(
    place: DiscoveredPlace,
  ): Promise<Place | null> {
    const auth = useAuthStore()
    if (!auth.isLoggedIn) {
      auth.openLogin()
      return null
    }

    if (isGooglePlaceSaved(place.google_place_id)) {
      return findByGooglePlaceId(place.google_place_id)
    }

    const bits: string[] = []
    if (place.rating != null) {
      const ratings =
        place.user_rating_count != null
          ? ` (${place.user_rating_count} reviews)`
          : ''
      bits.push(`★ ${place.rating.toFixed(1)}${ratings}`)
    }
    if (place.source_title) bits.push(place.source_title)

    return addNewPlace(
      {
        name: place.google_name || place.restaurant_name,
        lat: place.lat,
        lng: place.lng,
        location: place.formatted_address,
        category: place.source_category?.trim() || 'Discovered',
        description: bits.join(' · ') || place.restaurant_name,
        listStatus: 'to_try',
        googlePlaceId: place.google_place_id,
      },
      { switchToPersonal: false },
    )
  }

  async function setPlaceListStatus(
    place: Place,
    listStatus: ListStatus,
  ): Promise<boolean> {
    if (place.id == null) return false
    if (place.listStatus === listStatus) return true

    isUpdatingListStatus.value = true
    actionError.value = null

    const { data, error } = await updateItemListStatus(place.id, {
      list_status: listStatus,
    })

    if (!data) {
      actionError.value = error ?? 'Could not update this spot.'
      isUpdatingListStatus.value = false
      return false
    }

    const updated = itemToPlace(data)
    const index = places.value.findIndex((p) => p.uid === place.uid)
    if (index !== -1) places.value[index] = updated

    if (selected.value?.uid === place.uid) {
      selected.value = updated
    }

    personalListFilter.value = listStatus
    isUpdatingListStatus.value = false
    return true
  }

  async function deletePlace(place: Place): Promise<boolean> {
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
    selectedDiscovered.value = null
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

  function setDiscoveredSearchQuery(query: string) {
    discoveredSearchQuery.value = query
    if (discoveredSearchTimer) clearTimeout(discoveredSearchTimer)
    discoveredSearchTimer = setTimeout(() => {
      void loadDiscovered({ reset: true })
    }, 300)
  }

  function setFilter(filter: PlaceFilter) {
    if (activeFilter.value === filter) return
    activeFilter.value = filter
    clearSelection()
  }

  function setPersonalListFilter(filter: PersonalListFilter) {
    if (personalListFilter.value === filter) return
    personalListFilter.value = filter
    clearSelection()
  }

  function setDiscoveredSort(sort: DiscoveredSort) {
    if (discoveredSort.value === sort) return
    discoveredSort.value = sort
    void loadDiscovered({ reset: true })
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
    discoveredSearchQuery,
    discoveredMapPlaces,
    selected,
    selectedDiscovered,
    selectedSearchResult,
    searchQuery,
    placesSearchQuery,
    placesSearchResults,
    isSearchingPlaces,
    placesSearchError,
    nearbyRadiusM,
    nearbyActive,
    nearbySort,
    nearbyMinRating,
    nearbyMinReviews,
    hasPlacesSearchOverlay,
    activeFilter,
    personalListFilter,
    personalPlaces,
    toTryCount,
    triedCount,
    filteredPlaces,
    filteredNearbyResults,
    mapPlaces,
    isSaving,
    isDeleting,
    isUpdatingListStatus,
    isLoading,
    isLoadingDiscovered,
    actionError,
    loadMyPlaces,
    loadDiscovered,
    runPlacesSearch,
    setPlacesSearchQuery,
    clearPlacesSearch,
    setNearbyRadius,
    setNearbySort,
    setNearbyMinRating,
    setNearbyMinReviews,
    runNearbySearch,
    clearNearbySearch,
    saveSearchResult,
    saveDiscoveredPlace,
    isGooglePlaceSaved,
    addNewPlace,
    setPlaceListStatus,
    deletePlace,
    selectPlace,
    selectDiscovered,
    selectSearchResult,
    clearSelection,
    setSearchQuery,
    setDiscoveredSearchQuery,
    setFilter,
    setPersonalListFilter,
    setDiscoveredSort,
    clearPlaces,
    bindAuthSession,
  }
})
