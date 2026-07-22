<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import type { LatLngTuple } from 'leaflet'
import NavigationBar from '../components/NavigationBar.vue'
import Sidebar from '../components/Sidebar.vue'
import PinLabelModal from '../components/PinLabelModal.vue'
import { useAuthStore } from '../stores/auth'
import { useLocationStore } from '../stores/location'
import { useMap } from '../composables/useMap'
import { useUserLocation } from '../composables/useUserLocation'
import { reverseGeocode } from '../composables/useGeocode'
import { categoryAccent } from '../constants/categories'
import { storeToRefs } from 'pinia'

const props = defineProps<{
  showLogin?: boolean
  center?: LatLngTuple
  zoom?: number
}>()

const locStore = useLocationStore()
const auth = useAuthStore()
const { mapPlaces, selected } = storeToRefs(locStore)

const sidebarRef = ref<InstanceType<typeof Sidebar> | null>(null)

if (props.showLogin) {
  auth.openLogin()
}

const pendingCoord = ref<{ lat: number; lng: number } | null>(null)
const addressHint = ref<string | null>(null)
const pinError = ref<string | null>(null)
const resolvingAddress = ref(false)

function onMapClick(latlng: { lat: number; lng: number }) {
  if (locStore.activeFilter === 'discovered') return
  if (locStore.hasPlacesSearchOverlay) return

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
  isTracking,
  isLocating,
  error: locationError,
  start: startUserLocation,
} = useUserLocation()

const { mapEl, init, reload, focusUserLocation } = useMap({
  center: props.center,
  zoom: props.zoom,
  places: mapPlaces,
  selected,
  userPosition,
  onMapClick,
  onSelectPlace: (place) => locStore.selectPlace(place),
})

const locateTitle = computed(() => {
  if (locationError.value === 'denied') return 'Location permission denied'
  if (locationError.value === 'timeout') return 'Location timed out — try again'
  if (locationError.value === 'unavailable') return 'Location unavailable'
  if (isLocating.value) return 'Finding your location…'
  if (isTracking.value) return 'Center on my location'
  return 'Show my location'
})

async function onLocateClick() {
  if (isTracking.value && userPosition.value) {
    focusUserLocation()
    return
  }

  const pos = await startUserLocation()
  if (pos) focusUserLocation()
}

async function saveLabeledPin(payload: { name: string; category: string; description: string }) {
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
  })

  if (!place) {
    pinError.value = locStore.actionError
    return
  }

  pendingCoord.value = null
  addressHint.value = null
  locStore.selectPlace(place)
}

async function saveSelectedSearchResult() {
  await locStore.saveSearchResult()
}

function cancelPinLabel() {
  if (locStore.isSaving) return
  pendingCoord.value = null
  addressHint.value = null
  pinError.value = null
  resolvingAddress.value = false
}

onMounted(() => {
  init()
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
          <i class="mdi mdi-cursor-default-click"></i>
          <template v-if="locStore.activeFilter === 'discovered'">
            Browse discoveries from the sidebar or map pins
          </template>
          <template v-else>
            {{ auth.isLoggedIn ? 'Click the map to add a spot' : 'Sign in, then click the map to add a spot' }}
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
          class="map-control map-control--locate"
          type="button"
          :class="{
            'map-control--active': isTracking && !locationError,
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

        <Transition name="focus-card">
          <div
            class="focus-card"
            :class="{
              'focus-card--discovered': locStore.selectedDiscovered || locStore.selectedSearchResult,
            }"
            v-if="locStore.selectedDiscovered || locStore.selectedSearchResult || locStore.selected"
          >
            <template v-if="locStore.selectedSearchResult">
              <div class="focus-card-icon">
                <i class="mdi mdi-magnify"></i>
              </div>
              <div class="focus-card-body">
                <p class="focus-card-label">Search result</p>
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
                <button
                  class="focus-card-save"
                  type="button"
                  :disabled="locStore.isSaving"
                  @click="saveSelectedSearchResult"
                >
                  <i
                    :class="locStore.isSaving ? 'mdi mdi-loading mdi-spin' : 'mdi mdi-bookmark-outline'"
                  ></i>
                  {{ locStore.isSaving ? 'Saving…' : 'Save to my spots' }}
                </button>
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

            <template v-else-if="locStore.selectedDiscovered">
              <div class="focus-card-icon">
                <i class="mdi mdi-compass-outline"></i>
              </div>
              <div class="focus-card-body">
                <p class="focus-card-label">Discovered spot</p>
                <p class="focus-card-title">
                  {{ locStore.selectedDiscovered.google_name || locStore.selectedDiscovered.restaurant_name }}
                </p>
                <dl class="focus-details">
                  <div v-if="locStore.selectedDiscovered.restaurant_name !== locStore.selectedDiscovered.google_name">
                    <dt>Restaurant name</dt>
                    <dd>{{ locStore.selectedDiscovered.restaurant_name }}</dd>
                  </div>
                  <div>
                    <dt>Google address</dt>
                    <dd>{{ locStore.selectedDiscovered.formatted_address }}</dd>
                  </div>
                  <div v-if="locStore.selectedDiscovered.source_category">
                    <dt>Category</dt>
                    <dd>{{ locStore.selectedDiscovered.source_category }}</dd>
                  </div>
                  <div v-if="locStore.selectedDiscovered.rating != null">
                    <dt>Rating</dt>
                    <dd>
                      ★ {{ locStore.selectedDiscovered.rating.toFixed(1) }}
                      <template v-if="locStore.selectedDiscovered.user_rating_count != null">
                        ({{ locStore.selectedDiscovered.user_rating_count }} reviews)
                      </template>
                    </dd>
                  </div>
                  <div v-if="locStore.selectedDiscovered.business_status">
                    <dt>Status</dt>
                    <dd class="capitalize">
                      {{ locStore.selectedDiscovered.business_status.replace(/_/g, ' ').toLowerCase() }}
                    </dd>
                  </div>
                  <div>
                    <dt>Source</dt>
                    <dd>
                      <a
                        :href="locStore.selectedDiscovered.source_url"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        HungryGoWhere article
                      </a>
                    </dd>
                  </div>
                  <div>
                    <dt>Confirmed</dt>
                    <dd>{{ new Date(locStore.selectedDiscovered.confirmed_at).toLocaleString() }}</dd>
                  </div>
                </dl>
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
                <i class="mdi mdi-silverware-fork-knife"></i>
              </div>
              <div class="focus-card-body">
                <p class="focus-card-label">Selected spot</p>
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

.map-control--locate {
  top: 64px;
}

.map-control--locate.map-control--active {
  color: #2B6CB0;
  border-color: rgba(49, 130, 206, 0.35);
  background: rgba(235, 248, 255, 0.92);
}

.map-control--locate.map-control--active:hover {
  background: #3182CE;
  color: white;
  border-color: transparent;
  box-shadow: 0 4px 14px rgba(49, 130, 206, 0.35);
}

.map-control--locate.map-control--error {
  color: var(--danger);
  border-color: rgba(192, 57, 43, 0.3);
  background: var(--danger-bg);
}

.map-control--locate:disabled {
  cursor: wait;
  opacity: 0.85;
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

.focus-card-save:hover:not(:disabled) {
  box-shadow: var(--shadow-glow-lg);
  transform: translateY(-1px);
}

.focus-card-save:disabled {
  opacity: 0.7;
  cursor: wait;
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
