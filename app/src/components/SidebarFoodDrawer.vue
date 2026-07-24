<script lang="ts" setup>
import { useLocationStore } from '../stores/location'
import { categoryChipStyle } from '../constants/categories'
import { googleSearchUrl } from '../utils/googleSearch'
import type { PlaceSearchResult } from '../types/placesSearch'

const locStore = useLocationStore()

function formatNearbyRadius(meters: number): string {
  if (meters < 1000) return `${meters}m`
  return `${meters / 1000}km`
}

function formatSearchRating(place: PlaceSearchResult): string | null {
  if (place.rating == null) return null
  const count =
    place.user_rating_count != null ? ` · ${place.user_rating_count} reviews` : ''
  return `★ ${place.rating.toFixed(1)}${count}`
}

function formatStatus(status: string | null): string | null {
  if (!status) return null
  return status.replace(/_/g, ' ').toLowerCase()
}

function formatSavedDate(iso: string | null | undefined): string | null {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}
</script>

<template>
  <div v-if="locStore.nearbyActive" class="nearby-panel">
    <div
      v-if="locStore.isSearchingPlaces"
      class="empty-state"
    >
      <div class="empty-icon loading-spin">
        <i class="mdi mdi-loading"></i>
      </div>
      <p class="empty-title">Searching nearby…</p>
      <p class="empty-hint">Looking for restaurants around your location.</p>
    </div>

    <div
      v-else-if="locStore.placesSearchError"
      class="empty-state"
    >
      <div class="empty-icon">
        <i class="mdi mdi-alert-circle-outline"></i>
      </div>
      <p class="empty-title">Search failed</p>
      <p class="empty-hint">{{ locStore.placesSearchError }}</p>
      <button type="button" class="empty-action" @click="locStore.clearNearbySearch()">
        Dismiss
      </button>
    </div>

    <div
      v-else-if="locStore.placesSearchResults.length === 0"
      class="empty-state"
    >
      <div class="empty-icon">
        <i class="mdi mdi-store-search-outline"></i>
      </div>
      <p class="empty-title">No restaurants nearby</p>
      <p class="empty-hint">
        Nothing found within {{ formatNearbyRadius(locStore.nearbyRadiusM) }}. Try a larger radius.
      </p>
      <button type="button" class="empty-action" @click="locStore.clearNearbySearch()">
        Clear nearby search
      </button>
    </div>

    <div
      v-else-if="
        locStore.filteredNearbyResults.length === 0 &&
        (locStore.searchQuery.trim() ||
          locStore.nearbyMinRating != null ||
          locStore.nearbyMinReviews != null)
      "
      class="empty-state"
    >
      <div class="empty-icon">
        <i class="mdi mdi-magnify"></i>
      </div>
      <p class="empty-title">No matches</p>
      <p class="empty-hint">
        No nearby restaurants match your text, rating, or review filters.
      </p>
      <button
        type="button"
        class="empty-action"
        @click="
          locStore.setSearchQuery('');
          locStore.setNearbyMinRating(null);
          locStore.setNearbyMinReviews(null)
        "
      >
        Clear filters
      </button>
    </div>

    <TransitionGroup v-else name="list" tag="div" class="place-list">
      <div
        v-for="place in locStore.filteredNearbyResults"
        :key="place.google_place_id"
        class="sidebar-item"
        :class="{
          'sidebar-item--selected':
            locStore.selectedSearchResult?.google_place_id === place.google_place_id,
        }"
        @click="locStore.selectSearchResult(place)"
      >
        <a
          class="sidebar-google"
          :href="googleSearchUrl(place.name, place.formatted_address)"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Search on Google"
          title="Search on Google"
          @click.stop
        >
          <i class="mdi mdi-google"></i>
        </a>
        <div class="sidebar-label">
          <div class="icon-wrap icon-wrap--nearby">
            <i class="mdi mdi-store-search-outline"></i>
          </div>
          <div class="sidebar-info-box">
            <p class="sidebar-name">{{ place.name }}</p>
            <div class="sidebar-location">
              <i class="mdi mdi-map-marker-outline"></i>
              {{ place.formatted_address }}
            </div>
            <div class="sidebar-meta">
              <span class="sidebar-category sidebar-category--nearby">Restaurant</span>
              <span v-if="formatSearchRating(place)" class="sidebar-rating">
                {{ formatSearchRating(place) }}
              </span>
              <span v-if="formatStatus(place.business_status)" class="sidebar-status">
                {{ formatStatus(place.business_status) }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </TransitionGroup>
  </div>

  <div v-else-if="locStore.activeFilter === 'following'" class="empty-state">
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

  <div
    v-else-if="locStore.personalPlaces.length === 0 && locStore.places.length > 0"
    class="empty-state"
  >
    <div class="empty-icon">
      <i
        :class="
          locStore.personalListFilter === 'tried'
            ? 'mdi mdi-check-circle-outline'
            : 'mdi mdi-bookmark-outline'
        "
      ></i>
    </div>
    <p class="empty-title">
      {{ locStore.personalListFilter === 'tried' ? 'Nothing tried yet' : 'Nothing to try yet' }}
    </p>
    <p class="empty-hint">
      <template v-if="locStore.personalListFilter === 'tried'">
        Mark a spot as tried from the focus card when you’ve been.
      </template>
      <template v-else>
        Save a spot from the map, search, or nearby results to build this list.
      </template>
    </p>
    <button
      type="button"
      class="empty-action"
      @click="
        locStore.setPersonalListFilter(
          locStore.personalListFilter === 'tried' ? 'to_try' : 'tried',
        )
      "
    >
      Switch to {{ locStore.personalListFilter === 'tried' ? 'To try' : 'Tried' }}
    </button>
  </div>

  <div v-else-if="locStore.places.length === 0" class="empty-state">
    <div class="empty-icon">
      <i class="mdi mdi-map-marker-plus-outline"></i>
    </div>
    <p class="empty-title">No places yet</p>
    <p class="empty-hint">Use the + button on the map to pin a food spot in Singapore.</p>
  </div>

  <TransitionGroup v-else name="list" tag="div" class="place-list">
    <div
      v-for="place in locStore.filteredPlaces"
      :key="place.uid"
      class="sidebar-item"
      :class="{ 'sidebar-item--selected': locStore.selected?.uid === place.uid }"
      @click="locStore.selectPlace(place)"
    >
      <a
        class="sidebar-google sidebar-google--with-close"
        :href="googleSearchUrl(place.name, place.location)"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Search on Google"
        title="Search on Google"
        @click.stop
      >
        <i class="mdi mdi-google"></i>
      </a>
      <button
        class="sidebar-close"
        type="button"
        aria-label="Remove place"
        :disabled="locStore.isDeleting"
        @click.stop="locStore.deletePlace(place)"
      >
        <i class="mdi mdi-close"></i>
      </button>

      <div class="sidebar-label sidebar-label--actions">
        <div
          class="icon-wrap"
          :class="{
            'icon-wrap--tried': place.listStatus === 'tried',
          }"
        >
          <i
            :class="
              place.listStatus === 'tried'
                ? 'mdi mdi-check-circle-outline'
                : 'mdi mdi-silverware-fork-knife'
            "
          ></i>
        </div>
        <div class="sidebar-info-box">
          <p class="sidebar-name">{{ place.name }}</p>
          <div class="sidebar-location">
            <i class="mdi mdi-map-marker-outline"></i>
            {{ place.location }}
          </div>
          <div class="sidebar-meta">
            <span
              class="sidebar-category"
              :style="{
                backgroundColor: categoryChipStyle(place.category).bg,
                color: categoryChipStyle(place.category).color,
              }"
            >
              {{ place.category }}
            </span>
            <span
              class="sidebar-list-badge"
              :class="
                place.listStatus === 'tried'
                  ? 'sidebar-list-badge--tried'
                  : 'sidebar-list-badge--to-try'
              "
            >
              {{ place.listStatus === 'tried' ? 'Tried' : 'To try' }}
            </span>
            <span v-if="formatSavedDate(place.createdAt)" class="sidebar-saved-date">
              Saved {{ formatSavedDate(place.createdAt) }}
            </span>
          </div>
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
  font-size: 17px;
  font-weight: 600;
  color: var(--text);
  margin: 0 0 6px;
}

