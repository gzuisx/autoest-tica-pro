import { useEffect, useState, useCallback } from 'react'
import api from '../services/api'

export interface ResourceUsage {
  used: number
  limit: number
  pct: number
}

export interface PlanUsage {
  plan: 'free' | 'basic' | 'pro'
  monthly: boolean
  periodLabel: string
  usage: {
    clients: ResourceUsage
    vehicles: ResourceUsage
    serviceOrders: ResourceUsage
    users: ResourceUsage
  }
}

export function usePlanUsage() {
  const [data, setData] = useState<PlanUsage | null>(null)
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    try {
      const { data: res } = await api.get('/plan/usage')
      setData(res)
    } catch {
      // silently ignore — don't break the app for usage fetch failure
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetch() }, [fetch])

  return { data, loading, refresh: fetch }
}
