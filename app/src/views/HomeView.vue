<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import type { LatLngTuple } from 'leaflet'
import NavigationBar from '../components/NavigationBar.vue'
import Sidebar from '../components/Sidebar.vue'
import PinLabelModal from '../components/PinLabelModal.vue'
import { useAuthStore } from '../stores/auth'
import {
  NEARBY_RADIUS_PRESETS,
  useLocationStore,
  type NearbyRadiusM,
} from '../stores/location'
import { useMap } from '../composables/useMap'
import { useUserLocation } from '../composables/useUserLocation'
import { forwardGeocode, reverseGeocode } from '../composables/useGeocode'
import { categoryAccent } from '../constants/categories'
import { googleSearchUrl } from '../utils/googleSearch'
import { storeToRefs } from 'pinia'
import type { ListStatus } from '../types/place'

const props = defineProps<{
  showLogin?: boolean
  center?: LatLngTuple
  zoom?: number
}>()

const locStore = useLocationStore()
const auth = useAuthStore()
const { mapPlaces, selected, nearbyRadiusM, nearbyActive, isSearchingPlaces } =
  storeToRefs(locStore)

const sidebarRef = ref<InstanceType<typeof Sidebar> | null>(null)

const selectedSavedDate = computed(() => {
  const iso = selected.value?.createdAt
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
})

const selectedSearchGoogleUrl = computed(() => {
  const place = locStore.selectedSearchResult
  if (!place) return null
  return googleSearchUrl(place.name, place.formatted_address)
})

const selectedPlaceGoogleUrl = computed(() => {
  const place = selected.value
  if (!place) return null
  return googleSearchUrl(place.name, place.location)
})

if (props.showLogin) {
  auth.openLogin()
}

const pendingCoord = ref<{ lat: number; lng: number } | null>(null)
const addressHint = ref<string | null>(null)
const pinError = ref<string | null>(null)
const resolvingAddress = ref(false)

const setLocationOpen = ref(false)
const nearMeOpen = ref(false)
const originDraggable = ref(false)
const addPinMode = ref(false)
const addressQuery = ref('')
const addressError = ref<string | null>(null)
const isResolvingAddress = ref(false)
const originLabel = ref<string | null>(null)
const setLocationPanel = ref<HTMLElement | null>(null)
const nearMePanel = ref<HTMLElement | null>(null)

const searchRadiusM = computed<number | null>(() =>
  nearbyActive.value ? nearbyRadiusM.value : null,
)

function placeOriginAt(latlng: { lat: number; lng: number }) {
  setManualPosition(latlng.lat, latlng.lng)
  originLabel.value = null
  void reverseGeocode(latlng).then((label) => {
    originLabel.value = label
  })
  if (nearbyActive.value) {
    sidebarRef.value?.ensureVisible()
    void locStore.runNearbySearch(latlng, nearbyRadiusM.value).then((ok) => {
      if (ok) focusSearchRadius()
    })
  }
}

function onMapClick(latlng: { lat: number; lng: number }) {
  /*
  	- While placing the search origin, map taps move the pin instead of opening
  	- the add-spot modal.
  	- Add-spot only runs when the map-control toggle is active.
  */
  if (originDraggable.value) {
    placeOriginAt(latlng)
    return
  }

  if (!addPinMode.value) return
  if (locStore.hasPlacesSearchOverlay) return
  if (setLocationOpen.value || nearMeOpen.value) return

  if (!auth.isLoggedIn) {
    auth.openLogin()
    return
  }

  pendingCoord.value = latlng
  addressHint.value = null
  pinError.value = null
  resolvingAddress.value = true

  void reverseGeocode(latlng).then((addr) => {
    if (
      pendingCoord.value?.lat === latlng.lat &&
      pendingCoord.value?.lng === latlng.lng
    ) {
      addressHint.value = addr
      resolvingAddress.value = false
    }
  })
}

const {
  position: userPosition,
  originSource,
  isTracking,
  isLocating,
  error: locationError,
  start: startUserLocation,
  setManualPosition,
} = useUserLocation()

