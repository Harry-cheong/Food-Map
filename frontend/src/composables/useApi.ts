import { ref } from 'vue'
import type { Ref } from 'vue'

const BASE_URL = 'http://127.0.0.1:8000'

export const useApi = <T = unknown>(url: string, options: RequestInit = {}) => {
  const data: Ref<T | null> = ref(null) // data is the response you get back from the server after the request completes
  const error: Ref<string | null> = ref(null) 
  const isFetching = ref(false) // isFetching is a ref<boolean> that is true while the request is in-flight and false once it's done.isFetching is a ref<boolean> that is true while the request is in-flight and false once it's done. You use it to show loading states in your UI:

  const token = localStorage.getItem('token')

  const execute = async (body?: unknown) => {
    isFetching.value = true
    error.value = null

    try {
      const response = await fetch(`${BASE_URL}${url}`, {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...options.headers,
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        ...options,
      })

      if (!response.ok) {
        const errBody = await response.json().catch(() => null)
        throw new Error(errBody?.detail ?? errBody?.message ?? `HTTP ${response.status}`)
      }

      data.value = response.status === 204 ? null : await response.json()
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unknown error'
    } finally {
      isFetching.value = false
    }
  }

  return { data, error, isFetching, execute }
}