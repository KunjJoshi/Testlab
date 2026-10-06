import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { Toaster } from 'sonner'
import { router } from './app/router'
import { TooltipProvider } from './components/ui/Tooltip'
import { ApiError } from './lib/api'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: true,
      // Client errors (403/404, …) won't fix themselves; only retry network/server trouble.
      retry: (count, error) =>
        count < 2 && !(error instanceof ApiError && error.status >= 400 && error.status < 500),
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={250}>
        <RouterProvider router={router} />
        <Toaster
          position="bottom-right"
          toastOptions={{
            className: '!rounded-2xl !bg-ink !text-paper !border-0 !font-sans !shadow-pop',
          }}
        />
      </TooltipProvider>
    </QueryClientProvider>
  </StrictMode>,
)
