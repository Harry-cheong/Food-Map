<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import SidebarFoodDrawer from './SidebarFoodDrawer.vue'
import { useLocationStore, type PlaceFilter } from '../stores/location'

const locStore = useLocationStore()
const collapsed = ref(false)
const mobileOpen = ref(false)

const filters: { id: PlaceFilter; label: string }[] = [
  { id: 'personal', label: 'Personal' },
  { id: 'following', label: 'Following' },
]

function setFilter(id: PlaceFilter) {
  locStore.setFilter(id)
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
        <p class="header-title">Your spots</p>
        <p class="header-count">
          {{ locStore.places.length }}
          {{ locStore.places.length === 1 ? 'place' : 'places' }} saved
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
  font-size: 14px;
  font-weight: 600;
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
  background: var(--accent-bg);
  border-color: rgba(15, 110, 86, 0.2);
  color: var(--accent);
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
  background: var(--accent-bg);
  color: var(--accent);
  border-color: rgba(15, 110, 86, 0.25);
}

.filter-select:hover {
  border-color: rgba(15, 110, 86, 0.2);
}

.filter-drawer {
  display: flex;
  overflow-x: auto;
  padding: 10px 12px 8px;
  gap: 6px;
  border-bottom: 1px solid var(--border-soft);
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
