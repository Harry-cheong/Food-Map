<script setup lang="ts">
import NavigationBar from '../components/NavigationBar.vue'
import Sidebar from '../components/Sidebar.vue'
import { ref, onMounted, onUnmounted, watch } from 'vue'
import L, { type Map, type LatLngTuple, LatLng } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'
import { useAuthStore } from '../stores/auth.ts'
import { useApi } from '../composables/useApi.ts'
import { useLocationStore } from '../stores/location.ts'

const props = defineProps<{
  showLogin: boolean
  center?: LatLngTuple
  zoom?: number
}>()

const showLogin = ref(props.showLogin ?? false)

const center = props.center ?? [1.3521, 103.8198]
const zoom = props.zoom ?? 12
const locStore = useLocationStore()

delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
})

const mapEl = ref<HTMLElement | null>(null)

interface Place {
  name: string
  location: string
  coordinates: LatLng
  marker: L.Marker
  id?: number
  category: string
  description: string
}

interface ItemResponse {
    name: string
    lat: number
    lng: number
    location: string
    category: string
    description: string
    public: boolean
    id: number
    submitted_by_user_id: number
    created_at: string
}


let map: Map | null = null

const pinIcon = L.divIcon({
  className: 'mapPinIcon',
  html: `
    <div class="map-pin">
      <div class="map-pin-dot"></div>
      <div class="map-pin-ring"></div>
    </div>
  `,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
})

const categoryColors: Record<string, string> = {
  Chinese: '#C2410C',
  Japanese: '#BE185D',
  Indian: '#B45309',
  Western: '#1D4ED8',
  Malay: '#047857',
  Korean: '#6D28D9',
  Thai: '#0F766E',
  'Fast Food': '#DC2626',
}

function createPopupContent(name: string, category: string, description: string): string {
  const color = categoryColors[category] ?? '#4B5563'

  return `
    <div style="font-family: 'DM Sans', sans-serif; min-width: 200px;">
      <div style="font-weight: 600; font-size: 14px; margin-bottom: 6px; color: #1A1A18; letter-spacing: -0.01em;">${name}</div>
      <span style="
        background: ${color}18;
        color: ${color};
        font-size: 11px;
        font-weight: 600;
        padding: 3px 10px;
        border-radius: 999px;
        display: inline-block;
        margin-bottom: 8px;
      ">${category}</span>
      <div style="font-size: 13px; color: #6B6960; line-height: 1.5;">${description}</div>
    </div>
  `
}

function addMarker(coord: L.LatLng, name: string) {
  if (!map) return
  const category = 'Indian'
  const marker = L.marker(coord, { icon: pinIcon }).addTo(map)
  marker.bindPopup(createPopupContent(name, category, 'Tap to explore this spot.')).openPopup()

  return marker
}

