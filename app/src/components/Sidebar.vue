<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import SidebarFoodDrawer from './SidebarFoodDrawer.vue'
import {
  useLocationStore,
  type NearbyMinRating,
  type NearbyMinReviews,
  type NearbySort,
  type PersonalListFilter,
  type PlaceFilter,
} from '../stores/location'

const locStore = useLocationStore()
const collapsed = ref(false)
const mobileOpen = ref(false)

const filters: { id: PlaceFilter; label: string; short: string; icon: string }[] = [
  { id: 'personal', label: 'Personal', short: 'Personal', icon: 'mdi-bookmark-outline' },
  { id: 'following', label: 'Following', short: 'Follow', icon: 'mdi-account-group-outline' },
]

const personalLists: { id: PersonalListFilter; label: string }[] = [
  { id: 'to_try', label: 'To try' },
  { id: 'tried', label: 'Tried' },
]

const nearbySortOptions: { id: NearbySort; label: string }[] = [
  { id: 'distance', label: 'Nearest' },
  { id: 'rating', label: 'Highest rated' },
  { id: 'reviews', label: 'Most reviewed' },
]

const nearbyRatingOptions: { value: NearbyMinRating; label: string }[] = [
  { value: null, label: 'Any ★' },
  { value: 3.5, label: '3.5+' },
  { value: 4, label: '4.0+' },
  { value: 4.5, label: '4.5+' },
]

const nearbyReviewsOptions: { value: NearbyMinReviews; label: string }[] = [
  { value: null, label: 'Any reviews' },
  { value: 25, label: '25+' },
  { value: 50, label: '50+' },
  { value: 100, label: '100+' },
]

function setFilter(id: PlaceFilter) {
  if (collapsed.value && !mobileOpen.value && locStore.activeFilter === id) {
    collapsed.value = false
    return
  }
  locStore.setFilter(id)
}

function setPersonalList(id: PersonalListFilter) {
  locStore.setPersonalListFilter(id)
}

function personalListCount(id: PersonalListFilter): number {
  return id === 'to_try' ? locStore.toTryCount : locStore.triedCount
}

function syncMobileDefault() {
  if (window.matchMedia('(max-width: 720px)').matches) {
    collapsed.value = true
    mobileOpen.value = false
  }
}

function openMobile() {
  mobileOpen.value = true
  collapsed.value = false
}

function closeMobile() {
  mobileOpen.value = false
  if (window.matchMedia('(max-width: 720px)').matches) {
    collapsed.value = true
  }
}

/*
	- Reveal the sidebar after nearby search (expand desktop, open drawer on mobile).
*/
function ensureVisible() {
  if (window.matchMedia('(max-width: 720px)').matches) {
    openMobile()
    return
  }
  collapsed.value = false
}

function toggleCollapsed() {
  if (window.matchMedia('(max-width: 720px)').matches) {
    if (mobileOpen.value) closeMobile()
    else openMobile()
    return
  }
  collapsed.value = !collapsed.value
}

onMounted(() => {
  syncMobileDefault()
  window.addEventListener('resize', syncMobileDefault)
})

onUnmounted(() => {
  window.removeEventListener('resize', syncMobileDefault)
})

defineExpose({ openMobile, closeMobile, ensureVisible })
</script>

