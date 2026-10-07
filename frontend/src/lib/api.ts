import { getToken } from "./authToken"

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api'

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

type SessionLostListener = () => void
const sessionLostListeners = new Set<SessionLostListener>()

export function onSessionLost(listener: SessionLostListener): () => void {
  sessionLostListeners.add(listener)
  return () => sessionLostListeners.delete(listener)
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: unknown
  signal?: AbortSignal
}

export async function api<T>(path: string, { method = 'GET', body, signal }: RequestOptions = {}) {
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  const token = getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`
  

  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    })
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === 'AbortError') throw cause
    throw new ApiError(0, 'Could not reach the Testlab server. Is the backend running?')
  }

  const text = await response.text()

  if (!response.ok) {
    const error = new ApiError(response.status, text.trim() || response.statusText)
    // 401 always means "no valid session" (permission failures are 403). From /me
    // that just means not signed in; anywhere else the session ended mid-use.
    if (error.status === 401 && path !== '/me') {
      sessionLostListeners.forEach((listener) => listener())
    }
    throw error
  }

  return (text ? JSON.parse(text) : undefined) as T
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const message = error.message
    return message.charAt(0).toUpperCase() + message.slice(1)
  }
  if (error instanceof Error) return error.message
  return 'Something went wrong.'
}
