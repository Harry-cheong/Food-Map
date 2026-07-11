<script lang="ts" setup>
import { useLocationStore } from '../stores/location'

const locStore = useLocationStore()

const categoryStyle: Record<string, { bg: string; color: string }> = {
  Indian:    { bg: '#F3E8FF', color: '#7E22CE' },
  Chinese:   { bg: '#FEE2E2', color: '#B91C1C' },
  Japanese:  { bg: '#FCE7F3', color: '#BE185D' },
  Western:   { bg: '#DBEAFE', color: '#1D4ED8' },
  Malay:     { bg: '#D1FAE5', color: '#047857' },
  Korean:    { bg: '#EDE9FE', color: '#6D28D9' },
  Thai:      { bg: '#CCFBF1', color: '#0F766E' },
  Cafe:      { bg: '#F5F5F4', color: '#57534E' },
  'Fast Food': { bg: '#FFEDD5', color: '#C2410C' },
}

function categoryColors(category: string) {
  return categoryStyle[category] ?? { bg: '#F3F4F6', color: '#4B5563' }
}
</script>

<template>
  <div v-if="locStore.places.length === 0" class="empty-state">
    <div class="empty-icon">
      <i class="mdi mdi-map-marker-plus-outline"></i>
    </div>
    <p class="empty-title">No places yet</p>
    <p class="empty-hint">Click anywhere on the map to pin a food spot in Singapore.</p>
  </div>

  <TransitionGroup name="list" tag="div" class="place-list">
    <div
      v-for="place in locStore.places"
      :key="String(place.id)"
      class="sidebar-item"
      :class="{ 'sidebar-item--selected': locStore.selected === place }"
      @click="locStore.selectPlace(place)"
    >
      <button
        class="sidebar-close"
        @click.stop="locStore.deletePlace(place)"
        aria-label="Remove place"
      >
        <i class="mdi mdi-close"></i>
      </button>

      <div class="sidebar-label">
        <div class="icon-wrap">
          <i class="mdi mdi-silverware-fork-knife"></i>
        </div>
        <div class="sidebar-info-box">
          <p class="sidebar-name">{{ place.name }}</p>
          <div class="sidebar-location">
            <i class="mdi mdi-map-marker-outline"></i>
            {{ place.location }}
          </div>
          <span
            class="sidebar-category"
            :style="{
              backgroundColor: categoryColors(place.category).bg,
              color: categoryColors(place.category).color,
            }"
          >
            {{ place.category }}
          </span>
        </div>
      </div>
    </div>
  </TransitionGroup>
</template>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 40px 20px;
  animation: fadeIn 0.4s ease;
}

.empty-icon {
  width: 56px;
  height: 56px;
  border-radius: var(--radius-lg);
  background: var(--accent-bg);
  color: var(--accent);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  margin-bottom: 16px;
}

.empty-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text);
  margin: 0 0 6px;
}

.empty-hint {
  font-size: 13px;
  color: var(--text-muted);
  margin: 0;
  line-height: 1.55;
  max-width: 200px;
}

.place-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.list-enter-active {
  transition: all 0.25s ease;
}

.list-leave-active {
  transition: all 0.2s ease;
}

.list-enter-from {
  opacity: 0;
  transform: translateX(-8px);
}

.list-leave-to {
  opacity: 0;
  transform: translateX(8px);
}

.sidebar-item {
  display: flex;
  flex-direction: column;
  justify-content: center;
  position: relative;
  min-height: 68px;
  padding: 10px 12px;
  cursor: pointer;
  border-radius: var(--radius-md);
  border: 1px solid transparent;
  background: var(--surface);
  transition: background var(--transition), border-color var(--transition), box-shadow var(--transition);
}

.sidebar-item--selected {
  background: var(--accent-bg);
  border-color: rgba(15, 110, 86, 0.2);
  box-shadow: var(--shadow-xs);
}

.sidebar-item:hover {
  border-color: var(--border);
  box-shadow: var(--shadow-sm);
}

.sidebar-item--selected:hover {
  border-color: rgba(15, 110, 86, 0.25);
}

.sidebar-label {
  display: flex;
  align-items: center;
  gap: 10px;
  padding-right: 20px;
}

.icon-wrap {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-sm);
  background: var(--bg);
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  flex-shrink: 0;
}

.sidebar-item--selected .icon-wrap {
  background: rgba(15, 110, 86, 0.12);
  color: var(--accent);
}

.sidebar-info-box {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.sidebar-name {
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--text);
  margin: 0;
}

.sidebar-location {
  font-size: 11px;
  color: var(--text-secondary)
}

.sidebar-category {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  width: fit-content;
  border-radius: var(--radius-full);
  letter-spacing: 0.01em;
}

.sidebar-close {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  color: var(--text-muted);
  background: transparent;
  border: none;
  border-radius: var(--radius-xs);
  opacity: 0;
  cursor: pointer;
  transition: opacity var(--transition), color var(--transition), background var(--transition);
}

.sidebar-close:hover {
  color: var(--danger);
  background: var(--danger-bg);
}

.sidebar-item:hover .sidebar-close {
  opacity: 1;
}
</style>
