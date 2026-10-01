import { createContext, use } from 'react'
import type { Me } from '@/lib/types'

export type SessionEndReason = 'expired' | 'signed-out'

export interface AuthState {
  user: Me | null
  status: 'loading' | 'signed-in' | 'signed-out' | 'error'
  error: unknown
  /** Why the last session ended in this tab, if it did. */
  endReason: SessionEndReason | null
  retry: () => void
  login: () => void
  logout: () => Promise<void>
}

export const meKey = ['me'] as const

export const AuthContext = createContext<AuthState | null>(null)

export function useAuth(): AuthState {
  const ctx = use(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}

/** For pages behind <RequireAuth>, where the user is guaranteed. */
export function useCurrentUser(): Me {
  const { user } = useAuth()
  if (!user) throw new Error('useCurrentUser used outside a signed-in route')
  return user
}
