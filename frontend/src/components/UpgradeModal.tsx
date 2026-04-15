import { X, Zap } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const RESOURCE_LABELS: Record<string, string> = {
  clients: 'clientes',
  vehicles: 'veículos',
  serviceOrders: 'ordens de serviço',
  users: 'usuários',
}

interface Props {
  resource: string
  used: number
  limit: number
  plan: string
  monthly: boolean
  onClose: () => void
}

export default function UpgradeModal({ resource, used, limit, plan, monthly, onClose }: Props) {
  const navigate = useNavigate()
  const label = RESOURCE_LABELS[resource] ?? resource

  function handleUpgrade() {
    onClose()
    navigate('/settings?tab=plan')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="relative rounded-t-2xl bg-gradient-to-r from-primary to-violet-500 px-6 py-5 text-white">
          <button
            onClick={onClose}
            className="absolute right-4 top-4 rounded-full p-1 hover:bg-white/20"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 mb-3">
            <Zap className="h-5 w-5" />
          </div>
          <h2 className="text-lg font-bold">Limite atingido</h2>
          <p className="text-sm text-white/80 mt-0.5">Você atingiu o limite do plano {plan}</p>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          <p className="text-sm text-muted-foreground mb-4">
            Você atingiu o limite de{' '}
            <strong className="text-foreground">{limit} {label}</strong>
            {monthly ? ' neste mês' : ''}.{' '}
            {monthly
              ? `O limite renova em ${getNextMonthLabel()}. Para continuar agora, faça o upgrade.`
              : 'Para continuar cadastrando, faça o upgrade do plano.'}
          </p>

          {/* Usage bar */}
          <div className="mb-6">
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>{label.charAt(0).toUpperCase() + label.slice(1)}</span>
              <span className="font-medium text-destructive">{used}/{isFinite(limit) ? limit : '∞'}</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full bg-destructive" style={{ width: '100%' }} />
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2">
            <button
              onClick={handleUpgrade}
              className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-white hover:bg-primary/90"
            >
              Fazer upgrade para o plano Pro
            </button>
            <button
              onClick={onClose}
              className="w-full rounded-xl border border-input py-3 text-sm font-medium text-muted-foreground hover:bg-muted/40"
            >
              Manter plano atual
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function getNextMonthLabel() {
  const d = new Date()
  const next = new Date(d.getFullYear(), d.getMonth() + 1, 1)
  return next.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })
}