<template>
  <div
    v-if="mobileOpen"
    class="sidebar-backdrop"
    aria-hidden="true"
    @click="closeMobile"
  />

  <nav
    class="sidebar"
    :class="{ collapsed, 'sidebar--mobile-open': mobileOpen }"
    aria-label="Saved places"
  >
    <!-- Collapsed icon rail (desktop only) -->
    <div v-if="collapsed && !mobileOpen" class="rail" aria-label="Sidebar shortcuts">
      <button
        class="rail-toggle"
        type="button"
        aria-label="Expand sidebar"
        title="Expand sidebar"
        @click="toggleCollapsed"
      >
        <i class="mdi mdi-chevron-double-right"></i>
      </button>

      <div class="rail-divider" aria-hidden="true"></div>

      <button
        v-if="locStore.nearbyActive"
        type="button"
        class="rail-btn rail-btn--nearby rail-btn--active"
        aria-label="Expand nearby results"
        title="Nearby results"
        @click="collapsed = false"
      >
        <span class="rail-icon-wrap">
          <i class="mdi mdi-store-search-outline"></i>
          <span
            v-if="locStore.placesSearchResults.length"
            class="rail-badge"
          >{{ locStore.placesSearchResults.length > 99 ? '99+' : locStore.placesSearchResults.length }}</span>
        </span>
        <span class="rail-caption">Nearby</span>
      </button>

      <template v-if="!locStore.nearbyActive">
        <button
          v-for="f in filters"
          :key="f.id"
          type="button"
          class="rail-btn"
          :class="{ 'rail-btn--active': locStore.activeFilter === f.id }"
          :aria-label="f.label"
          :aria-pressed="locStore.activeFilter === f.id"
          :title="f.label"
          @click="setFilter(f.id)"
        >
          <span class="rail-icon-wrap">
            <i :class="`mdi ${f.icon}`"></i>
            <span
              v-if="f.id === 'personal' && locStore.places.length"
              class="rail-badge"
            >{{ locStore.places.length > 99 ? '99+' : locStore.places.length }}</span>
          </span>
          <span class="rail-caption">{{ f.short }}</span>
        </button>
      </template>
    </div>

    <div class="sidebar-header" v-if="!collapsed || mobileOpen">
      <div class="header-text">
        <p class="header-title">
          <template v-if="locStore.nearbyActive">Nearby</template>
          <template v-else>Your spots</template>
        </p>
        <p class="header-count">
          <template v-if="locStore.nearbyActive">
            <template v-if="locStore.isSearchingPlaces">Searching…</template>
            <template v-else-if="locStore.searchQuery.trim() || locStore.nearbyMinRating != null || locStore.nearbyMinReviews != null">
              {{ locStore.filteredNearbyResults.length }}
              of {{ locStore.placesSearchResults.length }}
              shown
            </template>
            <template v-else>
              {{ locStore.placesSearchResults.length }}
              {{ locStore.placesSearchResults.length === 1 ? 'restaurant' : 'restaurants' }}
              within
              {{
                locStore.nearbyRadiusM < 1000
                  ? `${locStore.nearbyRadiusM}m`
                  : `${locStore.nearbyRadiusM / 1000}km`
              }}
            </template>
          </template>
          <template v-else>
            {{ locStore.personalPlaces.length }}
            {{ locStore.personalListFilter === 'tried' ? 'tried' : 'to try' }}
            · {{ locStore.places.length }} saved
          </template>
        </p>
      </div>

      <button
        class="toggle-btn"
        type="button"
        :aria-label="mobileOpen ? 'Close sidebar' : 'Collapse sidebar'"
        @click="toggleCollapsed"
      >
        <i
          :class="mobileOpen ? 'mdi mdi-close' : 'mdi mdi-chevron-left'"
        ></i>
      </button>
    </div>

    <div class="search-container" v-if="!collapsed || mobileOpen">
      <i class="mdi mdi-magnify search-icon"></i>
      <input
        type="search"
        class="search-input"
        :placeholder="
          locStore.nearbyActive
            ? 'Filter nearby results…'
            : 'Search your saved spots…'
        "
        :value="locStore.searchQuery"
        @input="locStore.setSearchQuery(($event.target as HTMLInputElement).value)"
      />
      <button
        v-if="locStore.searchQuery"
        type="button"
        class="search-clear"
        aria-label="Clear search"
        @click="locStore.setSearchQuery('')"
      >
        <i class="mdi mdi-close"></i>
      </button>
    </div>

    <div
      v-if="locStore.nearbyActive && (!collapsed || mobileOpen)"
      class="nearby-banner"
    >
      <span class="nearby-banner-text">
        <i class="mdi mdi-store-search-outline"></i>
        Radius search results
      </span>
      <button
        type="button"
        class="nearby-banner-clear"
        @click="locStore.clearNearbySearch()"
      >
        Clear
      </button>
    </div>

    <div
      v-if="locStore.nearbyActive && (!collapsed || mobileOpen)"
      class="sort-drawer"
      role="group"
      aria-label="Sort nearby places"
    >
      <span class="sort-label">Sort</span>
      <button
        v-for="s in nearbySortOptions"
        :key="s.id"
        type="button"
        class="sort-select"
        :class="{ 'sort-select--active': locStore.nearbySort === s.id }"
        @click="locStore.setNearbySort(s.id)"
      >
        {{ s.label }}
      </button>
    </div>

    <div
      v-if="locStore.nearbyActive && (!collapsed || mobileOpen)"
      class="sort-drawer sort-drawer--filters"
      role="group"
      aria-label="Filter nearby by rating"
    >
      <span class="sort-label">Rating</span>
      <button
        v-for="opt in nearbyRatingOptions"
        :key="String(opt.value)"
        type="button"
        class="sort-select"
        :class="{ 'sort-select--active': locStore.nearbyMinRating === opt.value }"
        @click="locStore.setNearbyMinRating(opt.value)"
      >
        {{ opt.label }}
      </button>
    </div>

    <div
      v-if="locStore.nearbyActive && (!collapsed || mobileOpen)"
      class="sort-drawer sort-drawer--filters"
      role="group"
      aria-label="Filter nearby by review count"
    >
      <span class="sort-label">Reviews</span>
      <button
        v-for="opt in nearbyReviewsOptions"
        :key="String(opt.value)"
        type="button"
        class="sort-select"
        :class="{ 'sort-select--active': locStore.nearbyMinReviews === opt.value }"
        @click="locStore.setNearbyMinReviews(opt.value)"
      >
        {{ opt.label }}
      </button>
    </div>

    <div class="filter-drawer" v-if="(!collapsed || mobileOpen) && !locStore.nearbyActive">
      <button
        v-for="f in filters"
        :key="f.id"
        type="button"
        class="filter-select"
        :class="{ 'filter-select--active': locStore.activeFilter === f.id }"
        @click="setFilter(f.id)"
      >
        {{ f.label }}
      </button>
    </div>

    <div
      v-if="locStore.activeFilter === 'personal' && !locStore.nearbyActive && (!collapsed || mobileOpen)"
      class="sort-drawer"
      role="group"
      aria-label="Personal list"
    >
      <span class="sort-label">List</span>
      <button
        v-for="list in personalLists"
        :key="list.id"
        type="button"
        class="sort-select"
        :class="{ 'sort-select--active': locStore.personalListFilter === list.id }"
        @click="setPersonalList(list.id)"
      >
        {{ list.label }}
        <span class="list-count">{{ personalListCount(list.id) }}</span>
      </button>
    </div>

    <div class="sidebar-content" v-show="!collapsed || mobileOpen">
      <SidebarFoodDrawer />
    </div>
  </nav>
