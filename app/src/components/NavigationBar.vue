<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useLocationStore } from '../stores/location'
import type { PlaceSearchResult } from '../types/placesSearch'

defineProps<{
  showLogin?: boolean
}>()

const auth = useAuthStore()
const locStore = useLocationStore()

const loginFail = ref(false)
const formError = ref('')
const username = ref('')
const password = ref('')
const confirmPassword = ref('')
const searchOpen = ref(false)
const searchRoot = ref<HTMLElement | null>(null)

const avatarInitial = computed(() =>
  auth.user?.username?.charAt(0).toUpperCase() ?? '?',
)

const showSearchDropdown = computed(() => {
  if (!searchOpen.value) return false
  const q = locStore.placesSearchQuery.trim()
  if (q.length < 2) return false
  return (
    locStore.isSearchingPlaces ||
    locStore.placesSearchError != null ||
    locStore.placesSearchResults.length > 0 ||
    q.length >= 2
  )
})

function onPlacesSearchInput(event: Event) {
  const value = (event.target as HTMLInputElement).value
  locStore.setPlacesSearchQuery(value)
  searchOpen.value = true
}

function clearHeaderSearch() {
  locStore.clearPlacesSearch()
  locStore.clearSelection()
  searchOpen.value = false
}

function pickSearchResult(place: PlaceSearchResult) {
  locStore.selectSearchResult(place)
  searchOpen.value = false
}

function formatRating(place: PlaceSearchResult): string | null {
  if (place.rating == null) return null
  const reviews =
    place.user_rating_count != null ? ` (${place.user_rating_count})` : ''
  return `★ ${place.rating.toFixed(1)}${reviews}`
}

function onDocumentPointerDown(event: PointerEvent) {
  const root = searchRoot.value
  if (!root) return
  if (event.target instanceof Node && !root.contains(event.target)) {
    searchOpen.value = false
  }
}

function onSearchKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    searchOpen.value = false
    ;(event.target as HTMLInputElement).blur()
  }
}

onMounted(() => {
  document.addEventListener('pointerdown', onDocumentPointerDown)
})

onUnmounted(() => {
  document.removeEventListener('pointerdown', onDocumentPointerDown)
})

const isRegister = computed(() => auth.authMode === 'register')
const modalTitle = computed(() => (isRegister.value ? 'Join FoodMap' : 'Welcome back'))
const modalSubtitle = computed(() =>
  isRegister.value
    ? 'Create an account to save and revisit your favourite spots.'
    : 'Sign in to save your favourite spots across Singapore.',
)
const isSubmitting = computed(() => auth.isAuthenticating)

watch(
  () => auth.showAuthModal,
  (open) => {
    if (open) {
      loginFail.value = false
      formError.value = ''
      password.value = ''
      confirmPassword.value = ''
    }
  },
)

async function submitLogin() {
  loginFail.value = false
  formError.value = ''

  const error = await auth.signIn(username.value, password.value)
  if (error) {
    loginFail.value = true
    formError.value = error
  }
}

async function submitRegister() {
  loginFail.value = false
  formError.value = ''

  if (!username.value.trim() || !password.value) {
    formError.value = 'Username and password are required'
    return
  }

  if (password.value.length < 6) {
    formError.value = 'Password must be at least 6 characters'
    return
  }

  if (password.value !== confirmPassword.value) {
    formError.value = 'Passwords do not match'
    return
  }

  const error = await auth.signUp(username.value.trim(), password.value)
  if (error) {
    loginFail.value = true
    formError.value = error
  }
}

function submitAuth() {
  if (isRegister.value) void submitRegister()
  else void submitLogin()
}

function switchToRegister() {
  formError.value = ''
  loginFail.value = false
  auth.openRegister()
}

function switchToLogin() {
  formError.value = ''
  loginFail.value = false
  auth.openLogin()
}
</script>

