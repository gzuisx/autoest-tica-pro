import posthog from 'posthog-js'

/** Identifica o usuário no PostHog após login. Só executa se o PostHog estiver inicializado. */
export function identifyUser(userId: string, props?: { email?: string; name?: string; tenantId?: string; plan?: string }) {
  if (!import.meta.env.VITE_POSTHOG_KEY) return
  posthog.identify(userId, props)
}

/** Reseta a identidade do PostHog no logout. */
export function resetAnalytics() {
  if (!import.meta.env.VITE_POSTHOG_KEY) return
  posthog.reset()
}

/** Rastreia um evento customizado. */
export function trackEvent(event: string, props?: Record<string, unknown>) {
  if (!import.meta.env.VITE_POSTHOG_KEY) return
  posthog.capture(event, props)
}
