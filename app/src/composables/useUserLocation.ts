import { ref, computed, onUnmounted } from 'vue'

export interface UserPosition {
  lat: number
  lng: number
  accuracy: number
}

export type OriginSource = 'gps' | 'manual'
export type UserLocationError = 'denied' | 'unavailable' | 'timeout' | null

/*
	- Opt-in browser geolocation via watchPosition.
	- Manual origin (address / drag) stops GPS so the pin does not jump.
	- Caller owns recenter; this composable only tracks lat/lng/accuracy + source.
*/
export function useUserLocation() {
  const gpsPosition = ref<UserPosition | null>(null)
  const manualPosition = ref<UserPosition | null>(null)
  const originSource = ref<OriginSource | null>(null)
  const isTracking = ref(false)
  const isLocating = ref(false)
  const error = ref<UserLocationError>(null)

  let watchId: number | null = null
  let pendingFirstFix: ((pos: UserPosition) => void) | null = null

  const position = computed<UserPosition | null>(() => {
    if (originSource.value === 'manual') return manualPosition.value
    if (originSource.value === 'gps') return gpsPosition.value
    return manualPosition.value ?? gpsPosition.value
  })

  function mapError(code: number): UserLocationError {
    if (code === 1) return 'denied'
    if (code === 3) return 'timeout'
    return 'unavailable'
  }

  function clearGpsWatch() {
    if (watchId != null && typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchId)
    }
    watchId = null
    pendingFirstFix = null
    isTracking.value = false
    isLocating.value = false
  }

  function start(): Promise<UserPosition | null> {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      error.value = 'unavailable'
      isLocating.value = false
      return Promise.resolve(null)
    }

    if (watchId != null) {
      originSource.value = 'gps'
      manualPosition.value = null
      if (gpsPosition.value) return Promise.resolve(gpsPosition.value)
      return new Promise((resolve) => {
        const prev = pendingFirstFix
        pendingFirstFix = (pos) => {
          prev?.(pos)
          resolve(pos)
        }
      })
    }

    error.value = null
    isLocating.value = true
    originSource.value = 'gps'
    manualPosition.value = null

    return new Promise((resolve) => {
      pendingFirstFix = resolve

      watchId = navigator.geolocation.watchPosition(
        (geo) => {
          const next: UserPosition = {
            lat: geo.coords.latitude,
            lng: geo.coords.longitude,
            accuracy: geo.coords.accuracy,
          }
          gpsPosition.value = next
          if (originSource.value === 'gps') {
            isTracking.value = true
            isLocating.value = false
            error.value = null
          }

          if (pendingFirstFix) {
            pendingFirstFix(next)
            pendingFirstFix = null
          }
        },
        (err) => {
          error.value = mapError(err.code)
          isLocating.value = false
          if (!gpsPosition.value) {
            isTracking.value = false
            if (watchId != null) {
              navigator.geolocation.clearWatch(watchId)
              watchId = null
            }
            if (originSource.value === 'gps') originSource.value = null
          }
          if (pendingFirstFix) {
            pendingFirstFix(null)
            pendingFirstFix = null
          }
        },
        {
          enableHighAccuracy: true,
          maximumAge: 5000,
          timeout: 10000,
        },
      )
    })
  }

  function setManualPosition(lat: number, lng: number, accuracy = 25) {
    clearGpsWatch()
    gpsPosition.value = null
    error.value = null
    const next: UserPosition = { lat, lng, accuracy }
    manualPosition.value = next
    originSource.value = 'manual'
    return next
  }

  function clearManual() {
    manualPosition.value = null
    if (originSource.value === 'manual') {
      originSource.value = gpsPosition.value ? 'gps' : null
    }
  }

  function stop() {
    clearGpsWatch()
    gpsPosition.value = null
    manualPosition.value = null
    originSource.value = null
    error.value = null
  }

  onUnmounted(stop)

  return {
    position,
    originSource,
    isTracking,
    isLocating,
    error,
    start,
    stop,
    setManualPosition,
    clearManual,
  }
}