</template>

<style scoped>
.sidebar-backdrop {
  display: none;
}

.sidebar {
  width: var(--sidebar-width);
  min-width: 320px;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--sidebar-bg);
  border-right: 1px solid var(--border-soft);
  overflow: hidden;
  transition: width 0.22s cubic-bezier(0.4, 0, 0.2, 1), transform 0.22s cubic-bezier(0.4, 0, 0.2, 1);
  flex-shrink: 0;
  z-index: 600;
}

.sidebar.collapsed {
  width: 72px;
  min-width: 72px;
  background:
    linear-gradient(180deg, rgba(15, 110, 86, 0.04) 0%, transparent 28%),
    var(--sidebar-bg);
}

/* ── Collapsed icon rail ─────────────────────────────── */
.rail {
  display: flex;
  flex-direction: column;
  align-items: center;
  height: 100%;
  padding: 10px 4px 12px;
  gap: 2px;
}

.rail-toggle {
  width: 40px;
  height: 40px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface);
  color: var(--text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  flex-shrink: 0;
  box-shadow: var(--shadow-xs);
  transition:
    background var(--transition),
    color var(--transition),
    border-color var(--transition),
    box-shadow var(--transition),
    transform var(--transition);
}

.rail-toggle:hover {
  background: var(--gradient-accent);
  border-color: transparent;
  color: white;
  box-shadow: var(--shadow-glow);
  transform: translateX(1px);
}

