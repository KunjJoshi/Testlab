import { API_BASE_URL, api } from '@/lib/api'

/*
 * The backend keeps the session in an HttpOnly `testlab_session` cookie, so the
 * app never sees the JWT: `api()` just sends `credentials: 'include'`. After
 * GitHub, the backend redirects to FRONTEND_URL (or /login?error=… on failure).
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
