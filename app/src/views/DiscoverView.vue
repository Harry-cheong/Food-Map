<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import NavigationBar from '../components/NavigationBar.vue'
import DiscoverFeedCard from '../components/DiscoverFeedCard.vue'
import {
  useLocationStore,
  type DiscoveredSort,
} from '../stores/location'
import { useMap } from '../composables/useMap'
import { storeToRefs } from 'pinia'
import type { DiscoveredPlace } from '../types/discovered'
import type { Place } from '../types/place'

const locStore = useLocationStore()
const {
  discoveredMapPlaces,
  selected,
  selectedDiscovered,
  isLoadingDiscovered,
  discoveredHasMore,
  discoveredPlaces,
  discoveredTotal,
  discoveredSort,
  discoveredSearchQuery,
  actionError,
} = storeToRefs(locStore)

const sortOptions: { id: DiscoveredSort; label: string }[] = [
  { id: 'recent', label: 'Newest' },
  { id: 'rating', label: 'Highly rated' },
  { id: 'reviews', label: 'Most reviewed' },
]

const savingId = ref<number | null>(null)
const sentinel = ref<HTMLElement | null>(null)
const feedScroll = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | null = null

const { mapEl, init, reload } = useMap({
  places: discoveredMapPlaces,
  selected,
  onSelectPlace: (place: Place) => {
    const hit = discoveredPlaces.value.find((d) => d.id === place.id)
    if (hit) locStore.selectDiscovered(hit)
  },
})

function bindObserver(el: HTMLElement | null) {
  observer?.disconnect()
  observer = null
  if (!el) return

  observer = new IntersectionObserver(
    (entries) => {
      if (!entries.some((e) => e.isIntersecting)) return
      if (!discoveredHasMore.value || isLoadingDiscovered.value) return
      void locStore.loadDiscovered()
    },
    {
      root: feedScroll.value,
      rootMargin: '120px',
      threshold: 0,
    },
  )
  observer.observe(el)
}

watch(sentinel, (el) => bindObserver(el), { flush: 'post' })
watch(feedScroll, () => {
  if (sentinel.value) bindObserver(sentinel.value)
})

onMounted(() => {
  init()
  void locStore.loadDiscovered({ reset: true })
})

onUnmounted(() => {
  observer?.disconnect()
  locStore.clearSelection()
})

function onSearchInput(event: Event) {
  locStore.setDiscoveredSearchQuery((event.target as HTMLInputElement).value)
}

function selectPlace(place: DiscoveredPlace) {
  locStore.selectDiscovered(place)
}

async function savePlace(place: DiscoveredPlace) {
  savingId.value = place.id
  await locStore.saveDiscoveredPlace(place)
  savingId.value = null
}

const headerCount = computed(() => {
  if (isLoadingDiscovered.value && discoveredPlaces.value.length === 0) {
    return 'Loading…'
  }
  return `${discoveredPlaces.value.length} of ${discoveredTotal.value} ${
    discoveredTotal.value === 1 ? 'place' : 'places'
  }`
})
</script>

