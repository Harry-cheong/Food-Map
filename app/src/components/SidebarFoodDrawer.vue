<script lang="ts" setup>
import { useLocationStore } from '../stores/location'
import { categoryChipStyle } from '../constants/categories'

const locStore = useLocationStore()
</script>

<template>
  <div v-if="locStore.activeFilter === 'following'" class="empty-state">
    <div class="empty-icon">
      <i class="mdi mdi-account-group-outline"></i>
    </div>
    <p class="empty-title">Following is coming soon</p>
    <p class="empty-hint">
      You’ll be able to see spots saved by people you follow. For now, stick with your personal list.
    </p>
    <button type="button" class="empty-action" @click="locStore.setFilter('personal')">
      Back to Personal
    </button>
  </div>

  <div
    v-else-if="locStore.filteredPlaces.length === 0 && locStore.searchQuery.trim()"
    class="empty-state"
  >
    <div class="empty-icon">
      <i class="mdi mdi-magnify"></i>
    </div>
    <p class="empty-title">No matches</p>
    <p class="empty-hint">Nothing in your list matches “{{ locStore.searchQuery.trim() }}”.</p>
    <button type="button" class="empty-action" @click="locStore.setSearchQuery('')">
      Clear search
    </button>
  </div>

  <div v-else-if="locStore.places.length === 0" class="empty-state">
    <div class="empty-icon">
      <i class="mdi mdi-map-marker-plus-outline"></i>
    </div>
    <p class="empty-title">No places yet</p>
    <p class="empty-hint">Click anywhere on the map to pin a food spot in Singapore.</p>
  </div>

  <TransitionGroup v-else name="list" tag="div" class="place-list">
    <div
      v-for="place in locStore.filteredPlaces"
      :key="place.uid"
      class="sidebar-item"
      :class="{ 'sidebar-item--selected': locStore.selected?.uid === place.uid }"
      @click="locStore.selectPlace(place)"
    >
      <button
        class="sidebar-close"
        type="button"
        aria-label="Remove place"
        :disabled="locStore.isDeleting"
        @click.stop="locStore.deletePlace(place)"
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
              backgroundColor: categoryChipStyle(place.category).bg,
              color: categoryChipStyle(place.category).color,
            }"
          >
            {{ place.category }}
          </span>
        </div>
      </div>
    </div>
  </TransitionGroup>

  <p v-if="locStore.actionError" class="action-error">
    <i class="mdi mdi-alert-circle-outline"></i>
    {{ locStore.actionError }}
  </p>
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

.empty-action {
  margin-top: 14px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--accent);
  font-size: 13px;
  font-weight: 500;
  padding: 8px 14px;
  border-radius: var(--radius-full);
  cursor: pointer;
}

.empty-action:hover {
  background: var(--accent-bg);
  border-color: rgba(15, 110, 86, 0.25);
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
  color: var(--text-secondary);
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

.action-error {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin: 10px 4px 4px;
  padding: 8px 10px;
  font-size: 12px;
  color: var(--danger);
  background: var(--danger-bg);
  border-radius: var(--radius-sm);
  line-height: 1.4;
}
</style>
