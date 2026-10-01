import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { ApiError, api, onSessionLost } from '@/lib/api'
import type { Me } from '@/lib/types'
import { AuthContext, meKey, type AuthState, type SessionEndReason } from './context'
import { endSession, startGithubLogin } from './session'

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient()
  const [endReason, setEndReason] = useState<SessionEndReason | null>(null)

  const me = useQuery({
    queryKey: meKey,
    queryFn: async ({ signal }) => {
      try {
        return await api<Me>('/me', { signal })
      } catch (error) {
        // No session is an expected state, not an error.
        if (error instanceof ApiError && error.status === 401) return null
        throw error
      }
    },
    staleTime: 5 * 60_000,
    retry: false,
  })

  // Drop every cached resource but keep the `me` query alive (its observer is
  // mounted for the whole app), flipping it to signed-out. <RequireAuth> then
  // sends the user to the login page with `endReason`.
  const dropSession = useCallback(
    (reason: SessionEndReason) => {
      setEndReason(reason)
      qc.removeQueries({ predicate: (q) => q.queryKey[0] !== meKey[0] })
      qc.setQueryData(meKey, null)
    },
    [qc],
  )

  useEffect(() => onSessionLost(() => dropSession('expired')), [dropSession])

  const logout = useCallback(async () => {
    await endSession()
    dropSession('signed-out')
  }, [dropSession])

  const value = useMemo<AuthState>(
    () => ({
      user: me.data ?? null,
      status: me.isPending
        ? 'loading'
        : me.isError
          ? 'error'
          : me.data
            ? 'signed-in'
            : 'signed-out',
      error: me.error,
      endReason,
      retry: () => void me.refetch(),
      login: startGithubLogin,
      logout,
    }),
    [me, endReason, logout],
  )

  return <AuthContext value={value}>{children}</AuthContext>
}
