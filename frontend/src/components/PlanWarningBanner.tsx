import { AlertTriangle, X } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PlanUsage } from '../hooks/usePlanUsage'

const RESOURCE_LABELS: Record<string, string> = {
  clients: 'clientes',
  vehicles: 'veículos',
  serviceOrders: 'ordens de serviço',
  users: 'usuários',
}

interface Props {
  usage: PlanUsage
}

export default function PlanWarningBanner({ usage }: Props) {
  const navigate = useNavigate()
  const [dismissed, setDismissed] = useState(false)

  if (dismissed || usage.plan === 'pro') return null

  // Find resources at 80–99%
  const warnings = Object.entries(usage.usage)
    .filter(([, v]) => v.pct >= 80 && v.pct < 100 && isFinite(v.limit))
    .map(([key, v]) => ({ key, label: RESOURCE_LABELS[key] ?? key, ...v }))

  if (warnings.length === 0) return null

  const label = warnings.map((w) => `${w.label} (${w.used}/${w.limit})`).join(', ')

  return (
    <div className="flex items-center gap-3 bg-amber-50 border-b border-amber-200 px-4 py-2.5 text-sm text-amber-800">
      <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
      <span className="flex-1">
        <strong>Atenção:</strong> Você está próximo do limite do seu plano —{' '}
        {label}.{' '}
        {usage.monthly && (
          <span>Renova em {getNextMonthLabel()}. </span>
        )}
        <button
          onClick={() => navigate('/settings?tab=plan')}
          className="font-semibold underline hover:text-amber-900"
        >
          Ver detalhes ou fazer upgrade
        </button>
      </span>
      <button
        onClick={() => setDismissed(true)}
        className="shrink-0 rounded p-0.5 hover:bg-amber-100"
        aria-label="Fechar aviso"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

function getNextMonthLabel() {
  const d = new Date()
  const next = new Date(d.getFullYear(), d.getMonth() + 1, 1)
  return next.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })
}