.empty-hint {
  font-size: 15px;
  color: var(--text-muted);
  margin: 0;
  line-height: 1.55;
  max-width: 220px;
}

.empty-action {
  margin-top: 14px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--accent);
  font-size: 15px;
  font-weight: 500;
  padding: 9px 16px;
  border-radius: var(--radius-full);
  cursor: pointer;
}

.empty-action:hover {
  background: var(--gradient-accent);
  border-color: transparent;
  color: white;
  box-shadow: var(--shadow-glow);
}


.nearby-panel {
  display: flex;
  flex-direction: column;
  min-height: 100%;
}

.icon-wrap--nearby {
  background: rgba(221, 107, 32, 0.12);
  color: #C05621;
}

.sidebar-item--selected .icon-wrap--nearby {
  background: rgba(221, 107, 32, 0.2);
  color: #9C4221;
}

.sidebar-category--nearby {
  background: rgba(221, 107, 32, 0.12);
  color: #C05621;
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
  min-height: 76px;
  padding: 12px 14px;
  cursor: pointer;
  border-radius: var(--radius-md);
  border: 1px solid transparent;
  background: var(--surface);
  transition: background var(--transition), border-color var(--transition), box-shadow var(--transition), transform var(--transition);
}

.sidebar-item--selected {
  background: var(--accent-bg);
  border-color: rgba(15, 110, 86, 0.2);
  box-shadow: var(--shadow-xs);
}

