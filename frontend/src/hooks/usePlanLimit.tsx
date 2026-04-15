import { createContext, useContext, useState, ReactNode } from 'react'
import UpgradeModal from '../components/UpgradeModal'
import { usePlanUsage } from './usePlanUsage'

interface LimitPayload {
  resource: string
  used: number
  limit: number
  plan: string
  monthly: boolean
}

interface PlanLimitContextType {
  showUpgradeModal: (payload: LimitPayload) => void
  /** Call after a successful create to refresh usage counters */
  refreshUsage: () => void
}

const PlanLimitContext = createContext<PlanLimitContextType | null>(null)

export function PlanLimitProvider({ children }: { children: ReactNode }) {
  const [modal, setModal] = useState<LimitPayload | null>(null)
  const { data: planUsage, refresh } = usePlanUsage()

  function showUpgradeModal(payload: LimitPayload) {
    setModal(payload)
  }

  return (
    <PlanLimitContext.Provider value={{ showUpgradeModal, refreshUsage: refresh }}>
      {children}
      {modal && (
        <UpgradeModal
          resource={modal.resource}
          used={modal.used}
          limit={modal.limit}
          plan={planUsage?.plan ?? modal.plan}
          monthly={planUsage?.monthly ?? modal.monthly}
          onClose={() => setModal(null)}
        />
      )}
    </PlanLimitContext.Provider>
  )
}

export function usePlanLimit() {
  const ctx = useContext(PlanLimitContext)
  if (!ctx) throw new Error('usePlanLimit deve ser usado dentro de PlanLimitProvider')
  return ctx
}

/**
 * Helper: wraps an axios error and, if it's a 402 limit exceeded response,
 * shows the upgrade modal and returns true (so caller can bail out).
 * Returns false if not a limit error (caller should handle normally).
 */
export function handleLimitError(
  err: any,
  showUpgradeModal: (p: LimitPayload) => void,
  plan: string,
  monthly: boolean,
): boolean {
  if (err?.response?.status === 402 && err?.response?.data?.limitExceeded) {
    const d = err.response.data
    showUpgradeModal({
      resource: d.resource,
      used: d.used,
      limit: d.limit,
      plan,
      monthly,
    })
    return true
  }
  return false
}
