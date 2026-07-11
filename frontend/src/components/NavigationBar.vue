<script setup lang="ts">
import { ref, computed } from 'vue'
import { useApi } from '../composables/useApi'
import { useAuthStore } from '../stores/auth'

const props = defineProps<{
  showLogin?: Boolean
}>()

const showLogin = ref(props.showLogin ?? false)
const loginFail = ref(false)
const username = ref('')
const password = ref('')

class TokenResponse {
  token: string | null
  token_type: string

  constructor(token: string | null, token_type: string) {
    this.token = token
    this.token_type = token_type
  }
}

const auth = useAuthStore()
const avatarInitial = computed(() =>
  auth.user?.username?.charAt(0).toUpperCase() ?? '?'
)

const submitLogin = async function () {
  const { data, execute } = useApi<TokenResponse>('/login', { method: 'POST' })
  await execute({ username: username.value, password: password.value })

  if (data.value) {
    loginFail.value = false
    auth.login({ username: username.value }, data.value.token ?? '')
    showLogin.value = false
  } else {
    loginFail.value = true
  }
}

function openLogin() {
  loginFail.value = false
  showLogin.value = true
}

function logout() {
  auth.logout()
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
        type="text"
        class="search-input"
        placeholder="Search hawkers, cafes, restaurants…"
      />
    </div>

    <div class="nav-right">
      <template v-if="auth.isLoggedIn">
        <span class="nav-greeting">Hi, {{ auth.user?.username }}</span>
        <button class="btn-ghost" @click="logout">Sign out</button>
        <div class="avatar">{{ avatarInitial }}</div>
      </template>
      <template v-else>
        <button class="btn-primary" @click="openLogin">
          <i class="mdi mdi-login"></i>
          Sign in
        </button>
        <div class="avatar avatar--guest">?</div>
      </template>
    </div>

  </nav>

  <Transition name="overlay">
      <div v-if="showLogin" class="overlay" @click.self="showLogin = false">
        <div class="login-popup">
          <button class="close-btn" @click="showLogin = false" aria-label="Close">
            <i class="mdi mdi-close"></i>
          </button>

          <div class="login-header">
            <div class="login-icon">
              <i class="mdi mdi-map-marker-radius"></i>
            </div>
            <h2 class="login-title">Welcome back</h2>
            <p class="login-subtitle">Sign in to save your favourite spots across Singapore.</p>
          </div>

          <div class="input-group">
            <label for="username">Username</label>
            <input
              class="input-field"
              type="text"
              id="username"
              v-model="username"
              placeholder="your username"
              @keyup.enter="submitLogin"
            />
          </div>
          <div class="input-group">
            <label for="password">Password</label>
            <input
              class="input-field"
              type="password"
              id="password"
              v-model="password"
              placeholder="••••••••"
              @keyup.enter="submitLogin"
            />
          </div>

          <p class="login-fail-msg" v-if="loginFail">
            <i class="mdi mdi-alert-circle-outline"></i>
            Incorrect username or password
          </p>

          <button class="submit-btn" @click="submitLogin">Sign in</button>
          <p class="login-footer">
            Don't have an account? <a href="#">Create one</a>
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
  padding: 0 14px 0 38px;
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
  transition: background var(--transition), transform var(--transition), box-shadow var(--transition);
  margin-top: 4px;
}

.submit-btn:hover {
  background: var(--accent-hover);
  box-shadow: var(--shadow-sm);
}

.submit-btn:active {
  transform: scale(0.99);
}

.login-footer {
  font-size: 13px;
  color: var(--text-muted);
  text-align: center;
  margin: 20px 0 0;
}

.login-footer a {
  color: var(--accent);
  font-weight: 500;
  text-decoration: none;
}

.login-footer a:hover {
  text-decoration: underline;
}
</style>
