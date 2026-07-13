import { ref, watch, onUnmounted, type Ref } from 'vue'
import L, { type Map as LeafletMap, type LatLngTuple } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import markerIconUrl from 'leaflet/dist/images/marker-icon.png'
import markerShadowUrl from 'leaflet/dist/images/marker-shadow.png'
import { categoryAccent } from '../constants/categories'
import { escapeHtml } from '../utils/escapeHtml'
import type { Place } from '../types/place'

/*
	- Vite may serve default marker assets under hashed URLs — keep Leaflet happy.
*/
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl
L.Icon.Default.mergeOptions({
  iconUrl: markerIconUrl,
  shadowUrl: markerShadowUrl,
})

/*
	- Custom pin: do not animate transform on children.
	- Previously .map-pin-ring used transform: scale() in pinPulse; that fought Leaflet's
	- transform-based marker positioning and caused zoom drift (we had a zoomend workaround).
	- Pulse now uses opacity / box-shadow only.
*/
const pinIcon = L.divIcon({
  className: 'mapPinIcon',
  html: `
    <div class="map-pin">
      <div class="map-pin-ring" aria-hidden="true"></div>
      <div class="map-pin-dot"></div>
    </div>
  `,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
  popupAnchor: [0, -10],
})

function createPopupContent(place: Place): string {
  const color = categoryAccent(place.category)
  return `
    <div style="font-family: 'DM Sans', sans-serif; min-width: 200px;">
      <div style="font-weight: 600; font-size: 14px; margin-bottom: 6px; color: #1A1A18; letter-spacing: -0.01em;">${escapeHtml(place.name)}</div>
      <span style="
        background: ${color}18;
        color: ${color};
        font-size: 11px;
        font-weight: 600;
        padding: 3px 10px;
        border-radius: 999px;
        display: inline-block;
        margin-bottom: 8px;
      ">${escapeHtml(place.category)}</span>
      <div style="font-size: 13px; color: #6B6960; line-height: 1.5;">${escapeHtml(place.description)}</div>
    </div>
  `
}

export interface UseMapOptions {
  center?: LatLngTuple
  zoom?: number
  places: Ref<Place[]>
  selected: Ref<Place | null>
  onMapClick?: (latlng: { lat: number; lng: number }) => void
  onSelectPlace?: (place: Place) => void
}

/*
	- Owns the Leaflet map instance and marker layer.
	- Syncs markers from place data in the store — markers never live in Pinia.
*/
export function useMap(options: UseMapOptions) {
  const {
    center = [1.3521, 103.8198] as LatLngTuple,
    zoom = 12,
    places,
    selected,
    onMapClick,
    onSelectPlace,
  } = options

  const mapEl = ref<HTMLElement | null>(null)
  let map: LeafletMap | null = null
  const markers = new Map<string, L.Marker>()

  function upsertMarker(place: Place, openPopup = false) {
    if (!map) return

    const existing = markers.get(place.uid)
    if (existing) {
      existing.setLatLng([place.lat, place.lng])
      existing.setPopupContent(createPopupContent(place))
      if (openPopup) existing.openPopup()
      return
    }

    const marker = L.marker([place.lat, place.lng], { icon: pinIcon }).addTo(map)
    marker.bindPopup(createPopupContent(place))
    marker.on('click', (e) => {
      L.DomEvent.stopPropagation(e)
      const current = places.value.find((p) => p.uid === place.uid)
      if (!current) return
      if (onSelectPlace) onSelectPlace(current)
      else selected.value = current
    })
    markers.set(place.uid, marker)
    if (openPopup) marker.openPopup()
  }

  function removeMarker(uid: string) {
    const marker = markers.get(uid)
    if (!marker) return
    marker.remove()
    markers.delete(uid)
  }

  function syncMarkers(nextPlaces: Place[]) {
    const nextIds = new Set(nextPlaces.map((p) => p.uid))
    for (const uid of [...markers.keys()]) {
      if (!nextIds.has(uid)) removeMarker(uid)
    }
    for (const place of nextPlaces) {
      upsertMarker(place)
    }
  }

  function focusPlace(place: Place) {
    if (!map) return
    map.flyTo([place.lat, place.lng], 15, { duration: 0.3 })
    const marker = markers.get(place.uid)
    marker?.openPopup()
  }

  function init() {
    if (!mapEl.value || map) return

    map = L.map(mapEl.value, {
      zoomControl: false,
      /*
      	- Avoid Leaflet animating marker transforms (another drift source with divIcons).
      */
      markerZoomAnimation: false,
    }).setView(center, zoom)

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
    }).addTo(map)

    L.control.zoom({ position: 'bottomright' }).addTo(map)

    if (onMapClick) {
      map.on('click', (e: L.LeafletMouseEvent) => {
        onMapClick({ lat: e.latlng.lat, lng: e.latlng.lng })
      })
    }

    syncMarkers(places.value)
    /*
    	- Layout may still be settling (sidebar, etc.)
    */
    requestAnimationFrame(() => map?.invalidateSize({ animate: false }))
  }

  function destroy() {
    for (const uid of [...markers.keys()]) removeMarker(uid)
    map?.remove()
    map = null
  }

  /*
  	- Soft refresh: fix sizing and re-bind markers without tearing down tiles.
  */
  function reload() {
    if (!map) {
      init()
      return
    }
    map.invalidateSize({ animate: false })
    syncMarkers(places.value)
  }

  watch(
    places,
    (next) => syncMarkers(next),
    { deep: true },
  )

  watch(selected, (place) => {
    if (place) focusPlace(place)
  })

  onUnmounted(destroy)

  return {
    mapEl,
    init,
    destroy,
    reload,
    focusPlace,
  }
}