function onOriginDragEnd(latlng: { lat: number; lng: number }) {
  placeOriginAt(latlng)
}

const { mapEl, init, reload, focusUserLocation, focusSearchRadius } = useMap({
  center: props.center,
  zoom: props.zoom,
  places: mapPlaces,
  selected,
  userPosition,
  originSource,
  originDraggable,
  searchRadiusM,
  onMapClick,
  onSelectPlace: (place) => locStore.selectPlace(place),
  onOriginDragEnd,
})

const locateTitle = computed(() => {
  if (locationError.value === 'denied') return 'Location permission denied'
  if (locationError.value === 'timeout') return 'Location timed out — try again'
  if (locationError.value === 'unavailable') return 'Location unavailable'
  if (isLocating.value) return 'Finding your location…'
  if (isTracking.value || originSource.value === 'gps') return 'Center on my location'
  return 'Show my location'
})

const hasOrigin = computed(() => userPosition.value != null)

const originStatusText = computed(() => {
  if (!userPosition.value) return 'No location set yet'
  if (originSource.value === 'manual') {
    return originLabel.value ?? 'Custom location (drag or address)'
  }
  return 'Using GPS location'
})

function formatRadius(meters: NearbyRadiusM): string {
  if (meters < 1000) return `${meters}m`
  return `${meters / 1000}km`
}

async function onLocateClick() {
  setLocationOpen.value = false
  nearMeOpen.value = false
  originDraggable.value = false
  addPinMode.value = false

  if ((isTracking.value || originSource.value === 'gps') && userPosition.value) {
    focusUserLocation()
    return
  }

  const pos = await startUserLocation()
  if (pos) {
    originLabel.value = null
    focusUserLocation()
  }
}

function toggleAddPinMode() {
  if (!auth.isLoggedIn) {
    auth.openLogin()
    return
  }

  setLocationOpen.value = false
  nearMeOpen.value = false
  originDraggable.value = false
  addPinMode.value = !addPinMode.value
}

function toggleSetLocation() {
  nearMeOpen.value = false
  addPinMode.value = false
  setLocationOpen.value = !setLocationOpen.value
}

function toggleNearMe() {
  setLocationOpen.value = false
  addPinMode.value = false
  nearMeOpen.value = !nearMeOpen.value
}

function toggleDragPin() {
  if (!userPosition.value) {
    const center = props.center ?? ([1.3521, 103.8198] as LatLngTuple)
    setManualPosition(center[0], center[1])
    originLabel.value = 'Map center - drag or tap to adjust'
    focusUserLocation()
  }
  addPinMode.value = false
  originDraggable.value = !originDraggable.value
  if (originDraggable.value) setLocationOpen.value = true
}

function finishPlacingOrigin() {
  originDraggable.value = false
}

async function submitAddressLocation() {
  addressError.value = null
  const term = addressQuery.value.trim()
  if (!term) {
    addressError.value = 'Enter an address or place name'
    return
  }

  isResolvingAddress.value = true
  const hit = await forwardGeocode(term)
  isResolvingAddress.value = false

  if (!hit) {
    addressError.value = 'Could not find that place in Singapore'
    return
  }

  setManualPosition(hit.lat, hit.lng)
  originLabel.value = hit.label
  originDraggable.value = false
  addressQuery.value = ''
  focusUserLocation()
}

async function runNearMeSearch(radius: NearbyRadiusM = nearbyRadiusM.value) {
  if (!userPosition.value) {
    nearMeOpen.value = true
    return
  }

  locStore.setNearbyRadius(radius)
  sidebarRef.value?.ensureVisible()
  const ok = await locStore.runNearbySearch(userPosition.value, radius)
  if (ok) focusSearchRadius()
}

function clearNearby() {
  locStore.clearNearbySearch()
  nearMeOpen.value = false
}