.rail-divider {
  width: 20px;
  height: 1px;
  background: var(--border);
  margin: 6px 0 8px;
  flex-shrink: 0;
}

.rail-btn {
  position: relative;
  width: 100%;
  min-height: 58px;
  padding: 7px 2px 6px;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  flex-shrink: 0;
  transition:
    background var(--transition),
    color var(--transition),
    border-color var(--transition),
    box-shadow var(--transition);
}

.rail-btn:hover {
  background: var(--surface);
  color: var(--text);
  border-color: var(--border);
  box-shadow: var(--shadow-xs);
}

.rail-btn--active {
  background: var(--accent-bg);
  color: var(--accent);
  border-color: rgba(15, 110, 86, 0.22);
  box-shadow: inset 3px 0 0 var(--accent);
}

.rail-btn--active:hover {
  background: var(--accent-bg);
  color: var(--accent);
  border-color: rgba(15, 110, 86, 0.35);
  box-shadow: inset 3px 0 0 var(--accent);
}

.rail-btn--nearby {
  background: rgba(255, 250, 240, 0.95);
  color: #C05621;
  border-color: rgba(221, 107, 32, 0.28);
  box-shadow: inset 3px 0 0 #DD6B20;
}

.rail-btn--nearby:hover {
  background: #FEF1DF;
  border-color: rgba(221, 107, 32, 0.4);
  color: #C05621;
  box-shadow: inset 3px 0 0 #DD6B20;
}

.rail-icon-wrap {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 24px;
  font-size: 20px;
  line-height: 1;
}

.rail-caption {
  display: block;
  max-width: 100%;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.01em;
  line-height: 1.15;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: inherit;
  opacity: 0.78;
}

.rail-btn--active .rail-caption,
.rail-btn:hover .rail-caption {
  opacity: 1;
}

.rail-badge {
  position: absolute;
  top: -4px;
  right: -8px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: var(--radius-full);
  background: var(--accent-2);
  color: white;
  font-size: 10px;
  font-weight: 700;
  line-height: 16px;
  text-align: center;
  box-shadow: 0 0 0 1.5px var(--sidebar-bg);
  pointer-events: none;
}

.rail-btn--active .rail-badge {
  background: var(--accent);
  color: white;
}

.rail-btn--nearby .rail-badge {
  background: #DD6B20;
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 64px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--border-soft);
  flex-shrink: 0;
}

.header-text {
  min-width: 0;
}

.header-title {
  font-family: var(--font-display);
  font-size: 22px;
  font-weight: 400;
  color: var(--text);
  margin: 0 0 2px;
  letter-spacing: -0.01em;
}

.header-count {
  font-size: 14px;
  color: var(--text-muted);
  margin: 0;
}

.toggle-btn {
  width: 32px;
  height: 32px;
  background: var(--surface);
  border: 1px solid var(--border);
  cursor: pointer;
  color: var(--text-secondary);
  border-radius: var(--radius-xs);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 18px;
  transition: background var(--transition), color var(--transition), border-color var(--transition);
}

.toggle-btn:hover {
  background: var(--gradient-accent);
  border-color: transparent;
  color: white;
  box-shadow: var(--shadow-glow);
}

.sidebar-content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 8px;
}

.sidebar-content::-webkit-scrollbar {
  width: 5px;
}

.sidebar-content::-webkit-scrollbar-thumb {
  background: var(--border);
  border-radius: var(--radius-full);
}

.search-container {
  position: relative;
  display: flex;
  align-items: center;
  padding: 10px 12px 0;
  flex-shrink: 0;
}

.search-icon {
  position: absolute;
  left: 24px;
  color: var(--text-muted);
  font-size: 18px;
  pointer-events: none;
}

