<script setup lang="ts">
import { ref, onMounted } from 'vue'
import type { LatLngTuple } from 'leaflet'
import NavigationBar from '../components/NavigationBar.vue'
import Sidebar from '../components/Sidebar.vue'
import PinLabelModal from '../components/PinLabelModal.vue'
import { useAuthStore } from '../stores/auth'
import { useLocationStore } from '../stores/location'
import { useMap } from '../composables/useMap'
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
const { places, selected } = storeToRefs(locStore)

const sidebarRef = ref<InstanceType<typeof Sidebar> | null>(null)

if (props.showLogin) {
  auth.openLogin()
}

const pendingCoord = ref<{ lat: number; lng: number } | null>(null)
const addressHint = ref<string | null>(null)
const pinError = ref<string | null>(null)
const resolvingAddress = ref(false)

function onMapClick(latlng: { lat: number; lng: number }) {
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

const { mapEl, init, reload } = useMap({
  center: props.center,
  zoom: props.zoom,
  places,
  selected,
  onMapClick,
})

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
          {{ auth.isLoggedIn ? 'Click the map to add a spot' : 'Sign in, then click the map to add a spot' }}
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

        <Transition name="focus-card">
          <div class="focus-card" v-if="locStore.selected">
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
              @click="locStore.selected = null"
            >
              <i class="mdi mdi-close"></i>
            </button>
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
  background: var(--surface);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-full);
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
  box-shadow: var(--shadow-sm);
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
  background: var(--surface);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-md);
  font-size: 20px;
  color: var(--text-secondary);
  cursor: pointer;
  box-shadow: var(--shadow-sm);
  transition: background var(--transition), color var(--transition), box-shadow var(--transition), transform var(--transition);
}

.map-control:hover {
  background: var(--accent-bg);
  color: var(--accent);
  border-color: rgba(15, 110, 86, 0.2);
  box-shadow: var(--shadow-md);
}

.map-control:active {
  transform: scale(0.95);
}

.map-control--list {
  display: none;
  right: 64px;
}

.focus-card {
  position: absolute;
  bottom: 28px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 500;
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 280px;
  max-width: min(360px, calc(100% - 24px));
  padding: 14px 16px;
  background: var(--surface);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
}

.focus-card-icon {
  width: 44px;
  height: 44px;
  border-radius: var(--radius-md);
  background: var(--accent-bg);
  color: var(--accent);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  flex-shrink: 0;
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
  font-size: 15px;
  font-weight: 600;
  color: var(--text);
  margin: 2px 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  letter-spacing: -0.01em;
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
</style>
