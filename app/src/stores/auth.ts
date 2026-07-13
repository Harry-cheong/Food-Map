import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import * as authApi from '../api/auth'

interface User {
  username: string
}

interface JwtPayload {
  sub?: string
  username?: string
  exp?: number
}

function parseJwt(token: string): JwtPayload | null {
  try {
    const base64 = token.split('.')[1]
    if (!base64) return null
    return JSON.parse(atob(base64)) as JwtPayload
  } catch {
    return null
  }
}

function isTokenValid(token: string): boolean {
  const payload = parseJwt(token)
  if (!payload?.exp) return false
  return payload.exp * 1000 > Date.now()
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const token = ref<string | null>(null)
  const showAuthModal = ref(false)
  const authMode = ref<'login' | 'register'>('login')
  const isAuthenticating = ref(false)

  const isLoggedIn = computed(() => !!token.value)

  function login(userData: User, tokenData: string) {
    if (!tokenData) return
    user.value = userData
    token.value = tokenData
    localStorage.setItem('token', tokenData)
    showAuthModal.value = false
  }

  function logout() {
    user.value = null
    token.value = null
    localStorage.removeItem('token')
  }

  function openLogin() {
    authMode.value = 'login'
    showAuthModal.value = true
  }

  function openRegister() {
    authMode.value = 'register'
    showAuthModal.value = true
  }

  function closeAuthModal() {
    showAuthModal.value = false
  }

  /*
  	- Owns the login API call so views only handle form state + display errors.
  */
  async function signIn(username: string, password: string): Promise<string | null> {
    isAuthenticating.value = true
    const { data, error } = await authApi.login({ username, password })
    isAuthenticating.value = false

    if (!data?.token) {
      return error ?? 'Incorrect username or password'
    }

    login({ username }, data.token)
    return null
  }

  /*
  	- Register then sign in so the session is ready immediately.
  */
  async function signUp(username: string, password: string): Promise<string | null> {
    isAuthenticating.value = true

    const { error: registerError } = await authApi.register({ username, password })
    if (registerError) {
      isAuthenticating.value = false
      return registerError
    }

    const { data, error: loginError } = await authApi.login({ username, password })
    isAuthenticating.value = false

    if (!data?.token) {
      return loginError ?? 'Account created, but sign-in failed. Try signing in.'
    }

    login({ username }, data.token)
    return null
  }

  function restoreSession() {
    const stored = localStorage.getItem('token')
    if (!stored || !isTokenValid(stored)) {
      logout()
      return
    }

    token.value = stored
    const payload = parseJwt(stored)
    user.value = payload?.username ? { username: payload.username } : null
  }

  restoreSession()

  return {
    user,
    token,
    isLoggedIn,
    showAuthModal,
    authMode,
    isAuthenticating,
    login,
    logout,
    openLogin,
    openRegister,
    closeAuthModal,
    signIn,
    signUp,
  }
})
