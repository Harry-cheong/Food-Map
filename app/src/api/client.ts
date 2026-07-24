/*
	- Shared HTTP client for the FoodMap API.
	- Token comes from a getter (wired to the auth store in main.ts); falls back to localStorage.
*/

export type ApiResult<T> =
  | { data: T; error: null; status: number }
  | { data: null; error: string; status: number | null }

export interface ApiRequestOptions {
  method?: string
  body?: unknown
  /*
  	- When false, skip Authorization even if a token exists (login / register).
  */
  auth?: boolean
}

const BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? (import.meta.env.DEV ? '/api' : 'http://127.0.0.1:8000')

let accessTokenGetter: () => string | null = () => localStorage.getItem('token')

export function setAccessTokenGetter(getter: () => string | null) {
  accessTokenGetter = getter
}

function formatErrorDetail(errBody: unknown, status: number): string {
  if (!errBody || typeof errBody !== 'object') {
    return `HTTP ${status}`
  }

  const body = errBody as { detail?: unknown; message?: unknown }
  const detail = body.detail

  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    const parts = detail
      .map((d) => (d && typeof d === 'object' && 'msg' in d ? String((d as { msg: unknown }).msg) : null))
      .filter(Boolean)
    if (parts.length) return parts.join(', ')
  }
  if (typeof body.message === 'string') return body.message
  return `HTTP ${status}`
}

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<ApiResult<T>> {
  const { method = 'GET', body, auth = true } = options
  const token = auth ? accessTokenGetter() : null

  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    })

    if (!response.ok) {
      const errBody = await response.json().catch(() => null)
      return {
        data: null,
        error: formatErrorDetail(errBody, response.status),
        status: response.status,
      }
    }

    if (response.status === 204) {
      return { data: null as T, error: null, status: 204 }
    }

    const data = (await response.json()) as T
    return { data, error: null, status: response.status }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return {
      data: null,
      error:
        message === 'Failed to fetch'
          ? 'Cannot reach the server. Is the backend running on port 8000?'
          : message,
      status: null,
    }
  }
}
