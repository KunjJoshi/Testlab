import { Navigate, Outlet, useLocation } from 'react-router'
import { FullPageMessage, FullPageSpinner } from '@/components/ui/FullPage'
import { Button } from '@/components/ui/Button'
import { errorMessage } from '@/lib/api'
import { useAuth } from './context'

export function RequireAuth() {
  const { status, error, retry, endReason } = useAuth()
  const location = useLocation()

  if (status === 'loading') return <FullPageSpinner label="Opening your notebook…" />

  if (status === 'error') {
    return (
      <FullPageMessage title="Testlab is unreachable" body={errorMessage(error)}>
        <Button onClick={retry}>Try again</Button>
      </FullPageMessage>
    )
  }

  if (status === 'signed-out') {
    const params = new URLSearchParams({ next: location.pathname + location.search })
    if (endReason) params.set('reason', endReason)
    return <Navigate to={`/login?${params}`} replace />
  }

  return <Outlet />
}
