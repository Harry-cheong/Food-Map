import { ref, onUnmounted } from 'vue'

export interface UserPosition {
  lat: number
  lng: number
  accuracy: number
}

export type UserLocationError = 'denied' | 'unavailable' | 'timeout' | null

/*
	- Opt-in browser geolocation via watchPosition.
	- Caller owns recenter; this composable only tracks lat/lng/accuracy.
*/
export function useUserLocation() {
  const position = ref<UserPosition | null>(null)
  const isTracking = ref(false)
  const isLocating = ref(false)
  const error = ref<UserLocationError>(null)

  let watchId: number | null = null
  let pendingFirstFix: ((pos: UserPosition) => void) | null = null

  function mapError(code: number): UserLocationError {
    if (code === 1) return 'denied'
    if (code === 3) return 'timeout'
    return 'unavailable'
  }

  function start(): Promise<UserPosition | null> {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      error.value = 'unavailable'
      isLocating.value = false
      return Promise.resolve(null)
    }

    if (watchId != null) {
      if (position.value) return Promise.resolve(position.value)
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

    return new Promise((resolve) => {
      pendingFirstFix = resolve

      watchId = navigator.geolocation.watchPosition(
        (geo) => {
          const next: UserPosition = {
            lat: geo.coords.latitude,
            lng: geo.coords.longitude,
            accuracy: geo.coords.accuracy,
          }
          position.value = next
          isTracking.value = true
          isLocating.value = false
          error.value = null

          if (pendingFirstFix) {
            pendingFirstFix(next)
            pendingFirstFix = null
          }
        },
        (err) => {
          error.value = mapError(err.code)
          isLocating.value = false
          if (!position.value) {
            isTracking.value = false
            if (watchId != null) {
              navigator.geolocation.clearWatch(watchId)
              watchId = null
            }
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

  function stop() {
    if (watchId != null && typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchId)
    }
    watchId = null
    pendingFirstFix = null
    isTracking.value = false
    isLocating.value = false
    position.value = null
  }

  onUnmounted(stop)

  return {
    position,
    isTracking,
    isLocating,
    error,
    start,
    stop,
  }
}