async function saveLabeledPin(payload: {
  name: string
  category: string
  description: string
  listStatus: ListStatus
}) {
  if (!pendingCoord.value) return

  pinError.value = null
  const coordinates = pendingCoord.value
  const location = addressHint.value ?? (await reverseGeocode(coordinates))

  const place = await locStore.addNewPlace({
    name: payload.name,
    lat: coordinates.lat,
    lng: coordinates.lng,
    location,
    category: payload.category,
    description: payload.description,
    listStatus: payload.listStatus,
  })

  if (!place) {
    pinError.value = locStore.actionError
    return
  }

  pendingCoord.value = null
  addressHint.value = null
  addPinMode.value = false
  locStore.selectPlace(place)
}

async function saveSelectedSearchResult(listStatus: ListStatus = 'to_try') {
  await locStore.saveSearchResult(listStatus)
}

function cancelPinLabel() {
  if (locStore.isSaving) return
  pendingCoord.value = null
  addressHint.value = null
  pinError.value = null
  resolvingAddress.value = false
}

function onDocumentPointerDown(event: PointerEvent) {
  const target = event.target
  if (!(target instanceof Node)) return

  /*
  	- Outside click closes the set-location panel, but keeps drag mode so map
  	- taps/drags still move the origin instead of opening add-spot.
  */
  if (
    setLocationOpen.value &&
    setLocationPanel.value &&
    !setLocationPanel.value.contains(target)
  ) {
    const btn = (target as HTMLElement).closest?.('.map-control--set-location')
    if (!btn) setLocationOpen.value = false
  }

  if (nearMeOpen.value && nearMePanel.value && !nearMePanel.value.contains(target)) {
    const btn = (target as HTMLElement).closest?.('.map-control--near-me')
    if (!btn) nearMeOpen.value = false
  }
}

onMounted(() => {
  init()
  document.addEventListener('pointerdown', onDocumentPointerDown)
})

onUnmounted(() => {
  document.removeEventListener('pointerdown', onDocumentPointerDown)
})

/*
	- Keep the Leaflet container ref referenced for vue-tsc (also used as template ref).
*/
void mapEl
</script>

