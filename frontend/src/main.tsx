import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import posthog from 'posthog-js'
import './index.css'
import App from './App.tsx'

// PostHog — analytics do app
// Defina VITE_POSTHOG_KEY no Vercel para ativar
const posthogKey = import.meta.env.VITE_POSTHOG_KEY as string | undefined
if (posthogKey) {
  posthog.init(posthogKey, {
    api_host: 'https://app.posthog.com',
    person_profiles: 'identified_only',
    capture_pageview: true,
    capture_pageleave: true,
  })
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </BrowserRouter>
  </StrictMode>,
)
