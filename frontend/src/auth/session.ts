import { API_BASE_URL, api } from '@/lib/api'

/*
 * Everything that depends on *how* the browser receives its session lives
 * here, so the transport (HttpOnly cookie vs. PKCE + bearer token) can change
 * without touching the rest of the app.
 *
 * Current assumption: the backend keeps the session in an HttpOnly cookie, so
 * the app never sees the JWT. `api()` sends `credentials: 'include'`.
 */

/** Full-page hop to the backend, which redirects to GitHub and back. */
export function startGithubLogin() {
  window.location.assign(`${API_BASE_URL}/auth/github/login`)
}

/** Best effort: ask the backend to clear the session cookie. */
export async function endSession() {
  try {
    await api('/auth/logout', { method: 'POST' })
  } catch {
    // The local session is dropped regardless.
  }
}