<template>
  <div class="page">
    <NavigationBar />

    <div class="shell">
      <Sidebar ref="sidebarRef" />

      <div class="map-wrap">
        <div ref="mapEl" class="map-el"></div>

        <div class="map-hint">
          <i
            :class="
              originDraggable
                ? 'mdi mdi-cursor-move'
                : addPinMode
                  ? 'mdi mdi-map-marker-plus'
                  : 'mdi mdi-cursor-default-click'
            "
          ></i>
          <template v-if="originDraggable">
            Drag the orange pin, or tap the map to place your search location
          </template>
          <template v-else-if="addPinMode">
            Tap the map to pin a food spot
          </template>
          <template v-else>
            Use the + button to add a spot
          </template>
        </div>

        <button
          class="map-control map-control--list"
          type="button"
          title="Your spots"
          @click.stop="sidebarRef?.openMobile()"
        >
          <i class="mdi mdi-format-list-bulleted"></i>
        </button>

        <button class="map-control" type="button" title="Refresh map" @click.stop="reload">
          <i class="mdi mdi-refresh"></i>
        </button>

        <button
          class="map-control map-control--add"
          type="button"
          :class="{ 'map-control--active': addPinMode }"
          title="Add a spot"
          aria-label="Add a spot"
          :aria-pressed="addPinMode"
          @click.stop="toggleAddPinMode"
        >
          <i class="mdi mdi-map-marker-plus"></i>
        </button>

        <button
          class="map-control map-control--locate"
          type="button"
          :class="{
            'map-control--active': (isTracking || originSource === 'gps') && !locationError,
            'map-control--error': !!locationError,
          }"
          :title="locateTitle"
          :aria-label="locateTitle"
          :disabled="isLocating"
          @click.stop="onLocateClick"
        >
          <i
            :class="isLocating ? 'mdi mdi-loading mdi-spin' : 'mdi mdi-crosshairs-gps'"
          ></i>
        </button>

        <button
          class="map-control map-control--set-location"
          type="button"
          :class="{
            'map-control--active': setLocationOpen || originSource === 'manual' || originDraggable,
          }"
          title="Set search location"
          aria-label="Set search location"
          :aria-expanded="setLocationOpen"
          @click.stop="toggleSetLocation"
        >
          <i class="mdi mdi-map-marker-radius-outline"></i>
        </button>

        <button
          class="map-control map-control--near-me"
          type="button"
          :class="{
            'map-control--active': nearMeOpen || nearbyActive,
          }"
          title="Find restaurants nearby"
          aria-label="Find restaurants nearby"
          :aria-expanded="nearMeOpen"
          :disabled="isSearchingPlaces && nearbyActive"
          @click.stop="toggleNearMe"
        >
          <i
            :class="
              isSearchingPlaces && nearbyActive
                ? 'mdi mdi-loading mdi-spin'
                : 'mdi mdi-store-search-outline'
            "
          ></i>
        </button>

        <div
          v-if="setLocationOpen"
          ref="setLocationPanel"
          class="map-panel map-panel--set-location"
          @click.stop
        >
          <p class="map-panel-title">Set location</p>
          <p class="map-panel-status">{{ originStatusText }}</p>
          <form class="map-panel-form" @submit.prevent="submitAddressLocation">
            <input
              v-model="addressQuery"
              class="map-panel-input"
              type="text"
              placeholder="Address or place in Singapore"
              autocomplete="off"
              :disabled="isResolvingAddress"
            />
            <button
              class="map-panel-btn"
              type="submit"
              :disabled="isResolvingAddress"
            >
              {{ isResolvingAddress ? 'Finding…' : 'Go' }}
            </button>
          </form>
          <p v-if="addressError" class="map-panel-error">{{ addressError }}</p>
          <button
            class="map-panel-btn map-panel-btn--secondary"
            type="button"
            :class="{ 'map-panel-btn--active': originDraggable }"
            @click="toggleDragPin"
          >
            <i class="mdi mdi-cursor-move"></i>
            {{ originDraggable ? 'Placing pin…' : 'Place pin on map' }}
          </button>
          <button
            v-if="originDraggable"
            class="map-panel-btn"
            type="button"
            @click="finishPlacingOrigin"
          >
            Done placing
          </button>
          <p v-if="originDraggable" class="map-panel-status">
            Drag the orange pin, or tap anywhere on the map to move it.
          </p>
        </div>

        <div
          v-if="nearMeOpen"
          ref="nearMePanel"
          class="map-panel map-panel--near-me"
          @click.stop
        >
          <p class="map-panel-title">Near me</p>
          <p class="map-panel-status">
            {{
              hasOrigin
                ? 'Choose a radius, then search for restaurants'
                : 'Set or locate your position first'
            }}
          </p>
          <div class="map-panel-radii">
            <button
              v-for="radius in NEARBY_RADIUS_PRESETS"
              :key="radius"
              class="map-panel-chip"
              type="button"
              :class="{ 'map-panel-chip--active': nearbyRadiusM === radius }"
              :disabled="!hasOrigin || isSearchingPlaces"
              @click="runNearMeSearch(radius)"
            >
              {{ formatRadius(radius) }}
            </button>
          </div>
          <div class="map-panel-actions">
            <button
              class="map-panel-btn"
              type="button"
              :disabled="!hasOrigin || isSearchingPlaces"
              @click="runNearMeSearch()"
            >
              {{ isSearchingPlaces && nearbyActive ? 'Searching…' : 'Search nearby' }}
            </button>
            <button
              v-if="nearbyActive"
              class="map-panel-btn map-panel-btn--secondary"
              type="button"
              @click="clearNearby"
            >
              Clear
            </button>
          </div>
          <p v-if="locStore.placesSearchError && nearbyActive" class="map-panel-error">
            {{ locStore.placesSearchError }}
          </p>
        </div>

        <Transition name="focus-card">
          <div
            class="focus-card"
            :class="{
              'focus-card--discovered': locStore.selectedSearchResult,
            }"
            v-if="locStore.selectedSearchResult || locStore.selected"
          >
            <template v-if="locStore.selectedSearchResult">
              <div class="focus-card-icon">
                <i :class="nearbyActive ? 'mdi mdi-store-search-outline' : 'mdi mdi-magnify'"></i>
              </div>
              <div class="focus-card-body">
                <p class="focus-card-label">
                  {{ nearbyActive ? 'Nearby result' : 'Search result' }}
                </p>
                <p class="focus-card-title">{{ locStore.selectedSearchResult.name }}</p>
                <dl class="focus-details">
                  <div>
                    <dt>Address</dt>
                    <dd>{{ locStore.selectedSearchResult.formatted_address }}</dd>
                  </div>
                  <div v-if="locStore.selectedSearchResult.rating != null">
                    <dt>Rating</dt>
                    <dd>
                      ★ {{ locStore.selectedSearchResult.rating.toFixed(1) }}
                      <template v-if="locStore.selectedSearchResult.user_rating_count != null">
                        ({{ locStore.selectedSearchResult.user_rating_count }} reviews)
                      </template>
                    </dd>
                  </div>
                  <div v-if="locStore.selectedSearchResult.business_status">
                    <dt>Status</dt>
                    <dd class="capitalize">
                      {{ locStore.selectedSearchResult.business_status.replace(/_/g, ' ').toLowerCase() }}
                    </dd>
                  </div>
                </dl>
                <div class="focus-card-actions">
                  <a
                    v-if="selectedSearchGoogleUrl"
                    class="focus-card-link"
                    :href="selectedSearchGoogleUrl"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <i class="mdi mdi-google"></i>
                    Search on Google
                  </a>
                  <template
                    v-if="locStore.isGooglePlaceSaved(locStore.selectedSearchResult.google_place_id)"
                  >
                    <button class="focus-card-save focus-card-save--saved" type="button" disabled>
                      <i class="mdi mdi-check"></i>
                      Saved
                    </button>
                  </template>
                  <template v-else>
                    <button
                      class="focus-card-save"
                      type="button"
                      :disabled="locStore.isSaving"
                      @click="saveSelectedSearchResult('to_try')"
                    >
                      <i
                        :class="locStore.isSaving ? 'mdi mdi-loading mdi-spin' : 'mdi mdi-bookmark-outline'"
                      ></i>
                      {{ locStore.isSaving ? 'Saving…' : 'Save to try' }}
                    </button>
                    <button
                      class="focus-card-save focus-card-save--secondary"
                      type="button"
                      :disabled="locStore.isSaving"
                      @click="saveSelectedSearchResult('tried')"
                    >
                      <i class="mdi mdi-check-circle-outline"></i>
                      Save as tried
                    </button>
                  </template>
                </div>
                <p v-if="locStore.actionError" class="focus-card-error">
                  {{ locStore.actionError }}
                </p>
              </div>
              <button
                class="focus-card-close"
                type="button"
                aria-label="Dismiss"
                @click="locStore.clearSelection()"
              >
                <i class="mdi mdi-close"></i>
              </button>
            </template>

            <template v-else-if="locStore.selected">
              <div class="focus-card-icon">
                <i
                  :class="
                    locStore.selected.listStatus === 'tried'
                      ? 'mdi mdi-check-circle-outline'
                      : 'mdi mdi-silverware-fork-knife'
                  "
                ></i>
              </div>
              <div class="focus-card-body">
                <p class="focus-card-label">
                  {{ locStore.selected.listStatus === 'tried' ? 'Tried spot' : 'To-try spot' }}
                </p>
                <p class="focus-card-title">{{ locStore.selected.name }}</p>
                <div class="focus-card-location">
                  <i class="mdi mdi-map-marker-outline"></i>
                  {{ locStore.selected.location }}
                </div>
                <span
                  class="focus-card-category"
                  :style="{
                    backgroundColor: categoryAccent(locStore.selected.category) + '18',
                    color: categoryAccent(locStore.selected.category),
                  }"
                >
                  {{ locStore.selected.category }}
                </span>
                <p v-if="selectedSavedDate" class="focus-card-saved">
                  Saved {{ selectedSavedDate }}
                </p>
                <div class="focus-card-actions">
                  <a
                    v-if="selectedPlaceGoogleUrl"
                    class="focus-card-link"
                    :href="selectedPlaceGoogleUrl"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <i class="mdi mdi-google"></i>
                    Search on Google
                  </a>
                  <button
                    class="focus-card-save"
                    type="button"
                    :disabled="locStore.isUpdatingListStatus"
                    @click="
                      locStore.setPlaceListStatus(
                        locStore.selected,
                        locStore.selected.listStatus === 'tried' ? 'to_try' : 'tried',
                      )
                    "
                  >
                    <i
                      :class="
                        locStore.isUpdatingListStatus
                          ? 'mdi mdi-loading mdi-spin'
                          : locStore.selected.listStatus === 'tried'
                            ? 'mdi mdi-bookmark-outline'
                            : 'mdi mdi-check-circle-outline'
                      "
                    ></i>
                    <template v-if="locStore.isUpdatingListStatus">Updating…</template>
                    <template v-else-if="locStore.selected.listStatus === 'tried'">
                      Move to to-try
                    </template>
                    <template v-else>Mark as tried</template>
                  </button>
                </div>
                <p v-if="locStore.actionError" class="focus-card-error">
                  {{ locStore.actionError }}
                </p>
              </div>
              <button
                class="focus-card-close"
                type="button"
                aria-label="Dismiss"
                @click="locStore.clearSelection()"
              >
                <i class="mdi mdi-close"></i>
              </button>
            </template>
          </div>
        </Transition>
      </div>
    </div>

    <PinLabelModal
      :open="!!pendingCoord"
      :saving="locStore.isSaving"
      :error="pinError"
      :address-hint="resolvingAddress ? 'Looking up address…' : addressHint"
      @save="saveLabeledPin"
      @cancel="cancelPinLabel"
    />
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}

