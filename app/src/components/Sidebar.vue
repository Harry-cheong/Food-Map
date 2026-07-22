<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import SidebarFoodDrawer from './SidebarFoodDrawer.vue'
import { useLocationStore, type DiscoveredSort, type PlaceFilter } from '../stores/location'

const locStore = useLocationStore()
const collapsed = ref(false)
const mobileOpen = ref(false)

const filters: { id: PlaceFilter; label: string }[] = [
  { id: 'personal', label: 'Personal' },
  { id: 'discovered', label: 'Discovered' },
  { id: 'following', label: 'Following' },
]

const sortOptions: { id: DiscoveredSort; label: string }[] = [
  { id: 'recent', label: 'Newest' },
  { id: 'rating', label: 'Highly rated' },
  { id: 'reviews', label: 'Most reviewed' },
]

function setFilter(id: PlaceFilter) {
  locStore.setFilter(id)
}

function setSort(id: DiscoveredSort) {
  locStore.setDiscoveredSort(id)
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

defineExpose({ openMobile, closeMobile })
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
    <div class="sidebar-header">
      <div class="header-text" v-if="!collapsed || mobileOpen">
        <p class="header-title">
          {{ locStore.activeFilter === 'discovered' ? 'Discovered' : 'Your spots' }}
        </p>
        <p class="header-count">
          <template v-if="locStore.activeFilter === 'discovered'">
            {{ locStore.discoveredPlaces.length }}
            of {{ locStore.discoveredTotal }}
            {{ locStore.discoveredTotal === 1 ? 'place' : 'places' }}
          </template>
          <template v-else>
            {{ locStore.places.length }}
            {{ locStore.places.length === 1 ? 'place' : 'places' }} saved
          </template>
        </p>
      </div>

      <button
        class="toggle-btn"
        type="button"
        :aria-label="collapsed && !mobileOpen ? 'Expand sidebar' : 'Collapse sidebar'"
        @click="toggleCollapsed"
      >
        <i
          :class="
            mobileOpen
              ? 'mdi mdi-close'
              : collapsed
                ? 'mdi mdi-chevron-right'
                : 'mdi mdi-chevron-left'
          "
        ></i>
      </button>
    </div>

    <div class="search-container" v-if="!collapsed || mobileOpen">
      <i class="mdi mdi-magnify search-icon"></i>
      <input
        type="search"
        class="search-input"
        :placeholder="
          locStore.activeFilter === 'discovered'
            ? 'Search discovered spots…'
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

    <div class="filter-drawer" v-if="!collapsed || mobileOpen">
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
      v-if="locStore.activeFilter === 'discovered' && (!collapsed || mobileOpen)"
      class="sort-drawer"
      role="group"
      aria-label="Sort discovered places"
    >
      <span class="sort-label">Sort</span>
      <button
        v-for="s in sortOptions"
        :key="s.id"
        type="button"
        class="sort-select"
        :class="{ 'sort-select--active': locStore.discoveredSort === s.id }"
        @click="setSort(s.id)"
      >
        {{ s.label }}
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
  width: 52px;
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 64px;
  padding: 14px 12px 14px 16px;
  border-bottom: 1px solid var(--border-soft);
  flex-shrink: 0;
}

.header-text {
  min-width: 0;
}

.header-title {
  font-family: var(--font-display);
  font-size: 19px;
  font-weight: 400;
  color: var(--text);
  margin: 0 0 2px;
  letter-spacing: -0.01em;
}

.header-count {
  font-size: 12px;
  color: var(--text-muted);
  margin: 0;
}

.toggle-btn {
  width: 28px;
  height: 28px;
  background: var(--surface);
  border: 1px solid var(--border);
  cursor: pointer;
  color: var(--text-secondary);
  border-radius: var(--radius-xs);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 16px;
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
  font-size: 16px;
  pointer-events: none;
}

.search-input {
  width: 100%;
  height: 36px;
  padding: 0 32px 0 34px;
  font-size: 13px;
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
  width: 22px;
  height: 22px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 13px;
}

.search-clear:hover {
  background: var(--border-soft);
  color: var(--text);
}

.filter-select {
  border: 1px solid var(--border);
  border-radius: var(--radius-full);
  padding: 6px 12px;
  flex-shrink: 0;
  background: var(--surface);
  color: var(--text-secondary);
  font-size: 12px;
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

.sort-drawer {
  display: flex;
  align-items: center;
  overflow-x: auto;
  padding: 8px 12px;
  gap: 6px;
  border-bottom: 1px solid var(--border-soft);
  background: var(--bg);
}

.sort-label {
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-muted);
  margin-right: 2px;
}

.sort-select {
  border: 1px solid transparent;
  border-radius: var(--radius-full);
  padding: 5px 10px;
  flex-shrink: 0;
  background: transparent;
  color: var(--text-secondary);
  font-size: 12px;
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
    width: min(300px, 86vw);
    transform: translateX(-105%);
    border-right: 1px solid var(--border-soft);
    box-shadow: var(--shadow-lg);
  }

  .sidebar.collapsed {
    width: min(300px, 86vw);
    transform: translateX(-105%);
  }

  .sidebar--mobile-open,
  .sidebar--mobile-open.collapsed {
    transform: translateX(0);
  }
}
</style>