.search-input {
  width: 100%;
  height: 40px;
  padding: 0 34px 0 36px;
  font-size: 15px;
  border: 1px solid var(--border);
  border-radius: var(--radius-full);
  background: var(--surface);
  color: var(--text);
  outline: none;
  transition: border-color var(--transition), box-shadow var(--transition), background var(--transition);
}

.search-input:hover {
  border-color: rgba(15, 110, 86, 0.3);
}

.search-input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}

.search-input::placeholder {
  color: var(--text-hint);
}

.search-input::-webkit-search-cancel-button,
.search-input::-webkit-search-decoration {
  -webkit-appearance: none;
  appearance: none;
  display: none;
}

.search-clear {
  position: absolute;
  right: 20px;
  width: 24px;
  height: 24px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 15px;
}

.search-clear:hover {
  background: var(--border-soft);
  color: var(--text);
}

.filter-select {
  border: 1px solid var(--border);
  border-radius: var(--radius-full);
  padding: 7px 14px;
  flex-shrink: 0;
  background: var(--surface);
  color: var(--text-secondary);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background var(--transition), color var(--transition), border-color var(--transition);
}

.filter-select--active {
  background: var(--gradient-accent);
  color: white;
  border-color: transparent;
  box-shadow: var(--shadow-glow);
}

.filter-select:hover {
  border-color: rgba(15, 110, 86, 0.3);
  color: var(--text);
}

.filter-drawer {
  display: flex;
  overflow-x: auto;
  padding: 10px 12px 8px;
  gap: 6px;
  border-bottom: 1px solid var(--border-soft);
}

.nearby-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 12px;
  border-bottom: 1px solid rgba(221, 107, 32, 0.2);
  background: rgba(255, 250, 240, 0.95);
}

.nearby-banner-text {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  font-size: 14px;
  font-weight: 600;
  color: #C05621;
}

.nearby-banner-text i {
  font-size: 18px;
  flex-shrink: 0;
}

.nearby-banner-clear {
  flex-shrink: 0;
  border: 1px solid rgba(221, 107, 32, 0.28);
  border-radius: var(--radius-full);
  padding: 5px 12px;
  background: white;
  color: #C05621;
  font: inherit;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.nearby-banner-clear:hover {
  background: #DD6B20;
  border-color: #DD6B20;
  color: white;
}

.sort-drawer {
  display: flex;
  align-items: center;
  overflow-x: auto;
  padding: 8px 12px;
  gap: 6px;
  border-bottom: 1px solid var(--border-soft);
  background: var(--bg);
}

.sort-drawer--filters {
  padding-top: 6px;
  padding-bottom: 6px;
}

.sort-label {
  flex-shrink: 0;
  font-size: 13px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-muted);
  margin-right: 2px;
}

.sort-select {
  border: 1px solid transparent;
  border-radius: var(--radius-full);
  padding: 6px 12px;
  flex-shrink: 0;
  background: transparent;
  color: var(--text-secondary);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background var(--transition), color var(--transition), border-color var(--transition);
}

.sort-select--active {
  background: var(--surface);
  color: var(--text);
  border-color: var(--border);
  box-shadow: var(--shadow-xs);
}

.sort-select:hover {
  color: var(--text);
}

.list-count {
  margin-left: 4px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-muted);
}

.sort-select--active .list-count {
  color: var(--text-secondary);
}

@media (max-width: 720px) {
  .sidebar-backdrop {
    display: block;
    position: fixed;
    inset: var(--nav-height) 0 0 0;
    background: rgba(26, 26, 24, 0.35);
    z-index: 550;
  }

  .sidebar {
    position: fixed;
    top: var(--nav-height);
    left: 0;
    bottom: 0;
    width: min(440px, 86vw);
    min-width: 0;
    transform: translateX(-105%);
    border-right: 1px solid var(--border-soft);
    box-shadow: var(--shadow-lg);
  }

  .sidebar.collapsed {
    width: min(440px, 86vw);
    min-width: 0;
    transform: translateX(-105%);
  }

  .sidebar--mobile-open,
  .sidebar--mobile-open.collapsed {
    transform: translateX(0);
  }
}
</style>