.shell {
  display: flex;
  flex: 1;
  min-height: 0;
}

.map-wrap {
  flex: 1;
  position: relative;
  min-width: 0;
}

.map-el {
  height: 100%;
  width: 100%;
}

.map-hint {
  position: absolute;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 500;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  background: rgba(255, 255, 255, 0.82);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-full);
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
  box-shadow: var(--shadow-md);
  pointer-events: none;
  animation: slideUp 0.5s ease 0.3s both;
  max-width: calc(100% - 120px);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.map-hint i {
  font-size: 14px;
  color: var(--accent);
  flex-shrink: 0;
}

.map-control {
  position: absolute;
  top: 16px;
  right: 16px;
  z-index: 500;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.82);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-md);
  font-size: 20px;
  color: var(--text-secondary);
  cursor: pointer;
  box-shadow: var(--shadow-sm);
  transition: background var(--transition), color var(--transition), box-shadow var(--transition), transform var(--transition);
}

.map-control:hover {
  background: var(--gradient-accent);
  color: white;
  border-color: transparent;
  box-shadow: var(--shadow-glow);
  transform: translateY(-1px);
}

.map-control:active {
  transform: scale(0.95);
}

.map-control--list {
  display: none;
  right: 64px;
}

.map-control--add {
  top: 64px;
}