<template>
  <nav class="nav">
    <a class="nav-logo" href="/">
      <div class="logo-mark"><div class="logo-dot"></div></div>
      FoodMap
    </a>

    <div ref="searchRoot" class="nav-search">
      <i class="mdi mdi-magnify nav-search-icon" aria-hidden="true"></i>
      <input
        class="nav-search-input"
        type="search"
        placeholder="Search restaurants…"
        autocomplete="off"
        :value="locStore.placesSearchQuery"
        aria-label="Search restaurants"
        aria-autocomplete="list"
        :aria-expanded="showSearchDropdown"
        @input="onPlacesSearchInput"
        @focus="searchOpen = true"
        @keydown="onSearchKeydown"
      />
      <button
        v-if="locStore.placesSearchQuery"
        class="nav-search-clear"
        type="button"
        aria-label="Clear search"
        @click="clearHeaderSearch"
      >
        <i class="mdi mdi-close"></i>
      </button>

      <div v-if="showSearchDropdown" class="nav-search-dropdown" role="listbox">
        <p v-if="locStore.isSearchingPlaces" class="nav-search-status">
          <i class="mdi mdi-loading mdi-spin"></i>
          Searching…
        </p>
        <p v-else-if="locStore.placesSearchError" class="nav-search-status nav-search-status--error">
          {{ locStore.placesSearchError }}
        </p>
        <p
          v-else-if="locStore.placesSearchResults.length === 0"
          class="nav-search-status"
        >
          No restaurants found for “{{ locStore.placesSearchQuery.trim() }}”.
        </p>
        <button
          v-for="place in locStore.placesSearchResults"
          :key="place.google_place_id"
          class="nav-search-item"
          type="button"
          role="option"
          :class="{
            'nav-search-item--selected':
              locStore.selectedSearchResult?.google_place_id === place.google_place_id,
          }"
          @click="pickSearchResult(place)"
        >
          <span class="nav-search-item-name">{{ place.name }}</span>
          <span class="nav-search-item-meta">
            <span v-if="formatRating(place)" class="nav-search-item-rating">
              {{ formatRating(place) }}
            </span>
            <span class="nav-search-item-address">{{ place.formatted_address }}</span>
          </span>
        </button>
      </div>
    </div>

    <div class="nav-right">
      <template v-if="auth.isLoggedIn">
        <span class="nav-greeting">Hi, {{ auth.user?.username }}</span>
        <button class="btn-ghost" type="button" @click="auth.logout()">Sign out</button>
        <div class="avatar">{{ avatarInitial }}</div>
      </template>
      <template v-else>
        <button class="btn-primary" type="button" @click="auth.openLogin()">
          <i class="mdi mdi-login"></i>
          Sign in
        </button>
        <div class="avatar avatar--guest">?</div>
      </template>
    </div>
  </nav>

  <Transition name="overlay">
    <div
      v-if="auth.showAuthModal"
      class="overlay"
      @click.self="auth.closeAuthModal()"
    >
      <div class="login-popup" role="dialog" aria-modal="true" :aria-labelledby="'auth-title'">
        <button
          class="close-btn"
          type="button"
          aria-label="Close"
          @click="auth.closeAuthModal()"
        >
          <i class="mdi mdi-close"></i>
        </button>

        <div class="login-header">
          <div class="login-icon">
            <i :class="isRegister ? 'mdi mdi-account-plus' : 'mdi mdi-map-marker-radius'"></i>
          </div>
          <h2 id="auth-title" class="login-title">{{ modalTitle }}</h2>
          <p class="login-subtitle">{{ modalSubtitle }}</p>
        </div>

        <div class="input-group">
          <label for="username">Username</label>
          <input
            id="username"
            v-model="username"
            class="input-field"
            type="text"
            placeholder="your username"
            autocomplete="username"
            @keyup.enter="submitAuth"
          />
        </div>
        <div class="input-group">
          <label for="password">Password</label>
          <input
            id="password"
            v-model="password"
            class="input-field"
            type="password"
            placeholder="••••••••"
            autocomplete="current-password"
            @keyup.enter="submitAuth"
          />
        </div>
        <div v-if="isRegister" class="input-group">
          <label for="confirm-password">Confirm password</label>
          <input
            id="confirm-password"
            v-model="confirmPassword"
            class="input-field"
            type="password"
            placeholder="••••••••"
            autocomplete="new-password"
            @keyup.enter="submitAuth"
          />
        </div>

        <p v-if="formError || loginFail" class="login-fail-msg">
          <i class="mdi mdi-alert-circle-outline"></i>
          {{ formError || 'Incorrect username or password' }}
        </p>

        <button class="submit-btn" type="button" :disabled="isSubmitting" @click="submitAuth">
          <i v-if="isSubmitting" class="mdi mdi-loading mdi-spin"></i>
          <template v-else>{{ isRegister ? 'Create account' : 'Sign in' }}</template>
        </button>

        <p class="login-footer">
          <template v-if="isRegister">
            Already have an account?
            <button type="button" class="link-btn" @click="switchToLogin">Sign in</button>
          </template>
          <template v-else>
            Don't have an account?
            <button type="button" class="link-btn" @click="switchToRegister">Create one</button>
          </template>
        </p>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.nav {
  height: var(--nav-height);
  background: var(--surface);
  border-bottom: 1px solid var(--border-soft);
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 0 20px;
  flex-shrink: 0;
  box-shadow: var(--shadow-sm);
  position: relative;
  z-index: 700;
}

.nav::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: -1px;
  height: 2px;
  background: var(--gradient-text);
  opacity: 0.55;
}

