import { ref, watch, onUnmounted, type Ref } from 'vue'
import L, { type Map as LeafletMap, type LatLngTuple } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import markerIconUrl from 'leaflet/dist/images/marker-icon.png'
import markerShadowUrl from 'leaflet/dist/images/marker-shadow.png'
import { categoryAccent } from '../constants/categories'
import { escapeHtml } from '../utils/escapeHtml'
import type { Place } from '../types/place'
import type { OriginSource, UserPosition } from './useUserLocation'

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

const userLocationIcon = L.divIcon({
  className: 'userLocationIcon',
  html: `
    <div class="user-location">
      <div class="user-location-dot"></div>
    </div>
  `,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
})

const manualOriginIcon = L.divIcon({
  className: 'userLocationIcon userLocationIcon--manual',
  html: `
    <div class="user-location user-location--manual">
      <div class="user-location-dot"></div>
    </div>
  `,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
})

const draggableOriginIcon = L.divIcon({
  className: 'userLocationIcon userLocationIcon--manual',
  html: `
    <div class="user-location user-location--manual user-location--draggable">
      <div class="user-location-dot"></div>
    </div>
  `,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
})

function createPopupContent(place: Place): string {
  const color = categoryAccent(place.category)
  return `
    <div style="font-family: 'Figtree', sans-serif; min-width: 200px;">
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
  userPosition?: Ref<UserPosition | null>
  originSource?: Ref<OriginSource | null>
  originDraggable?: Ref<boolean>
  searchRadiusM?: Ref<number | null>
  onMapClick?: (latlng: { lat: number; lng: number }) => void
  onSelectPlace?: (place: Place) => void
  onOriginDragEnd?: (latlng: { lat: number; lng: number }) => void
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
    userPosition,
    originSource,
    originDraggable,
    searchRadiusM,
    onMapClick,
    onSelectPlace,
    onOriginDragEnd,
  } = options

  const mapEl = ref<HTMLElement | null>(null)
  let map: LeafletMap | null = null
  const markers = new Map<string, L.Marker>()
  let userMarker: L.Marker | null = null
  let accuracyCircle: L.Circle | null = null
  let searchRadiusCircle: L.Circle | null = null

  // Updates or create if it does not exist
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

  function originIcon() {
    if (originDraggable?.value) return draggableOriginIcon
    return originSource?.value === 'manual' ? manualOriginIcon : userLocationIcon
  }

  function bindOriginDrag(marker: L.Marker) {
    marker.off('dragend')
    marker.off('dragstart')
    if (!onOriginDragEnd) return
    marker.on('dragstart', (e) => {
      L.DomEvent.stopPropagation(e)
    })
    marker.on('dragend', (e) => {
      L.DomEvent.stopPropagation(e)
      const latlng = marker.getLatLng()
      onOriginDragEnd({ lat: latlng.lat, lng: latlng.lng })
    })
  }

  function syncUserLocation(pos: UserPosition | null) {
    if (!map) return

    if (!pos) {
      userMarker?.remove()
      accuracyCircle?.remove()
      userMarker = null
      accuracyCircle = null
      return
    }

    const latlng: LatLngTuple = [pos.lat, pos.lng]
    const draggable = originDraggable?.value === true
    const icon = originIcon()

    if (userMarker) {
      userMarker.setLatLng(latlng)
      userMarker.setIcon(icon)
      if (userMarker.dragging) {
        if (draggable) userMarker.dragging.enable()
        else userMarker.dragging.disable()
      }
    } else {
      userMarker = L.marker(latlng, {
        icon,
        interactive: true,
        draggable: true,
        zIndexOffset: 1000,
        bubblingMouseEvents: false,
      }).addTo(map)
      bindOriginDrag(userMarker)
      if (!draggable) userMarker.dragging?.disable()
    }

    if (userMarker) bindOriginDrag(userMarker)

    const showAccuracy = originSource?.value !== 'manual' && !draggable
    if (!showAccuracy) {
      accuracyCircle?.remove()
      accuracyCircle = null
    } else if (accuracyCircle) {
      accuracyCircle.setLatLng(latlng)
      accuracyCircle.setRadius(pos.accuracy)
    } else {
      accuracyCircle = L.circle(latlng, {
        radius: pos.accuracy,
        className: 'user-accuracy-circle',
        interactive: false,
        weight: 1,
        opacity: 0.45,
        fillOpacity: 0.12,
        color: '#2B6CB0',
        fillColor: '#3182CE',
      }).addTo(map)
    }
  }

  function syncSearchRadius() {
    if (!map || !userPosition) return

    const radius = searchRadiusM?.value ?? null
    const pos = userPosition.value
    if (radius == null || !pos) {
      searchRadiusCircle?.remove()
      searchRadiusCircle = null
      return
    }

    const latlng: LatLngTuple = [pos.lat, pos.lng]
    if (searchRadiusCircle) {
      searchRadiusCircle.setLatLng(latlng)
      searchRadiusCircle.setRadius(radius)
      return
    }

    searchRadiusCircle = L.circle(latlng, {
      radius,
      className: 'search-radius-circle',
      interactive: false,
      weight: 1.5,
      opacity: 0.55,
      fillOpacity: 0.08,
      color: '#C05621',
      fillColor: '#DD6B20',
      dashArray: '6 4',
    }).addTo(map)
  }

  function focusUserLocation() {
    if (!map || !userPosition?.value) return
    const { lat, lng } = userPosition.value
    map.flyTo([lat, lng], 16, { duration: 0.35 })
  }

  function focusSearchRadius() {
    if (!map || !userPosition?.value) return
    const radius = searchRadiusM?.value
    const { lat, lng } = userPosition.value
    if (radius == null) {
      focusUserLocation()
      return
    }

    const bounds = L.latLng(lat, lng).toBounds(radius * 2)
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16, animate: true })
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
    if (userPosition) syncUserLocation(userPosition.value)
    syncSearchRadius()
    /*
    	- Layout may still be settling (sidebar, etc.)
    */
    requestAnimationFrame(() => map?.invalidateSize({ animate: false }))
  }

  function destroy() {
    for (const uid of [...markers.keys()]) removeMarker(uid)
    userMarker?.remove()
    accuracyCircle?.remove()
    searchRadiusCircle?.remove()
    userMarker = null
    accuracyCircle = null
    searchRadiusCircle = null
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

  if (userPosition) {
    watch(userPosition, (pos) => {
      syncUserLocation(pos)
      syncSearchRadius()
    })
  }

  if (originSource) {
    watch(originSource, () => {
      if (userPosition) syncUserLocation(userPosition.value)
    })
  }

  if (originDraggable) {
    watch(originDraggable, () => {
      if (userPosition) syncUserLocation(userPosition.value)
    })
  }

  if (searchRadiusM) {
    watch(searchRadiusM, () => syncSearchRadius())
  }

  onUnmounted(destroy)

  return {
    mapEl,
    init,
    destroy,
    reload,
    focusPlace,
    focusUserLocation,
    focusSearchRadius,
  }
}