.map-control--locate {
  top: 112px;
}

.map-control--set-location {
  top: 160px;
}

.map-control--near-me {
  top: 208px;
}

.map-control--locate.map-control--active,
.map-control--add.map-control--active,
.map-control--set-location.map-control--active,
.map-control--near-me.map-control--active {
  color: #2B6CB0;
  border-color: rgba(49, 130, 206, 0.35);
  background: rgba(235, 248, 255, 0.92);
}

.map-control--add.map-control--active,
.map-control--set-location.map-control--active,
.map-control--near-me.map-control--active {
  color: #C05621;
  border-color: rgba(221, 107, 32, 0.35);
  background: rgba(255, 250, 240, 0.94);
}

.map-control--locate.map-control--active:hover {
  background: #3182CE;
  color: white;
  border-color: transparent;
  box-shadow: 0 4px 14px rgba(49, 130, 206, 0.35);
}

.map-control--add.map-control--active:hover,
.map-control--set-location.map-control--active:hover,
.map-control--near-me.map-control--active:hover {
  background: #DD6B20;
  color: white;
  border-color: transparent;
  box-shadow: 0 4px 14px rgba(221, 107, 32, 0.35);
}

.map-control--locate.map-control--error {
  color: var(--danger);
  border-color: rgba(192, 57, 43, 0.3);
  background: var(--danger-bg);
}

