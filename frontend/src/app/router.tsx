import { createBrowserRouter } from 'react-router'
import { RequireAuth } from '@/auth/RequireAuth'
import { FullPageSpinner } from '@/components/ui/FullPage'
import { LoginPage } from '@/pages/LoginPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { SuitesPage } from '@/pages/SuitesPage'
import { Root } from './Root'

export const router = createBrowserRouter([
  {
    element: <Root />,
    hydrateFallbackElement: <FullPageSpinner label="Loading Testlab…" />,
    children: [
      { path: '/login', element: <LoginPage /> },
      {
        path: '/auth/callback',
        lazy: () => import('@/pages/AuthCallbackPage').then((m) => ({ Component: m.AuthCallbackPage })),
      },
      {
        element: <RequireAuth />,
        children: [
          { path: '/', element: <SuitesPage /> },
          {
            path: '/suites/:suiteId',
            lazy: () => import('@/pages/SuitePage').then((m) => ({ Component: m.SuitePage })),
          },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
