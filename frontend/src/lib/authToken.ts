const STORAGE_KEY = 'testlab_token'

export function getToken(): string | null {
  return sessionStorage.getItem(STORAGE_KEY)
}

export function setToken(token: string): void {
  sessionStorage.setItem(STORAGE_KEY, token)
}

export function clearToken(): void {
  sessionStorage.removeItem(STORAGE_KEY)
}