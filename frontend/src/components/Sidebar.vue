<script setup lang="ts">
import { ref, computed } from 'vue'
import SidebarFoodDrawer from './SidebarFoodDrawer.vue'
import { useLocationStore } from '../stores/location'

const locStore = useLocationStore()
const collapsed = ref(false)

const filters = Array<string>(
  "Personal", 
  "Following",
)

const filterStyle: Record<string, { bg: string; color: string }> = {
}

function filterColors(category: string) {
  return filterStyle[category] ?? { bg: '#F3F4F6', color: '#4B5563' }
}

function addFilter() {

}

const placeCount = computed(() => locStore.places.length)
</script>

<template>
  <nav class="sidebar" :class="{ collapsed }" aria-label="Saved places">
    <div class="sidebar-header">
      <div class="header-text" v-if="!collapsed">
        <p class="header-title">Your spots</p>
        <p class="header-count">
          {{ placeCount }} {{ placeCount === 1 ? 'place' : 'places' }} saved
        </p>
      </div>
      
      <button
        class="toggle-btn"
        @click="collapsed = !collapsed"
        :aria-label="collapsed ? 'Expand sidebar' : 'Collapse sidebar'"
      >
        <i :class="collapsed ? 'mdi mdi-chevron-right' : 'mdi mdi-chevron-left'"></i>
      </button>
    </div>

    <div class="filter-drawer" v-if="!collapsed">
      <button
        v-for="f in filters"
        class="filter-select"
        :style="{
          backgroundColor: filterColors(f).bg,
          color: filterColors(f).color,
        }"
        @click="addFilter"
      >
        {{ f }}
      </button>
    </div>


    <div class="sidebar-content" v-show="!collapsed">
      <SidebarFoodDrawer />
    </div>
  </nav>
</template>

<style scoped>
.sidebar {
  width: var(--sidebar-width);
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--sidebar-bg);
  border-right: 1px solid grey;
  overflow: hidden;
  transition: width 0.22s cubic-bezier(0.4, 0, 0.2, 1);
  flex-shrink: 0;
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
  border: 1px solid transparent;
  border-radius: 10px;
  padding: 5px;
  padding-inline: 10px;
  flex-shrink: 0 /* Prevent children from being squished when scrolling */
}

.filter-drawer {
  display: flex;
  height: 50px;
  overflow-x: auto;
  padding-top: 10px;
  padding-bottom: 5px;
  gap: 5px;
}
</style>
