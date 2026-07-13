<script setup lang="ts">
import { ref, watch } from 'vue'
import { FOOD_CATEGORIES } from '../constants/categories'

const props = defineProps<{
  open: boolean
  saving?: boolean
  error?: string | null
  addressHint?: string | null
}>()

const emit = defineEmits<{
  save: [payload: { name: string; category: string; description: string }]
  cancel: []
}>()

const name = ref('')
const category = ref<string>(FOOD_CATEGORIES[0])
const description = ref('')
const localError = ref('')

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      name.value = ''
      category.value = FOOD_CATEGORIES[0]
      description.value = ''
      localError.value = ''
    }
  }
)

function submit() {
  const trimmed = name.value.trim()
  if (!trimmed) {
    localError.value = 'Give this spot a name'
    return
  }
  localError.value = ''
  emit('save', {
    name: trimmed,
    category: category.value,
    description: description.value.trim() || 'No description yet.',
  })
}
</script>

<template>
  <Transition name="overlay">
    <div v-if="open" class="overlay" @click.self="emit('cancel')">
      <div class="modal" role="dialog" aria-labelledby="pin-label-title" aria-modal="true">
        <button class="close-btn" type="button" aria-label="Cancel" @click="emit('cancel')">
          <i class="mdi mdi-close"></i>
        </button>

        <div class="modal-header">
          <div class="modal-icon">
            <i class="mdi mdi-map-marker-plus"></i>
          </div>
          <h2 id="pin-label-title" class="modal-title">Label this spot</h2>
          <p class="modal-subtitle">
            {{ addressHint || 'Add a name and category before saving to your map.' }}
          </p>
        </div>

        <div class="input-group">
          <label for="pin-name">Name</label>
          <input
            id="pin-name"
            v-model="name"
            class="input-field"
            type="text"
            placeholder="e.g. Maxwell Chicken Rice"
            maxlength="80"
            autofocus
            @keyup.enter="submit"
          />
        </div>

        <div class="input-group">
          <label for="pin-category">Category</label>
          <select id="pin-category" v-model="category" class="input-field select-field">
            <option v-for="c in FOOD_CATEGORIES" :key="c" :value="c">{{ c }}</option>
          </select>
        </div>

        <div class="input-group">
          <label for="pin-desc">Notes <span class="optional">(optional)</span></label>
          <textarea
            id="pin-desc"
            v-model="description"
            class="input-field textarea-field"
            rows="3"
            placeholder="What should people try? Opening hours? Tips?"
            maxlength="280"
          />
        </div>

        <p v-if="localError || error" class="form-error">
          <i class="mdi mdi-alert-circle-outline"></i>
          {{ localError || error }}
        </p>

        <div class="actions">
          <button type="button" class="btn-ghost" :disabled="saving" @click="emit('cancel')">
            Cancel
          </button>
          <button type="button" class="btn-primary" :disabled="saving" @click="submit">
            <i v-if="saving" class="mdi mdi-loading mdi-spin"></i>
            <template v-else>
              <i class="mdi mdi-content-save-outline"></i>
              Save spot
            </template>
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(26, 26, 24, 0.45);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1100;
  padding: 16px;
}

.overlay-enter-active,
.overlay-leave-active {
  transition: opacity 0.2s ease;
}

.overlay-enter-from,
.overlay-leave-to {
  opacity: 0;
}

.modal {
  background: var(--surface);
  border: 1px solid var(--border-soft);
  width: min(420px, 100%);
  padding: 32px 28px 24px;
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-xl);
  position: relative;
  overflow: hidden;
  animation: slideUp 0.28s cubic-bezier(0.4, 0, 0.2, 1);
}

.modal::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: var(--gradient-text);
}

.close-btn {
  position: absolute;
  right: 14px;
  top: 14px;
  width: 32px;
  height: 32px;
  background: var(--bg);
  border: none;
  color: var(--text-muted);
  font-size: 18px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-full);
}

.close-btn:hover {
  background: var(--border-soft);
  color: var(--text);
}

.modal-header {
  text-align: center;
  margin-bottom: 22px;
}

.modal-icon {
  width: 52px;
  height: 52px;
  margin: 0 auto 14px;
  border-radius: var(--radius-md);
  background: var(--gradient-accent);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  box-shadow: var(--shadow-glow);
}

.modal-title {
  font-family: var(--font-display);
  font-size: 28px;
  font-weight: 400;
  margin: 0 0 6px;
  letter-spacing: -0.02em;
  color: var(--text);
}

.modal-subtitle {
  font-size: 13px;
  color: var(--text-secondary);
  margin: 0;
  line-height: 1.5;
}

.input-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 14px;
}

.input-group label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  letter-spacing: 0.02em;
  text-transform: uppercase;
}

.optional {
  text-transform: none;
  font-weight: 400;
  color: var(--text-muted);
  letter-spacing: 0;
}

.input-field {
  padding: 11px 14px;
  font-size: 15px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface);
  color: var(--text);
  outline: none;
  transition: border-color var(--transition), box-shadow var(--transition);
}

.input-field:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}

.select-field {
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath fill='%236B6960' d='M1.4 0L6 4.6 10.6 0 12 1.4 6 7.4 0 1.4z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 14px center;
  padding-right: 36px;
}

.textarea-field {
  resize: vertical;
  min-height: 72px;
  line-height: 1.45;
  font-family: inherit;
}

.form-error {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--danger);
  font-size: 13px;
  margin: 0 0 12px;
  padding: 8px 12px;
  background: var(--danger-bg);
  border-radius: var(--radius-sm);
}

.actions {
  display: flex;
  gap: 10px;
  margin-top: 8px;
}

.btn-ghost,
.btn-primary {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 12px 16px;
  border-radius: var(--radius-sm);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background var(--transition), color var(--transition), opacity var(--transition);
}

.btn-ghost {
  background: transparent;
  color: var(--text-secondary);
  border: 1px solid var(--border);
}

.btn-ghost:hover:not(:disabled) {
  background: var(--bg);
  color: var(--text);
}

.btn-primary {
  background: var(--gradient-accent);
  color: white;
  border: none;
  box-shadow: var(--shadow-glow);
}

.btn-primary:hover:not(:disabled) {
  box-shadow: var(--shadow-glow-lg);
  transform: translateY(-1px);
}

.btn-ghost:disabled,
.btn-primary:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}
</style>
