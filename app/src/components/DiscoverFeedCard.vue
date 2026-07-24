<script setup lang="ts">
import { computed } from 'vue'
import type { DiscoveredPlace } from '../types/discovered'
import { categoryChipStyle } from '../constants/categories'
import { googleSearchUrl } from '../utils/googleSearch'

const props = defineProps<{
  place: DiscoveredPlace
  selected: boolean
  saved: boolean
  saving: boolean
}>()

const emit = defineEmits<{
  select: []
  save: []
}>()

const displayName = computed(
  () => props.place.google_name || props.place.restaurant_name,
)

const searchUrl = computed(() =>
  googleSearchUrl(displayName.value, props.place.formatted_address),
)

const ratingLabel = computed(() => {
  if (props.place.rating == null) return null
  const count =
    props.place.user_rating_count != null
      ? ` · ${props.place.user_rating_count} reviews`
      : ''
  return `★ ${props.place.rating.toFixed(1)}${count}`
})

const categoryStyle = computed(() =>
  categoryChipStyle(props.place.source_category?.trim() || 'Discovered'),
)

function onSave(event: Event) {
  event.stopPropagation()
  if (props.saved || props.saving) return
  emit('save')
}
</script>

<template>
  <article
    class="feed-card"
    :class="{ 'feed-card--selected': selected }"
    @click="emit('select')"
  >
    <div class="feed-card-label">
      <div class="feed-card-icon">
        <i class="mdi mdi-compass-outline"></i>
      </div>
      <div class="feed-card-info">
        <p class="feed-card-name">{{ displayName }}</p>
        <div class="feed-card-address">
          <i class="mdi mdi-map-marker-outline"></i>
          {{ place.formatted_address }}
        </div>
        <div class="feed-card-meta">
          <span
            v-if="place.source_category"
            class="feed-chip"
            :style="{
              backgroundColor: categoryStyle.bg,
              color: categoryStyle.color,
            }"
          >
            {{ place.source_category }}
          </span>
          <span v-if="ratingLabel" class="feed-rating">{{ ratingLabel }}</span>
        </div>
        <p v-if="place.source_title" class="feed-card-source-title">
          {{ place.source_title }}
        </p>
      </div>
    </div>

    <div class="feed-card-actions">
      <div class="feed-links">
        <a
          class="feed-link"
          :href="searchUrl"
          target="_blank"
          rel="noopener noreferrer"
          @click.stop
        >
          <i class="mdi mdi-google"></i>
          Google
        </a>
        <a
          class="feed-link"
          :href="place.source_url"
          target="_blank"
          rel="noopener noreferrer"
          @click.stop
        >
          <i class="mdi mdi-open-in-new"></i>
          Source article
        </a>
      </div>
      <button
        class="feed-save"
        type="button"
        :class="{ 'feed-save--saved': saved }"
        :disabled="saved || saving"
        @click="onSave"
      >
        <i
          :class="
            saving
              ? 'mdi mdi-loading mdi-spin'
              : saved
                ? 'mdi mdi-check'
                : 'mdi mdi-bookmark-outline'
          "
        ></i>
        {{ saving ? 'Saving…' : saved ? 'Saved' : 'Add to my list' }}
      </button>
    </div>
  </article>
</template>

<style scoped>
.feed-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  position: relative;
  min-height: 76px;
  padding: 12px 14px;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  background: var(--surface);
  cursor: pointer;
  transition:
    background var(--transition),
    border-color var(--transition),
    box-shadow var(--transition),
    transform var(--transition);
}

.feed-card:hover {
  border-color: var(--border);
  box-shadow: var(--shadow-md);
  transform: translateY(-1px);
}

.feed-card--selected {
  background: var(--accent-bg);
  border-color: rgba(15, 110, 86, 0.2);
  box-shadow: var(--shadow-xs);
}

.feed-card--selected::before {
  content: '';
  position: absolute;
  left: 0;
  top: 10px;
  bottom: 10px;
  width: 3px;
  border-radius: var(--radius-full);
  background: var(--gradient-accent);
}

.feed-card--selected:hover {
  border-color: rgba(15, 110, 86, 0.25);
}

.feed-card-label {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.feed-card-icon {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-sm);
  background: var(--bg);
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 18px;
  transition: background var(--transition), color var(--transition), box-shadow var(--transition);
}

.feed-card--selected .feed-card-icon {
  background: var(--gradient-accent);
  color: white;
  box-shadow: var(--shadow-glow);
}

.feed-card-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  flex: 1;
}

.feed-card-name {
  margin: 0;
  font-size: 15px;
  font-weight: 650;
  letter-spacing: -0.01em;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.feed-card-address {
  margin: 0;
  font-size: 13px;
  color: var(--text-secondary);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  line-height: 1.4;
}

.feed-card-address i {
  margin-right: 2px;
}

.feed-card-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}

.feed-chip {
  font-size: 12px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: var(--radius-full);
  letter-spacing: 0.01em;
  width: fit-content;
}

.feed-rating {
  font-size: 13px;
  color: var(--text-muted);
}

.feed-card-source-title {
  margin: 2px 0 0;
  font-size: 13px;
  color: var(--text-muted);
  line-height: 1.45;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.feed-card-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding-left: 50px;
}

.feed-links {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.feed-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  font-weight: 500;
  color: var(--accent);
  text-decoration: none;
}

.feed-link:hover {
  color: var(--accent-hover);
  text-decoration: underline;
}

.feed-save {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: none;
  border-radius: var(--radius-full);
  padding: 7px 14px;
  font-size: 14px;
  font-weight: 500;
  color: white;
  background: var(--gradient-accent);
  box-shadow: var(--shadow-glow);
  cursor: pointer;
  white-space: nowrap;
}

.feed-save:hover:not(:disabled) {
  filter: brightness(1.03);
}

.feed-save:disabled {
  cursor: default;
  opacity: 0.85;
}

.feed-save--saved {
  background: var(--accent-bg);
  color: var(--accent);
  box-shadow: none;
  border: 1px solid rgba(15, 110, 86, 0.2);
}

.feed-save--saved:disabled {
  opacity: 1;
}
</style>