.sidebar-item--selected::before {
  content: '';
  position: absolute;
  left: 0;
  top: 10px;
  bottom: 10px;
  width: 3px;
  border-radius: var(--radius-full);
  background: var(--gradient-accent);
}

.sidebar-item:hover {
  border-color: var(--border);
  box-shadow: var(--shadow-md);
  transform: translateY(-1px);
}

.sidebar-item--selected:hover {
  border-color: rgba(15, 110, 86, 0.25);
}

.sidebar-label {
  display: flex;
  align-items: center;
  gap: 10px;
  padding-right: 28px;
}

.sidebar-label--actions {
  padding-right: 56px;
}

.sidebar-google {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  color: var(--text-muted);
  background: transparent;
  border-radius: var(--radius-xs);
  opacity: 0;
  text-decoration: none;
  transition: opacity var(--transition), color var(--transition), background var(--transition);
}

.sidebar-google--with-close {
  right: 36px;
}

.sidebar-google:hover {
  color: var(--accent);
  background: var(--accent-bg);
}

.sidebar-item:hover .sidebar-google {
  opacity: 1;
}

.icon-wrap {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-sm);
  background: var(--bg);
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  flex-shrink: 0;
  transition: background var(--transition), color var(--transition), box-shadow var(--transition);
}

.sidebar-item--selected .icon-wrap {
  background: var(--gradient-accent);
  color: white;
  box-shadow: var(--shadow-glow);
}

.icon-wrap--tried {
  background: rgba(15, 110, 86, 0.1);
  color: var(--accent);
}

.sidebar-info-box {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.sidebar-name {
  font-size: 15px;
  font-weight: 650;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--text);
  margin: 0;
  letter-spacing: -0.01em;
}

.sidebar-location {
  font-size: 13px;
  color: var(--text-secondary);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.sidebar-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.sidebar-category {
  font-size: 12px;
  font-weight: 600;
  padding: 2px 8px;
  width: fit-content;
  border-radius: var(--radius-full);
  letter-spacing: 0.01em;
}

.sidebar-list-badge {
  font-size: 12px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: var(--radius-full);
  letter-spacing: 0.01em;
}

.sidebar-list-badge--to-try {
  background: rgba(221, 107, 32, 0.12);
  color: #C05621;
}

.sidebar-list-badge--tried {
  background: rgba(15, 110, 86, 0.12);
  color: var(--accent);
}

.sidebar-rating,
.sidebar-status {
  font-size: 13px;
  color: var(--text-muted);
  text-transform: capitalize;
}

.sidebar-saved-date {
  font-size: 12px;
  color: var(--text-muted);
}

.sidebar-close {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
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




.loading-spin {
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.action-error {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin: 10px 4px 4px;
  padding: 8px 10px;
  font-size: 14px;
  color: var(--danger);
  background: var(--danger-bg);
  border-radius: var(--radius-sm);
  line-height: 1.4;
}
</style>
