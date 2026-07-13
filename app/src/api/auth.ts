import { apiRequest } from './client'

export interface LoginCredentials {
  username: string
  password: string
}

export interface LoginResponse {
  token: string
  token_type: string
}

export interface MessageResponse {
  message: string
}

export function login(credentials: LoginCredentials) {
  return apiRequest<LoginResponse>('/login', {
    method: 'POST',
    body: credentials,
    auth: false,
  })
}

export function register(credentials: LoginCredentials) {
  return apiRequest<MessageResponse>('/newuser', {
    method: 'POST',
    body: credentials,
    auth: false,
  })
}
