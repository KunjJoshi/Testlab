import { Outlet } from 'react-router'
import { AuthProvider } from '@/auth/AuthProvider'

export function Root() {
  return (
    <AuthProvider>
      <Outlet />
    </AuthProvider>
  )
}