<template>
  <div class="page">
    <NavigationBar />

    <div class="shell">
      <aside class="feed-pane">
        <header class="feed-header">
          <div>
            <h1 class="feed-title">Discover</h1>
            <p class="feed-subtitle">{{ headerCount }}</p>
          </div>
        </header>

        <div class="feed-toolbar">
          <div class="feed-search">
            <i class="mdi mdi-magnify" aria-hidden="true"></i>
            <input
              type="search"
              class="feed-search-input"
              placeholder="Search discovered spots…"
              :value="discoveredSearchQuery"
              aria-label="Search discovered spots"
              @input="onSearchInput"
            />
            <button
              v-if="discoveredSearchQuery"
              type="button"
              class="feed-search-clear"
              aria-label="Clear search"
              @click="locStore.setDiscoveredSearchQuery('')"
            >
              <i class="mdi mdi-close"></i>
            </button>
          </div>

          <div class="sort-row" role="group" aria-label="Sort discovered places">
            <button
              v-for="s in sortOptions"
              :key="s.id"
              type="button"
              class="sort-chip"
              :class="{ 'sort-chip--active': discoveredSort === s.id }"
              @click="locStore.setDiscoveredSort(s.id)"
            >
              {{ s.label }}
            </button>
          </div>
        </div>

        <p v-if="actionError" class="feed-error">{{ actionError }}</p>

        <div ref="feedScroll" class="feed-scroll">
          <div
            v-if="discoveredPlaces.length === 0 && isLoadingDiscovered"
            class="empty-state"
          >
            <div class="empty-icon">
              <i class="mdi mdi-loading mdi-spin"></i>
            </div>
            <p class="empty-title">Loading discoveries…</p>
          </div>

          <div
            v-else-if="discoveredPlaces.length === 0 && discoveredSearchQuery.trim()"
            class="empty-state"
          >
            <div class="empty-icon">
              <i class="mdi mdi-magnify"></i>
            </div>
            <p class="empty-title">No matches</p>
            <p class="empty-hint">
              Nothing discovered matches “{{ discoveredSearchQuery.trim() }}”.
            </p>
            <button
              type="button"
              class="empty-action"
              @click="locStore.setDiscoveredSearchQuery('')"
            >
              Clear search
            </button>
          </div>

          <div v-else-if="discoveredPlaces.length === 0" class="empty-state">
            <div class="empty-icon">
              <i class="mdi mdi-compass-outline"></i>
            </div>
            <p class="empty-title">No discoveries yet</p>
            <p class="empty-hint">
              Run the scraper pipeline to confirm HungryGoWhere spots.
            </p>
          </div>

          <div v-else class="feed-list">
            <DiscoverFeedCard
              v-for="place in discoveredPlaces"
              :key="place.id"
              :place="place"
              :selected="selectedDiscovered?.id === place.id"
              :saved="locStore.isGooglePlaceSaved(place.google_place_id)"
              :saving="savingId === place.id"
              @select="selectPlace(place)"
              @save="savePlace(place)"
            />
          </div>

          <div
            v-if="discoveredPlaces.length > 0"
            ref="sentinel"
            class="load-more"
            aria-hidden="true"
          >
            <span v-if="isLoadingDiscovered" class="load-more-text">
              <i class="mdi mdi-loading mdi-spin"></i>
              Loading more…
            </span>
            <span v-else-if="!discoveredHasMore" class="load-more-text muted">
              All {{ discoveredTotal }} loaded
            </span>
          </div>
        </div>
      </aside>

      <section class="map-pane">
        <div ref="mapEl" class="map-el"></div>
        <div class="map-hint">
          <i class="mdi mdi-map-marker-outline"></i>
          Select a recommendation to focus it on the map
        </div>
        <button
          class="map-control"
          type="button"
          title="Refresh map"
          @click.stop="reload"
        >
          <i class="mdi mdi-refresh"></i>
        </button>
      </section>
    </div>
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

.feed-pane {
  width: min(440px, 42vw);
  min-width: 320px;
  display: flex;
  flex-direction: column;
  background: var(--sidebar-bg);
  border-right: 1px solid var(--border-soft);
  z-index: 2;
}

.feed-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 64px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--border-soft);
  flex-shrink: 0;
}

.feed-title {
  margin: 0 0 2px;
  font-family: var(--font-display);
  font-size: 22px;
  font-weight: 400;
  letter-spacing: -0.01em;
  color: var(--text);
  line-height: 1.2;
}

.feed-subtitle {
  margin: 0;
  font-size: 14px;
  color: var(--text-muted);
}

.feed-toolbar {
  display: flex;
  flex-direction: column;
  gap: 0;
  flex-shrink: 0;
}

.feed-search {
  position: relative;
  display: flex;
  align-items: center;
  padding: 10px 12px 0;
}

.feed-search i:first-child {
  position: absolute;
  left: 24px;
  color: var(--text-muted);
  font-size: 18px;
  pointer-events: none;
}

