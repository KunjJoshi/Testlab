export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api'

/** Dev-only escape hatch: a JWT pasted into .env.local, never shipped in builds. */
const DEV_TOKEN = import.meta.env.DEV ? import.meta.env.VITE_DEV_TOKEN : undefined

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

/*
 * The backend also answers 401 for some permission failures (e.g. sharing a
 * suite you don't administer), so only the auth middleware's own messages mean
 * the session itself is gone.
 */
const SESSION_LOST_MESSAGES = [
  'missing or invalid authorization header',
  'invalid or expired token',
]

export function isSessionLost(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    error.status === 401 &&
    SESSION_LOST_MESSAGES.some((m) => error.message.toLowerCase().includes(m))
  )
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
  if (DEV_TOKEN) headers.Authorization = `Bearer ${DEV_TOKEN}`

  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'include',
      signal,
    })
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === 'AbortError') throw cause
    throw new ApiError(0, 'Could not reach the Testlab server. Is the backend running?')
  }

  const text = await response.text()

  if (!response.ok) {
    const error = new ApiError(response.status, text.trim() || response.statusText)
    // A 401 from /me just means "not signed in"; anywhere else it means the session ended.
    if (path !== '/me' && isSessionLost(error))
      sessionLostListeners.forEach((listener) => listener())
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
