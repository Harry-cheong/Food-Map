<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useLocationStore } from '../stores/location'

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

const avatarInitial = computed(() =>
  auth.user?.username?.charAt(0).toUpperCase() ?? '?',
)

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

    <div class="search-container">
      <i class="mdi mdi-magnify search-icon"></i>
      <input
        type="search"
        class="search-input"
        placeholder="Search your saved spots…"
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
  box-shadow: var(--shadow-xs);
}

.nav-right {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.search-container {
  position: relative;
  display: flex;
  align-items: center;
  flex: 1;
  max-width: 360px;
}

.search-icon {
  position: absolute;
  left: 12px;
  color: var(--text-muted);
  font-size: 18px;
  pointer-events: none;
}

.search-input {
  width: 100%;
  height: 38px;
  padding: 0 36px 0 38px;
  font-size: 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius-full);
  background: var(--bg);
  color: var(--text);
  outline: none;
  transition: border-color var(--transition), box-shadow var(--transition), background var(--transition);
}

.search-input:focus {
  border-color: var(--accent);
  background: var(--surface);
  box-shadow: 0 0 0 3px var(--accent-soft);
}

.search-input::placeholder {
  color: var(--text-hint);
}

.search-clear {
  position: absolute;
  right: 8px;
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
}

.search-clear:hover {
  background: var(--border-soft);
  color: var(--text);
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
  background: var(--accent);
  color: white;
  border: none;
}

.btn-primary:hover {
  background: var(--accent-hover);
  box-shadow: var(--shadow-sm);
}

.btn-primary:active {
  transform: scale(0.98);
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
  animation: slideUp 0.28s cubic-bezier(0.4, 0, 0.2, 1);
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
  width: 48px;
  height: 48px;
  margin: 0 auto 16px;
  border-radius: var(--radius-md);
  background: var(--accent-bg);
  color: var(--accent);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
}

.login-title {
  font-family: var(--font-display);
  font-size: 28px;
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
  background: var(--accent);
  border: none;
  padding: 13px 20px;
  border-radius: var(--radius-sm);
  font-size: 14px;
  font-weight: 600;
  color: white;
  cursor: pointer;
  transition: background var(--transition), transform var(--transition), box-shadow var(--transition), opacity var(--transition);
  margin-top: 4px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.submit-btn:hover:not(:disabled) {
  background: var(--accent-hover);
  box-shadow: var(--shadow-sm);
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

  .search-container {
    max-width: none;
  }
}
</style>
