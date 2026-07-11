import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

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

  const isLoggedIn = computed(() => !!token.value)

  function login(userData: User, tokenData: string) {
    if (!tokenData) return
    user.value = userData
    token.value = tokenData
    localStorage.setItem('token', tokenData)
  }

  function logout() {
    user.value = null
    token.value = null
    localStorage.removeItem('token')
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

  return { user, token, isLoggedIn, login, logout }
})