.map-control--locate:disabled,
.map-control--near-me:disabled {
  cursor: wait;
  opacity: 0.85;
}

.map-panel {
  position: absolute;
  right: 64px;
  z-index: 520;
  width: min(280px, calc(100% - 80px));
  padding: 12px 14px;
  background: rgba(255, 255, 255, 0.94);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.map-panel--set-location {
  top: 160px;
}

.map-panel--near-me {
  top: 208px;
}

.map-panel-title {
  margin: 0;
  font-size: 13px;
  font-weight: 650;
  color: var(--text-primary);
  letter-spacing: -0.01em;
}

.map-panel-status {
  margin: 0;
  font-size: 12px;
  line-height: 1.4;
  color: var(--text-secondary);
}

.map-panel-form {
  display: flex;
  gap: 6px;
}

.map-panel-input {
  flex: 1;
  min-width: 0;
  height: 34px;
  padding: 0 10px;
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-sm);
  font: inherit;
  font-size: 13px;
  color: var(--text-primary);
  background: white;
}

.map-panel-input:focus {
  outline: none;
  border-color: rgba(221, 107, 32, 0.55);
  box-shadow: 0 0 0 3px rgba(221, 107, 32, 0.12);
}

.map-panel-btn {
  height: 34px;
  padding: 0 12px;
  border: none;
  border-radius: var(--radius-sm);
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  color: white;
  background: #DD6B20;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  white-space: nowrap;
}

.map-panel-btn:hover:not(:disabled) {
  background: #C05621;
}

.map-panel-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.map-panel-btn--secondary {
  width: 100%;
  color: var(--text-secondary);
  background: rgba(0, 0, 0, 0.04);
}

.map-panel-btn--secondary:hover:not(:disabled) {
  background: rgba(0, 0, 0, 0.08);
  color: var(--text-primary);
}

.map-panel-btn--active {
  color: #C05621;
  background: rgba(255, 250, 240, 0.98);
  box-shadow: inset 0 0 0 1px rgba(221, 107, 32, 0.35);
}

.map-panel-error {
  margin: 0;
  font-size: 12px;
  color: var(--danger);
}

.map-panel-radii {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.map-panel-chip {
  height: 30px;
  padding: 0 10px;
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-full);
  background: white;
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  cursor: pointer;
}

.map-panel-chip:hover:not(:disabled) {
  border-color: rgba(221, 107, 32, 0.45);
  color: #C05621;
}

.map-panel-chip--active {
  color: white;
  background: #DD6B20;
  border-color: #DD6B20;
}

.map-panel-chip:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.map-panel-actions {
  display: flex;
  gap: 6px;
}

.map-panel-actions .map-panel-btn {
  flex: 1;
}

.map-panel-actions .map-panel-btn--secondary {
  width: auto;
}

.focus-card {
  position: absolute;
  bottom: 28px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 500;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  min-width: 280px;
  max-width: min(420px, calc(100% - 24px));
  max-height: min(70vh, 520px);
  overflow-y: auto;
  padding: 14px 16px;
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-xl);
}

.focus-card--discovered {
  align-items: flex-start;
}

.focus-details {
  margin: 8px 0 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.focus-details > div {
  display: grid;
  grid-template-columns: 110px 1fr;
  gap: 8px;
  align-items: start;
}

.focus-details dt {
  margin: 0;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--text-muted);
}