async function addNewPlace(coordinates: LatLng, name: string) {
  const marker = addMarker(coordinates, name)
  const raw = await (await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${coordinates.lat}&lon=${coordinates.lng}&format=json`)).text()
  const location = JSON.parse(raw)
  locStore.addNewPlace({
    name: name,
    coordinates: coordinates,
    location: (location.address.road ?? location.address.neighbourhood) + " Singapore " + location.address.postcode,
    marker,
    category: "Indian",
    description: "A fox jumping over the wall"
  })
}

function addSavedLocation(item: ItemResponse) {
  const coordinates = new LatLng(item.lat, item.lng)
  const marker = addMarker(coordinates, item.name)
  locStore.addSavedPlaces({
    name: item.name,
    coordinates: coordinates,
    location: item.location,
    marker,
    id: item.id,
    category: item.category,
    description: item.description
  })
}

function onMapClick(e: L.LeafletMouseEvent) {
  if (!map) return
  const latlng = L.latLng(e.latlng.lat, e.latlng.lng)
  addNewPlace(latlng, 'Food Location #' + Math.round(Math.random() * 100))
}

function focusMarker(marker: Place) {
  if (!map) return
  map.flyTo(marker.coordinates, 15, { duration: 0.3 })
  marker.marker.openPopup()
}

watch(
  () => locStore.selected,
  (newPlace) => {
    if (!newPlace) return
    focusMarker(newPlace)
  }
)

function loadMap() {
  if (!mapEl.value) return
  // map = L.map(mapEl.value, { zoomControl: false }).setView(center, zoom)
  map = L.map(mapEl.value, { zoomControl: false, markerZoomAnimation: false}).setView(center, zoom)

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap',
  }).addTo(map)

  L.control.zoom({ position: 'bottomright' }).addTo(map)

  map.on('click', onMapClick)
  map.on('zoomend', () => {
    // Handles marker drifts
    requestAnimationFrame(() => {
      locStore.places.forEach(place => {
        const expected = map!.latLngToContainerPoint(place.marker.getLatLng())
        let driftFound = false
        const el = place.marker.getElement()
        if (!el) return
        const rect = el.getBoundingClientRect()
        const mapRect = map!.getContainer().getBoundingClientRect()
        const actual = {
          x: rect.left - mapRect.left + rect.width / 2,
          y: rect.top - mapRect.top + rect.height / 2
        }
        const dx = Math.abs(expected.x - actual.x)
        const dy = Math.abs(expected.y - actual.y)
        if (dx > 1 || dy > 1) {
          driftFound = true
          console.warn('Marker drift detected', place.name, { expected, actual, dx, dy })
          place.marker.setLatLng(place.marker.getLatLng())
        }
        if (driftFound) {
          if (driftFound) {
            map?.invalidateSize({ animate: false, pan: false }) // resync map-wide cache too
          }
        }
      })
    })
  })
  return map
}

function reloadMap() {
  if (map) {
    map.remove()
    loadMap()
    map?.invalidateSize()
    locStore.places.forEach((m) => {
      if (!map) return
      const marker = L.marker(m.coordinates, { icon: pinIcon }).addTo(map)
      marker
        .bindPopup(createPopupContent(m.name, m.category, 'Tap to explore this spot.'))
      m.marker = marker
    })
  }
}

onMounted(() => {
  loadMap()
})

onUnmounted(() => {
  map?.remove()
  auth.logout()
})

// Authentication
const auth = useAuthStore()

watch(
  () => auth.token,
  async (newVal, oldVal) => {
    if (newVal && newVal !== oldVal) {
      const { data, execute } = useApi('/items/me')
      await execute()
      if (!!data.value) {
        const items = data.value as Array<any>
        items.forEach((item) => {
          addSavedLocation(item)
        })
      }
    }
  }
)
</script>

<template>
  <div class="page">
    <NavigationBar :showLogin="showLogin" />

    <div class="shell">
      <Sidebar />

      <div class="map-wrap">
        <div ref="mapEl" class="map-el"></div>

        <div class="map-hint">
          <i class="mdi mdi-cursor-default-click"></i>
          Click the map to add a spot
        </div>

        <button class="map-control" @click.stop="reloadMap" title="Refresh map">
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
                  backgroundColor: (categoryColors[locStore.selected.category] ?? '#4B5563') + '18',
                  color: categoryColors[locStore.selected.category] ?? '#4B5563',
                }"
              >
                {{ locStore.selected.category }}
              </span>
            </div>
            <button
              class="focus-card-close"
              @click="locStore.selected = null"
              aria-label="Dismiss"
            >
              <i class="mdi mdi-close"></i>
            </button>
          </div>
        </Transition>
      </div>
    </div>
  </div>
</template>

<style>
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

/* Custom map pin */
.map-pin {
  position: relative;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.map-pin-dot {
  width: 12px;
  height: 12px;
  background: var(--accent);
  border: 2.5px solid white;
  border-radius: 50%;
  box-shadow: 0 2px 8px rgba(15, 110, 86, 0.45);
  position: relative;
  z-index: 1;
}

.map-pin-ring {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: rgba(15, 110, 86, 0.2);
  animation: pinPulse 2s ease-out infinite;
}

@keyframes pinPulse {
  0% {
    transform: scale(0.6);
    opacity: 0.8;
  }
  100% {
    transform: scale(1.6);
    opacity: 0;
  }
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
}

.map-hint i {
  font-size: 14px;
  color: var(--accent);
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
  max-width: 360px;
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
  margin: 2px 0 2px 0;
  /* Shorthand is clockwise top, left, bottom, right */
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

.leaflet-control-zoom {
  border: none !important;
  box-shadow: var(--shadow-sm) !important;
  border-radius: var(--radius-md) !important;
  overflow: hidden;
}

.leaflet-control-zoom a {
  width: 32px !important;
  height: 32px !important;
  line-height: 32px !important;
  font-size: 16px !important;
  color: var(--text-secondary) !important;
  border-color: var(--border-soft) !important;
}

.leaflet-control-zoom a:hover {
  background: var(--accent-bg) !important;
  color: var(--accent) !important;
}
</style>