.nav-search {
  position: relative;
  flex: 1;
  min-width: 0;
  max-width: 420px;
  display: flex;
  align-items: center;
  gap: 8px;
  height: 36px;
  padding: 0 10px 0 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-full);
  background: var(--bg);
  transition: border-color var(--transition), box-shadow var(--transition);
}

.nav-search:focus-within {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}

.nav-search-icon {
  color: var(--text-muted);
  font-size: 18px;
  flex-shrink: 0;
}

.nav-search-input {
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  font-size: 13px;
  color: var(--text);
}

.nav-search-input::placeholder {
  color: var(--text-muted);
}

.nav-search-clear {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  flex-shrink: 0;
}

.nav-search-clear:hover {
  background: var(--surface);
  color: var(--text);
}

.nav-search-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  right: 0;
  z-index: 800;
  max-height: min(360px, 60vh);
  overflow-y: auto;
  padding: 6px;
  background: var(--surface);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-xl);
}

.nav-search-status {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  padding: 12px 10px;
  font-size: 13px;
  color: var(--text-secondary);
}

.nav-search-status--error {
  color: var(--danger);
}

.nav-search-item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  width: 100%;
  padding: 10px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  text-align: left;
  cursor: pointer;
  transition: background var(--transition);
}

.nav-search-item:hover,
.nav-search-item--selected {
  background: var(--bg);
}

.nav-search-item-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
}

.nav-search-item-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 100%;
}

.nav-search-item-rating {
  font-size: 12px;
  color: var(--accent);
}

.nav-search-item-address {
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.35;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}

.nav-right {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

@media (max-width: 720px) {
  .nav-search {
    max-width: none;
  }

  .nav-greeting {
    display: none;
  }
}

.nav-greeting {
  font-size: 13px;
  color: var(--text-secondary);
}

.btn-primary,
.btn-ghost {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: var(--radius-full);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background var(--transition), color var(--transition), box-shadow var(--transition), transform var(--transition);
}

.btn-primary {
  background: var(--gradient-accent);
  color: white;
  border: none;
  box-shadow: var(--shadow-glow);
}

.btn-primary:hover {
  box-shadow: var(--shadow-glow-lg);
  transform: translateY(-1px);
}

.btn-primary:active {
  transform: scale(0.98) translateY(0);
}

.btn-ghost {
  background: transparent;
  color: var(--text-secondary);
  border: 1px solid var(--border);
}

.btn-ghost:hover {
  background: var(--bg);
  color: var(--text);
}

.login-fail-msg {
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

.overlay {
  position: fixed;
  inset: 0;
  background: rgba(26, 26, 24, 0.45);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.overlay-enter-active,
.overlay-leave-active {
  transition: opacity 0.2s ease;
}

.overlay-enter-from,
.overlay-leave-to {
  opacity: 0;
}

.login-popup {
  background: var(--surface);
  border: 1px solid var(--border-soft);
  width: min(400px, calc(100vw - 32px));
  padding: 36px 32px 28px;
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-xl);
  position: relative;
  overflow: hidden;
  animation: slideUp 0.28s cubic-bezier(0.4, 0, 0.2, 1);
}

.login-popup::before {
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
  transition: background var(--transition), color var(--transition);
}

.close-btn:hover {
  background: var(--border-soft);
  color: var(--text);
}

.login-header {
  text-align: center;
  margin-bottom: 24px;
}

.login-icon {
  width: 52px;
  height: 52px;
  margin: 0 auto 16px;
  border-radius: var(--radius-md);
  background: var(--gradient-accent);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  box-shadow: var(--shadow-glow);
}

.login-title {
  font-family: var(--font-display);
  font-size: 30px;
  font-weight: 400;
  margin: 0 0 6px;
  letter-spacing: -0.02em;
  color: var(--text);
}

.login-subtitle {
  font-size: 14px;
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

.submit-btn {
  width: 100%;
  background: var(--gradient-accent);
  border: none;
  padding: 13px 20px;
  border-radius: var(--radius-sm);
  font-size: 14px;
  font-weight: 600;
  color: white;
  cursor: pointer;
  transition: transform var(--transition), box-shadow var(--transition), opacity var(--transition);
  margin-top: 4px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  box-shadow: var(--shadow-glow);
}

.submit-btn:hover:not(:disabled) {
  box-shadow: var(--shadow-glow-lg);
  transform: translateY(-1px);
}

.submit-btn:active:not(:disabled) {
  transform: scale(0.99);
}

.submit-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.login-footer {
  font-size: 13px;
  color: var(--text-muted);
  text-align: center;
  margin: 20px 0 0;
}

.link-btn {
  background: none;
  border: none;
  padding: 0;
  color: var(--accent);
  font-weight: 500;
  font-size: inherit;
  cursor: pointer;
}

.link-btn:hover {
  text-decoration: underline;
}

@media (max-width: 720px) {
  .nav-greeting {
    display: none;
  }
}
</style>