.feed-search-input {
  width: 100%;
  height: 40px;
  border: 1px solid var(--border);
  border-radius: var(--radius-full);
  background: var(--surface);
  padding: 0 34px 0 36px;
  font-size: 15px;
  color: var(--text);
  outline: none;
  transition: border-color var(--transition), box-shadow var(--transition);
}

.feed-search-input:hover {
  border-color: rgba(15, 110, 86, 0.3);
}

.feed-search-input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}

.feed-search-input::placeholder {
  color: var(--text-hint);
}

.feed-search-clear {
  position: absolute;
  right: 20px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  width: 24px;
  height: 24px;
  display: grid;
  place-items: center;
  border-radius: var(--radius-full);
  font-size: 15px;
}

.feed-search-clear:hover {
  background: var(--border-soft);
  color: var(--text);
}

.sort-row {
  display: flex;
  flex-wrap: nowrap;
  overflow-x: auto;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-soft);
  background: var(--bg);
}

.sort-chip {
  border: 1px solid transparent;
  background: transparent;
  color: var(--text-secondary);
  border-radius: var(--radius-full);
  padding: 6px 12px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  flex-shrink: 0;
  transition: background var(--transition), color var(--transition), border-color var(--transition);
}

.sort-chip:hover {
  color: var(--text);
}

.sort-chip--active {
  background: var(--surface);
  border-color: var(--border);
  color: var(--text);
  box-shadow: var(--shadow-xs);
}

.feed-error {
  margin: 8px 12px 0;
  padding: 8px 12px;
  border-radius: var(--radius-sm);
  background: var(--danger-bg);
  color: var(--danger);
  font-size: 13px;
}

.feed-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 8px;
}

.feed-scroll::-webkit-scrollbar {
  width: 5px;
}

.feed-scroll::-webkit-scrollbar-thumb {
  background: var(--border);
  border-radius: var(--radius-full);
}

.feed-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 40px 20px;
}

.empty-icon {
  width: 60px;
  height: 60px;
  border-radius: var(--radius-lg);
  background: var(--gradient-accent);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  margin-bottom: 16px;
  box-shadow: var(--shadow-glow);
}

.empty-title {
  margin: 0 0 6px;
  font-size: 17px;
  font-weight: 600;
  color: var(--text);
}

.empty-hint {
  margin: 0;
  font-size: 15px;
  color: var(--text-muted);
  max-width: 220px;
  line-height: 1.55;
}

.empty-action {
  margin-top: 14px;
  border: 1px solid var(--border);
  background: var(--surface);
  border-radius: var(--radius-full);
  padding: 9px 16px;
  font-size: 15px;
  font-weight: 500;
  color: var(--accent);
  cursor: pointer;
}

.empty-action:hover {
  background: var(--gradient-accent);
  border-color: transparent;
  color: white;
  box-shadow: var(--shadow-glow);
}

.load-more {
  display: flex;
  justify-content: center;
  padding: 18px 0 8px;
  min-height: 28px;
}

.load-more-text {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-secondary);
}

.load-more-text.muted {
  color: var(--text-muted);
}

.map-pane {
  position: relative;
  flex: 1;
  min-width: 0;
  background: #dfe8e4;
}

.map-el {
  width: 100%;
  height: 100%;
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
  transition: background var(--transition), color var(--transition), box-shadow var(--transition);
}

.map-control:hover {
  background: var(--gradient-accent);
  color: white;
  box-shadow: var(--shadow-glow);
  border-color: transparent;
}

@media (max-width: 900px) {
  .shell {
    flex-direction: column;
  }

  .feed-pane {
    width: 100%;
    min-width: 0;
    max-height: 58%;
    border-right: none;
    border-bottom: 1px solid var(--border-soft);
  }

  .map-pane {
    min-height: 42%;
  }

  .map-hint {
    white-space: normal;
    max-width: calc(100% - 72px);
    text-align: center;
  }
}
</style>
