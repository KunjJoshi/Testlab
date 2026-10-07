import { useEffect } from 'react'
import { useNavigate } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { setToken } from '@/lib/authToken'
import { meKey } from '@/auth/context'
import { FullPageSpinner } from '@/components/ui/FullPage'

export function AuthCallbackPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  useEffect(() => {
    const hash = window.location.hash
    const token = new URLSearchParams(hash.slice(1)).get('token')

    if (!token) {
      navigate('/login?error=callback_failed', { replace: true })
      return
    }

    setToken(token)
    window.history.replaceState(null, '', '/auth/callback')
    queryClient.invalidateQueries({ queryKey: meKey })
    navigate('/', { replace: true })
  }, [navigate, queryClient])

  return <FullPageSpinner label="Signing you in…" />
}