.focus-details dd {
  margin: 0;
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.4;
  word-break: break-word;
}

.focus-details a {
  color: var(--accent);
  text-decoration: none;
}

.focus-details a:hover {
  text-decoration: underline;
}

.focus-details .capitalize {
  text-transform: capitalize;
}

.focus-card-save {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 12px;
  padding: 8px 14px;
  border: none;
  border-radius: var(--radius-full);
  background: var(--gradient-accent);
  color: white;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  box-shadow: var(--shadow-glow);
  transition: transform var(--transition), box-shadow var(--transition), opacity var(--transition);
}

.focus-card-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
}

.focus-card-actions .focus-card-save {
  margin-top: 0;
}

.focus-card-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: var(--radius-full);
  border: 1px solid rgba(15, 110, 86, 0.25);
  background: var(--surface);
  color: var(--accent);
  font-size: 13px;
  font-weight: 500;
  text-decoration: none;
  transition: background var(--transition), border-color var(--transition);
}

.focus-card-link:hover {
  background: var(--accent-bg);
  border-color: rgba(15, 110, 86, 0.35);
}

.focus-card-save--secondary {
  background: var(--surface);
  color: var(--accent);
  border: 1px solid rgba(15, 110, 86, 0.25);
  box-shadow: none;
}

.focus-card-save--secondary:hover:not(:disabled) {
  background: var(--accent-bg);
  box-shadow: none;
}

.focus-card-save--saved {
  background: var(--accent-bg);
  color: var(--accent);
  box-shadow: none;
  cursor: default;
}

.focus-card-save:hover:not(:disabled) {
  box-shadow: var(--shadow-glow-lg);
  transform: translateY(-1px);
}

.focus-card-save:disabled {
  opacity: 0.7;
  cursor: wait;
}

.focus-card-save--saved:disabled {
  opacity: 1;
  cursor: default;
}

.focus-card-error {
  margin: 8px 0 0;
  font-size: 12px;
  color: var(--danger);
}

.focus-card-icon {
  width: 44px;
  height: 44px;
  border-radius: var(--radius-md);
  background: var(--gradient-accent);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  flex-shrink: 0;
  box-shadow: var(--shadow-glow);
}

.focus-card-body {
  flex: 1;
  min-width: 0;
}

.focus-card-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-muted);
  margin: 0 0 2px;
}

.focus-card-title {
  font-family: var(--font-display);
  font-size: 19px;
  font-weight: 400;
  color: var(--text);
  margin: 2px 0;
  letter-spacing: -0.01em;
  white-space: normal;
  overflow: visible;
  text-overflow: unset;
}

.focus-card-category {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 10px;
  border-radius: var(--radius-full);
  display: inline-block;
  margin-top: 4px;
}

.focus-card-saved {
  margin: 6px 0 0;
  font-size: 12px;
  color: var(--text-muted);
}

.focus-card-location {
  font-size: 13px;
  color: var(--text-secondary);
}

.focus-card-close {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg);
  border: none;
  border-radius: var(--radius-full);
  color: var(--text-muted);
  font-size: 16px;
  cursor: pointer;
  flex-shrink: 0;
  position: sticky;
  top: 0;
  transition: background var(--transition), color var(--transition);
}

.focus-card-close:hover {
  background: var(--danger-bg);
  color: var(--danger);
}

.focus-card-enter-active,
.focus-card-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.focus-card-enter-from,
.focus-card-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(12px);
}

@media (max-width: 720px) {
  .map-control--list {
    display: flex;
  }

  .map-hint {
    top: auto;
    bottom: 16px;
    left: 16px;
    right: 16px;
    transform: none;
    max-width: none;
    justify-content: center;
  }

  .focus-card {
    bottom: 64px;
  }
}

/* Too little room for the overlay card — rely on sidebar / popup instead */
@media (max-height: 540px), (max-width: 380px) {
  .focus-card {
    display: none;
  }
}
</style>
