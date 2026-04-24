import { useState, useRef, useCallback, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { usePlanLimit, handleLimitError } from '../hooks/usePlanLimit'
import { usePlanUsage } from '../hooks/usePlanUsage'
import {
  Plus, ClipboardList, X, DollarSign, Eye, Camera, Trash2, Save,
  MessageCircle, Printer, Search, Pencil, ChevronDown, Ban,
} from 'lucide-react'
import { useForm, Controller } from 'react-hook-form'
import api from '../services/api'
import {
  formatCurrency, formatDate, STATUS_LABELS, STATUS_COLORS,
  PAYMENT_METHOD_LABELS, cn, getErrorMessage,
} from '../lib/utils'
import { ClientCombobox } from '../components/ClientCombobox'

const fc = (hasError?: boolean) =>
  cn(
    'w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors',
    hasError
      ? 'border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-100'
      : 'border-input focus:border-primary focus:ring-2 focus:ring-primary/20',
  )

function formatRegNum(n?: number) {
  return n ? `#${String(n).padStart(3, '0')}` : ''
}

// ─── MODAL NOVA OS ────────────────────────────────────────────────────────────

function NewOrderModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const { showUpgradeModal, refreshUsage } = usePlanLimit()
  const { data: planUsage } = usePlanUsage()
  const { register, handleSubmit, watch, control, formState: { errors } } = useForm<any>({ defaultValues: {} })
  const selectedClientId = watch('clientId')

  const { data: vehiclesData } = useQuery({
    queryKey: ['vehicles', selectedClientId],
    queryFn: () => api.get('/vehicles', { params: { clientId: selectedClientId } }).then((r) => r.data),
    enabled: !!selectedClientId,
  })
  const { data: quotesData } = useQuery({
    queryKey: ['quotes', selectedClientId, 'approved'],
    queryFn: () =>
      api.get('/quotes', { params: { clientId: selectedClientId, status: 'approved', limit: 20 } }).then((r) => r.data),
    enabled: !!selectedClientId,
  })

  const mutation = useMutation({
    mutationFn: (data: any) =>
      api.post('/service-orders', { ...data, finalValue: Number(data.finalValue), kmEntry: data.kmEntry ? Number(data.kmEntry) : undefined }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['service-orders'] }); refreshUsage(); onClose() },
    onError: (err: any) => {
      handleLimitError(err, showUpgradeModal, planUsage?.plan ?? 'basic', planUsage?.monthly ?? false)
    },
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Nova ordem de serviço</h2>
          <button onClick={onClose}><X className="h-5 w-5 text-muted-foreground" /></button>
        </div>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          {Object.keys(errors).length > 0 && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2">
              <p className="text-sm font-medium text-red-600">Preencha todos os campos obrigatórios</p>
            </div>
          )}
          <div>
            <label className="mb-1 block text-sm font-medium">Cliente *</label>
            <Controller
              name="clientId"
              control={control}
              rules={{ required: 'Selecione o cliente' }}
              render={({ field }) => (
                <ClientCombobox value={field.value ?? ''} onChange={(id) => field.onChange(id)} hasError={!!errors.clientId} />
              )}
            />
            {errors.clientId && <p className="mt-1 text-xs text-red-600">{errors.clientId.message}</p>}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Veículo *</label>
            <select
              {...register('vehicleId', { required: 'Selecione o veículo' })}
              disabled={!selectedClientId}
              className={cn(fc(errors.vehicleId), !selectedClientId && 'opacity-50')}
            >
              <option value="">{selectedClientId ? 'Selecione' : 'Selecione um cliente primeiro'}</option>
              {vehiclesData?.map((v: any) => (
                <option key={v.id} value={v.id}>{v.brand} {v.model} {v.plate && `(${v.plate})`}</option>
              ))}
            </select>
            {errors.vehicleId && <p className="mt-1 text-xs text-red-600">{errors.vehicleId.message}</p>}
          </div>
          {quotesData?.quotes?.length > 0 && (
            <div>
              <label className="mb-1 block text-sm font-medium">Orçamento aprovado (opcional)</label>
              <select {...register('quoteId')} className={fc()}>
                <option value="">Sem orçamento vinculado</option>
                {quotesData.quotes.map((q: any) => (
                  <option key={q.id} value={q.id}>#{q.number} — {formatCurrency(q.totalValue)}</option>
                ))}
              </select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium">Valor final (R$) *</label>
              <input
                {...register('finalValue', { required: 'Obrigatório', min: { value: 0.01, message: 'Valor deve ser maior que zero' } })}
                type="number" step="0.01" min="0" placeholder="0.00" className={fc(errors.finalValue)}
              />
              {errors.finalValue && <p className="mt-1 text-xs text-red-600">{errors.finalValue.message}</p>}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">KM na entrada</label>
              <input
                {...register('kmEntry')}
                type="number" min="0" placeholder="Ex: 45000" className={fc()}
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Observações</label>
            <textarea {...register('notes')} rows={2} className={fc()} />
          </div>
          {mutation.error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2">
              <p className="text-sm text-red-600">{getErrorMessage(mutation.error)}</p>
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 rounded-lg border py-2 text-sm font-medium hover:bg-muted">Cancelar</button>
            <button type="submit" disabled={mutation.isPending} className="flex-1 rounded-lg bg-primary py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60">
              {mutation.isPending ? 'Criando...' : 'Criar OS'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── MODAL DE PAGAMENTO ───────────────────────────────────────────────────────

function PaymentModal({ order, onClose }: { order: any; onClose: () => void }) {
  const qc = useQueryClient()
  const { register, handleSubmit, watch, formState: { errors } } = useForm<any>({ defaultValues: { method: 'pix', installments: 1 } })
  const method = watch('method')
  const remaining = order.finalValue - (order.payments?.reduce((a: number, p: any) => a + p.amount, 0) ?? 0)

  const mutation = useMutation({
    mutationFn: (data: any) =>
      api.post('/payments', {
        serviceOrderId: order.id,
        ...data,
        amount: Number(data.amount),
        installments: data.method === 'credit_card' ? Number(data.installments) : undefined,
      }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['service-orders'] }); qc.invalidateQueries({ queryKey: ['service-order-detail', order.id] }); onClose() },
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Registrar pagamento</h2>
          <button onClick={onClose}><X className="h-5 w-5 text-muted-foreground" /></button>
        </div>

        {/* Resumo financeiro */}
        <div className="mb-4 rounded-lg bg-muted/50 p-3 text-sm space-y-1">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Total da OS</span>
            <span className="font-semibold">{formatCurrency(order.finalValue)}</span>
          </div>
          {order.payments?.length > 0 && order.payments.map((p: any) => (
            <div key={p.id} className="flex justify-between text-xs">
              <span className="text-muted-foreground">
                {PAYMENT_METHOD_LABELS[p.method] ?? p.method}
                {p.installments && p.installments > 1 ? ` (${p.installments}x)` : ''}
              </span>
              <span className="text-green-600">- {formatCurrency(p.amount)}</span>
            </div>
          ))}
          <div className="flex justify-between border-t pt-1">
            <span className="font-medium text-muted-foreground">Valor pendente</span>
            <span className="font-bold text-primary">{formatCurrency(remaining)}</span>
          </div>
        </div>

        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Valor a pagar agora (R$) *</label>
            <input
              {...register('amount', { required: 'Obrigatório', min: { value: 0.01, message: 'Valor inválido' } })}
              type="number" step="0.01" min="0.01"
              defaultValue={remaining.toFixed(2)}
              className={fc(errors.amount)}
            />
            {errors.amount && <p className="mt-1 text-xs text-red-600">{errors.amount.message}</p>}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Forma de pagamento *</label>
            <select {...register('method')} className={fc()}>
              {Object.entries(PAYMENT_METHOD_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
          {method === 'credit_card' && (
            <div>
              <label className="mb-1 block text-sm font-medium">Parcelas</label>
              <select {...register('installments')} className={fc()}>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>{n === 1 ? 'À vista (1x)' : `${n}x de ${formatCurrency(remaining / n)}`}</option>
                ))}
              </select>
            </div>
          )}
          {remaining < order.finalValue && (
            <div className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">
              Pagamento parcial permitido — o restante pode ser pago depois.
            </div>
          )}
          {mutation.error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2">
              <p className="text-sm text-red-600">{getErrorMessage(mutation.error)}</p>
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 rounded-lg border py-2 text-sm font-medium hover:bg-muted">Cancelar</button>
            <button type="submit" disabled={mutation.isPending} className="flex-1 rounded-lg bg-primary py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60">
              {mutation.isPending ? 'Salvando...' : 'Registrar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── CHECKLIST ───────────────────────────────────────────────────────────────

const CHECKLIST_GROUPS = [
  {
    label: 'Sistema Elétrico',
    items: [
      { key: 'el_bateria', label: 'Bateria' },
      { key: 'el_alternador', label: 'Alternador / Fusíveis' },
      { key: 'el_buzina', label: 'Buzina' },
      { key: 'el_vidros', label: 'Vidros Elétricos' },
      { key: 'el_travas', label: 'Travas Elétricas' },
    ],
  },
  {
    label: 'Luzes',
    items: [
      { key: 'luz_farol_d', label: 'Faróis Dianteiros' },
      { key: 'luz_farol_t', label: 'Faróis Traseiros' },
      { key: 'luz_lanterna', label: 'Lanternas' },
      { key: 'luz_freio', label: 'Luz de Freio' },
      { key: 'luz_re', label: 'Luz de Ré' },
      { key: 'luz_seta', label: 'Setas' },
    ],
  },
  {
    label: 'Acessórios',
    items: [
      { key: 'ac_radio', label: 'Rádio / Som' },
      { key: 'ac_ar', label: 'Ar-Condicionado' },
      { key: 'ac_tapetes', label: 'Tapetes' },
      { key: 'ac_estepe', label: 'Estepe' },
      { key: 'ac_macaco', label: 'Macaco / Chave de Roda' },
    ],
  },
  {
    label: 'Outros',
    items: [
      { key: 'ou_combustivel', label: 'Nível de Combustível' },
      { key: 'ou_espelhos', label: 'Espelhos Retrovisores' },
      { key: 'ou_palhetas', label: 'Palhetas / Limpadores' },
      { key: 'ou_documentos', label: 'Documentos no Veículo' },
    ],
  },
]

// ─── MAPA DE DANOS ────────────────────────────────────────────────────────────

interface DamageSpot { id: string; x: number; y: number; label: string }

// Spots pré-definidos: vista superior (160×300)
const TOP_SPOTS: DamageSpot[] = [
  { id: 't_fb',  x: 80,  y: 18,  label: 'Para-choque dianteiro' },
  { id: 't_hL',  x: 50,  y: 50,  label: 'Capô esq.' },
  { id: 't_hR',  x: 110, y: 50,  label: 'Capô dir.' },
  { id: 't_fL',  x: 30,  y: 67,  label: 'Para-lama diant. esq.' },
  { id: 't_fR',  x: 130, y: 67,  label: 'Para-lama diant. dir.' },
  { id: 't_dFL', x: 30,  y: 133, label: 'Porta diant. esq.' },
  { id: 't_dFR', x: 130, y: 133, label: 'Porta diant. dir.' },
  { id: 't_rt',  x: 80,  y: 160, label: 'Teto' },
  { id: 't_dRL', x: 30,  y: 178, label: 'Porta tras. esq.' },
  { id: 't_dRR', x: 130, y: 178, label: 'Porta tras. dir.' },
  { id: 't_rL',  x: 50,  y: 247, label: 'Para-lama tras. esq.' },
  { id: 't_rR',  x: 110, y: 247, label: 'Para-lama tras. dir.' },
  { id: 't_tk',  x: 80,  y: 258, label: 'Porta-malas' },
  { id: 't_rb',  x: 80,  y: 287, label: 'Para-choque traseiro' },
]

// Spots pré-definidos: vista lateral (290×90)
const SIDE_SPOTS: DamageSpot[] = [
  { id: 's_fb',   x: 19,  y: 67, label: 'Para-choque dianteiro' },
  { id: 's_pfD',  x: 58,  y: 54, label: 'Para-lama dianteiro' },
  { id: 's_hood', x: 66,  y: 46, label: 'Capô' },
  { id: 's_ws',   x: 108, y: 34, label: 'Para-brisa' },
  { id: 's_teto', x: 144, y: 20, label: 'Teto' },
  { id: 's_rw',   x: 174, y: 32, label: 'Vidro traseiro' },
  { id: 's_trunk',x: 220, y: 44, label: 'Porta-malas' },
  { id: 's_pfT',  x: 228, y: 54, label: 'Para-lama traseiro' },
  { id: 's_rb',   x: 269, y: 66, label: 'Para-choque traseiro' },
  { id: 's_dF',   x: 118, y: 63, label: 'Porta dianteira' },
  { id: 's_dR',   x: 165, y: 63, label: 'Porta traseira' },
]

function VehicleDamageMap({
  activeSpots,
  onChange,
  readonly = false,
}: {
  activeSpots: string[]
  onChange?: (spots: string[]) => void
  readonly?: boolean
}) {
  const toggle = useCallback((id: string) => {
    if (readonly || !onChange) return
    onChange(activeSpots.includes(id) ? activeSpots.filter((s) => s !== id) : [...activeSpots, id])
  }, [activeSpots, onChange, readonly])

  const dot = (spot: DamageSpot) => {
    const active = activeSpots.includes(spot.id)
    return (
      <circle
        key={spot.id}
        cx={spot.x} cy={spot.y} r={5}
        fill={active ? '#111' : 'white'}
        stroke={active ? '#111' : '#555'}
        strokeWidth={1.2}
        style={{ cursor: readonly ? 'default' : 'pointer' }}
        onClick={() => toggle(spot.id)}
      >
        <title>{spot.label}</title>
      </circle>
    )
  }

  return (
    <div className="flex flex-col gap-3 w-full">
      <div>
        <p className="text-[10px] text-muted-foreground text-center mb-1 font-medium">Vista Superior</p>
        <svg viewBox="0 0 160 300" style={{ display: 'block', width: '100%', maxWidth: '120px', margin: '0 auto' }}>
          <text x="80" y="10" textAnchor="middle" fontSize="7" fill="#888" fontFamily="Arial">FRENTE</text>
          <rect x="35" y="14" width="90" height="7" rx="3" fill="#ccc" stroke="#555" strokeWidth="1"/>
          <rect x="28" y="21" width="104" height="62" rx="12" fill="#f0f0f0" stroke="#555" strokeWidth="1.5"/>
          <rect x="38" y="83" width="84" height="38" rx="3" fill="#b8d4f0" stroke="#555" strokeWidth="1"/>
          <rect x="28" y="121" width="104" height="78" rx="4" fill="#e0e0e0" stroke="#555" strokeWidth="1.5"/>
          <line x1="28" y1="160" x2="132" y2="160" stroke="#aaa" strokeWidth="0.8"/>
          <rect x="38" y="199" width="84" height="34" rx="3" fill="#b8d4f0" stroke="#555" strokeWidth="1"/>
          <rect x="28" y="233" width="104" height="50" rx="12" fill="#f0f0f0" stroke="#555" strokeWidth="1.5"/>
          <rect x="35" y="283" width="90" height="7" rx="3" fill="#ccc" stroke="#555" strokeWidth="1"/>
          <text x="80" y="298" textAnchor="middle" fontSize="7" fill="#888" fontFamily="Arial">TRASEIRA</text>
          <rect x="8" y="36" width="18" height="42" rx="5" fill="#333"/>
          <rect x="134" y="36" width="18" height="42" rx="5" fill="#333"/>
          <rect x="8" y="240" width="18" height="42" rx="5" fill="#333"/>
          <rect x="134" y="240" width="18" height="42" rx="5" fill="#333"/>
          {TOP_SPOTS.map(dot)}
        </svg>
      </div>
      <div>
        <p className="text-[10px] text-muted-foreground text-center mb-1 font-medium">Vista Lateral</p>
        <svg viewBox="0 0 290 90" style={{ display: 'block', width: '100%' }}>
          <path d="M 22 76 L 22 60 Q 23 52 36 52 L 90 52 L 102 22 L 182 22 L 200 38 L 240 48 L 260 54 L 264 68 L 264 76 Z" fill="#e8e8e8" stroke="#555" strokeWidth="1.5"/>
          <circle cx="68" cy="76" r="19" fill="white"/>
          <circle cx="212" cy="76" r="19" fill="white"/>
          <path d="M 48 76 Q 48 52 68 52 Q 88 52 88 76" fill="none" stroke="#555" strokeWidth="1.5"/>
          <path d="M 192 76 Q 192 52 212 52 Q 232 52 232 76" fill="none" stroke="#555" strokeWidth="1.5"/>
          <path d="M 90 52 L 102 22 L 124 22 L 124 52 Z" fill="#b8d4f0" stroke="#555" strokeWidth="0.8"/>
          <path d="M 165 22 L 182 22 L 200 38 L 165 52 Z" fill="#b8d4f0" stroke="#555" strokeWidth="0.8"/>
          <rect x="124" y="20" width="41" height="30" fill="#d8d8d8" stroke="none"/>
          <line x1="144" y1="36" x2="144" y2="72" stroke="#888" strokeWidth="0.8"/>
          <circle cx="68" cy="76" r="14" fill="#444" stroke="#333" strokeWidth="0.8"/>
          <circle cx="68" cy="76" r="6" fill="#888"/>
          <circle cx="212" cy="76" r="14" fill="#444" stroke="#333" strokeWidth="0.8"/>
          <circle cx="212" cy="76" r="6" fill="#888"/>
          <rect x="16" y="59" width="6" height="17" rx="2" fill="#ccc" stroke="#888" strokeWidth="0.8"/>
          <rect x="268" y="57" width="6" height="19" rx="2" fill="#ccc" stroke="#888" strokeWidth="0.8"/>
          {SIDE_SPOTS.map(dot)}
        </svg>
      </div>
    </div>
  )
}

// ─── MODAL DETALHE DA OS ──────────────────────────────────────────────────────

function OrderDetailModal({
  orderId, onClose, onPay,
}: { orderId: string; onClose: () => void; onPay: (order: any) => void }) {
  const qc = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [photoType, setPhotoType] = useState<'before' | 'after'>('before')
  const [checklistEdit, setChecklistEdit] = useState<Record<string, string> | null>(null)
  const [savingChecklist, setSavingChecklist] = useState(false)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const [editingOS, setEditingOS] = useState(false)
  const [editValue, setEditValue] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [savingOS, setSavingOS] = useState(false)
  const [changingStatus, setChangingStatus] = useState(false)
  const [activeSpots, setActiveSpots] = useState<string[]>([])
  const [savingDamage, setSavingDamage] = useState(false)
  const [damageEditing, setDamageEditing] = useState(false)

  const { data: order, isLoading } = useQuery({
    queryKey: ['service-order-detail', orderId],
    queryFn: () => api.get(`/service-orders/${orderId}`).then((r) => r.data),
  })

  useEffect(() => {
    if (order?.damageMap) {
      try {
        const parsed = JSON.parse(order.damageMap)
        // New format: string[] of spot IDs
        if (Array.isArray(parsed) && (parsed.length === 0 || typeof parsed[0] === 'string')) {
          setActiveSpots(parsed)
        } else {
          setActiveSpots([]) // old format (array of {id,x,y}) — reset
        }
      } catch { setActiveSpots([]) }
    } else {
      setActiveSpots([])
    }
  }, [order?.damageMap])

  const { data: statusHistory = [] } = useQuery({
    queryKey: ['service-order-history', orderId],
    queryFn: () => api.get(`/service-orders/${orderId}/history`).then((r) => r.data),
    enabled: !!orderId,
  })

  const deletePhotoMutation = useMutation({
    mutationFn: (photoId: string) => api.delete(`/photos/${photoId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['service-order-detail', orderId] }),
  })

  const statusMutation = useMutation({
    mutationFn: (status: string) => api.patch(`/service-orders/${orderId}/status`, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['service-orders'] })
      qc.invalidateQueries({ queryKey: ['service-order-detail', orderId] })
      qc.invalidateQueries({ queryKey: ['service-order-history', orderId] })
    },
  })

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    setUploading(true)
    const formData = new FormData()
    Array.from(files).forEach((f) => formData.append('photos', f))
    formData.append('serviceOrderId', orderId)
    formData.append('type', photoType)
    try {
      await api.post('/photos/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
      qc.invalidateQueries({ queryKey: ['service-order-detail', orderId] })
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const saveChecklist = async () => {
    if (!checklistEdit) return
    setSavingChecklist(true)
    try {
      await api.patch(`/service-orders/${orderId}/checklist`, checklistEdit)
      qc.invalidateQueries({ queryKey: ['service-order-detail', orderId] })
      setChecklistEdit(null)
    } finally {
      setSavingChecklist(false)
    }
  }

  const saveOS = async () => {
    setSavingOS(true)
    try {
      await api.patch(`/service-orders/${orderId}`, {
        finalValue: Number(editValue),
        notes: editNotes,
      })
      qc.invalidateQueries({ queryKey: ['service-orders'] })
      qc.invalidateQueries({ queryKey: ['service-order-detail', orderId] })
      setEditingOS(false)
    } finally {
      setSavingOS(false)
    }
  }

  const saveDamage = async () => {
    setSavingDamage(true)
    try {
      await api.patch(`/service-orders/${orderId}`, { damageMap: JSON.stringify(activeSpots) })
      qc.invalidateQueries({ queryKey: ['service-order-detail', orderId] })
      setDamageEditing(false)
    } finally {
      setSavingDamage(false)
    }
  }

  const startEditOS = () => {
    setEditValue(String(order.finalValue))
    setEditNotes(order.notes ?? '')
    setEditingOS(true)
  }

  const handlePrint = () => {
    if (!order) return
    const o = order
    const checklist = o.checklist ? JSON.parse(o.checklist) : {}

    // Helper: render a damage spot as SVG circle (hollow or filled black)
    const spotCircle = (spot: DamageSpot) => {
      const active = activeSpots.includes(spot.id)
      return `<circle cx="${spot.x}" cy="${spot.y}" r="5" fill="${active ? '#111' : 'white'}" stroke="${active ? '#111' : '#666'}" stroke-width="1.2"/>`
    }

    const topViewSvg = `
      <svg viewBox="0 0 160 300" width="90" height="168" style="display:block;margin:0 auto">
        <text x="80" y="10" text-anchor="middle" font-size="7" fill="#888" font-family="Arial">FRENTE</text>
        <rect x="35" y="14" width="90" height="7" rx="3" fill="#ccc" stroke="#555" stroke-width="1"/>
        <rect x="28" y="21" width="104" height="62" rx="12" fill="#f0f0f0" stroke="#555" stroke-width="1.5"/>
        <rect x="38" y="83" width="84" height="38" rx="3" fill="#b8d4f0" stroke="#555" stroke-width="1"/>
        <rect x="28" y="121" width="104" height="78" rx="4" fill="#e0e0e0" stroke="#555" stroke-width="1.5"/>
        <line x1="28" y1="160" x2="132" y2="160" stroke="#aaa" stroke-width="0.8"/>
        <rect x="38" y="199" width="84" height="34" rx="3" fill="#b8d4f0" stroke="#555" stroke-width="1"/>
        <rect x="28" y="233" width="104" height="50" rx="12" fill="#f0f0f0" stroke="#555" stroke-width="1.5"/>
        <rect x="35" y="283" width="90" height="7" rx="3" fill="#ccc" stroke="#555" stroke-width="1"/>
        <text x="80" y="298" text-anchor="middle" font-size="7" fill="#888" font-family="Arial">TRASEIRA</text>
        <rect x="8" y="36" width="18" height="42" rx="5" fill="#333"/>
        <rect x="134" y="36" width="18" height="42" rx="5" fill="#333"/>
        <rect x="8" y="240" width="18" height="42" rx="5" fill="#333"/>
        <rect x="134" y="240" width="18" height="42" rx="5" fill="#333"/>
        ${TOP_SPOTS.map(spotCircle).join('')}
      </svg>`

    const sideViewSvg = `
      <svg viewBox="0 0 290 90" width="200" height="62" style="display:block;margin:4px auto 0">
        <path d="M 22 76 L 22 60 Q 23 52 36 52 L 90 52 L 102 22 L 182 22 L 200 38 L 240 48 L 260 54 L 264 68 L 264 76 Z" fill="#e8e8e8" stroke="#555" stroke-width="1.5"/>
        <circle cx="68" cy="76" r="19" fill="white"/>
        <circle cx="212" cy="76" r="19" fill="white"/>
        <path d="M 48 76 Q 48 52 68 52 Q 88 52 88 76" fill="none" stroke="#555" stroke-width="1.5"/>
        <path d="M 192 76 Q 192 52 212 52 Q 232 52 232 76" fill="none" stroke="#555" stroke-width="1.5"/>
        <path d="M 90 52 L 102 22 L 124 22 L 124 52 Z" fill="#b8d4f0" stroke="#555" stroke-width="0.8"/>
        <path d="M 165 22 L 182 22 L 200 38 L 165 52 Z" fill="#b8d4f0" stroke="#555" stroke-width="0.8"/>
        <rect x="124" y="20" width="41" height="30" fill="#d8d8d8"/>
        <line x1="144" y1="36" x2="144" y2="72" stroke="#888" stroke-width="0.8"/>
        <circle cx="68" cy="76" r="14" fill="#444" stroke="#333" stroke-width="0.8"/>
        <circle cx="68" cy="76" r="6" fill="#888"/>
        <circle cx="212" cy="76" r="14" fill="#444" stroke="#333" stroke-width="0.8"/>
        <circle cx="212" cy="76" r="6" fill="#888"/>
        <rect x="16" y="59" width="6" height="17" rx="2" fill="#ccc" stroke="#888" stroke-width="0.8"/>
        <rect x="268" y="57" width="6" height="19" rx="2" fill="#ccc" stroke="#888" stroke-width="0.8"/>
        ${SIDE_SPOTS.map(spotCircle).join('')}
      </svg>`

    // Serviços: da quote ou notes como fallback
    const quoteItems = o.quote?.items ?? []
    const servicesList = quoteItems.length > 0
      ? quoteItems.map((item: any) => `<div class="service-item">• ${item.service?.name ?? item.description ?? '—'}${item.quantity && item.quantity > 1 ? ' (x' + item.quantity + ')' : ''}</div>`).join('')
      : o.notes
        ? `<div class="service-item">${o.notes}</div>`
        : '<div style="color:#aaa;font-style:italic">Nenhum serviço detalhado</div>'

    // Checklist: gerar HTML com boxes OK/DF/NA
    const checkBox = (key: string, opt: string) => {
      const val = (checklist[key] ?? '').toLowerCase()
      const checked = val === opt
      return `<span class="chk-box ${checked ? 'chk-' + opt : ''}">${opt.toUpperCase()}</span>`
    }
    const checklistGroupsHtml = CHECKLIST_GROUPS.map(group => `
      <div class="cl-group">
        <div class="cl-group-title">${group.label}</div>
        ${group.items.map(item => `
          <div class="cl-item">
            <span class="cl-label">${item.label}</span>
            <span class="cl-boxes">
              ${checkBox(item.key, 'ok')}
              ${checkBox(item.key, 'df')}
              ${checkBox(item.key, 'na')}
            </span>
          </div>
        `).join('')}
      </div>
    `).join('')

    const dateStr = new Date(o.createdAt).toLocaleDateString('pt-BR')
    const timeStr = new Date(o.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    const osNum = String(o.number).padStart(5, '0')

    const printHtml = `<!DOCTYPE html>
<html><head>
<meta charset="UTF-8"/>
<title>OS ${osNum}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 11px; color: #111; background: #fff; }
  .os-wrap { max-width: 780px; margin: 6px auto; border: 2px solid #333; }

  /* ── CÉLULA PADRÃO (estilo CEABS: label pequeno + valor) ── */
  .grid { border-top: 1px solid #333; border-left: 1px solid #333; }
  .row { display: flex; }
  .cell { border-right: 1px solid #333; border-bottom: 1px solid #333; flex: 1; min-width: 0; }
  .cell.w2 { flex: 2; }
  .cell.w3 { flex: 3; }
  .cell.w4 { flex: 4; }
  .lbl { font-size: 7.5px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.05em; color: #555; padding: 2px 5px 1px; background: #f2f2f2; border-bottom: 1px solid #d0d0d0; white-space: nowrap; overflow: hidden; }
  .val { font-size: 11px; font-weight: 600; padding: 3px 5px 5px; min-height: 20px; }
  .val.plate { font-size: 14px; letter-spacing: 3px; }
  .val.chassis { font-size: 10px; letter-spacing: 0.5px; }

  /* ── CABEÇALHO ── */
  .hdr { display: flex; align-items: stretch; border-bottom: 2px solid #333; background: #1a1a1a; color: #fff; }
  .hdr-emp { flex: 1; padding: 10px 14px; border-right: 1px solid #444; }
  .hdr-emp-name { font-size: 16px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.06em; }
  .hdr-emp-info { font-size: 9.5px; color: #ccc; margin-top: 3px; line-height: 1.5; }
  .hdr-mid { flex: 1.3; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 10px; text-align: center; border-right: 1px solid #444; }
  .hdr-mid-title { font-size: 14px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.1em; }
  .hdr-mid-sub { font-size: 10px; color: #bbb; margin-top: 2px; letter-spacing: 0.08em; }
  .hdr-os { width: 120px; padding: 10px 12px; display: flex; flex-direction: column; align-items: flex-end; justify-content: center; }
  .hdr-os-lbl { font-size: 8px; color: #aaa; text-transform: uppercase; letter-spacing: 0.06em; }
  .hdr-os-num { font-size: 20px; font-weight: bold; }
  .hdr-os-dt { font-size: 9.5px; color: #bbb; margin-top: 3px; }

  /* ── SERVIÇOS ── */
  .srv-hdr { background: #333; color: #fff; padding: 4px 10px; font-size: 9px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.1em; border-bottom: 1px solid #333; }
  .srv-body { min-height: 72px; padding: 7px 10px; border-bottom: 1px solid #333; border-right: 1px solid #333; border-left: 1px solid #333; }
  .svc { font-size: 11px; margin-bottom: 4px; }

  /* ── CHECKLIST + MAPA ── */
  .cl-map { display: flex; border-left: 1px solid #333; border-right: 1px solid #333; border-bottom: 1px solid #333; }
  .cl-col { flex: 1; border-right: 1px solid #333; padding: 6px 8px; }
  .map-col { width: 215px; padding: 6px 8px; display: flex; flex-direction: column; align-items: center; }
  .sec-hdr { font-size: 8px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.08em; color: #333; background: #eee; padding: 2px 6px; margin-bottom: 5px; border-bottom: 1px solid #ccc; }
  .cl-legend { font-size: 8px; color: #666; margin-bottom: 5px; }
  .cl-groups { display: flex; flex-wrap: wrap; gap: 0 12px; }
  .cl-group { width: calc(50% - 6px); margin-bottom: 5px; }
  .cl-grp-hdr { font-size: 8px; font-weight: bold; text-transform: uppercase; color: #222; background: #e8e8e8; padding: 1px 4px; margin-bottom: 2px; border-left: 2px solid #444; }
  .cl-item { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.5px; }
  .cl-lbl { font-size: 9px; color: #333; flex: 1; }
  .cl-boxes { display: flex; gap: 1.5px; }
  .cb { display: inline-flex; align-items: center; justify-content: center; width: 17px; height: 12px; border: 1px solid #999; font-size: 7.5px; font-weight: bold; color: #888; }
  .cb-ok { background: #d4edda; border-color: #27ae60; color: #1e8449; }
  .cb-df { background: #fff3cd; border-color: #e67e22; color: #c0392b; }
  .cb-na { background: #e9ecef; border-color: #666; color: #555; }
  .map-lbl { font-size: 8px; color: #555; text-align: center; margin-bottom: 3px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.04em; }
  .obs-area { border: 1px solid #bbb; min-height: 44px; width: 100%; margin-top: 5px; padding: 3px 5px; font-size: 9.5px; color: #888; }

  /* ── RODAPÉ ── */
  .ftr-row { display: flex; border-left: 1px solid #333; border-right: 1px solid #333; border-bottom: 1px solid #333; }
  .ftr-cell { flex: 1; border-right: 1px solid #333; }
  .ftr-cell:last-child { border-right: none; }
  .ftr-lbl { font-size: 7.5px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.05em; color: #555; padding: 2px 5px 1px; background: #f2f2f2; border-bottom: 1px solid #d0d0d0; }
  .ftr-val { min-height: 20px; padding: 3px 5px 5px; font-size: 11px; }
  .declaration { padding: 6px 10px; font-size: 9px; color: #444; line-height: 1.6; border-left: 1px solid #333; border-right: 1px solid #333; border-bottom: 1px solid #333; background: #fafafa; text-align: justify; }
  .sig-area { border-left: 1px solid #333; border-right: 1px solid #333; border-bottom: 2px solid #333; }
  .sig-row { display: flex; }
  .sig-cell { flex: 1; border-right: 1px solid #333; }
  .sig-cell:last-child { border-right: none; }
  .sig-lbl { font-size: 7.5px; font-weight: bold; text-transform: uppercase; color: #555; padding: 2px 5px 1px; background: #f2f2f2; border-bottom: 1px solid #d0d0d0; }
  .sig-val { min-height: 32px; padding: 3px 5px; }

  @media print {
    body { margin: 0; }
    .os-wrap { margin: 0; max-width: 100%; }
    @page { margin: 6mm; size: A4 portrait; }
  }
</style>
</head><body>
<div class="os-wrap">

  <!-- ══ CABEÇALHO ══ -->
  <div class="hdr">
    <div class="hdr-emp">
      <div class="hdr-emp-name">${o.tenant?.name ?? 'Estética Automotiva'}</div>
      <div class="hdr-emp-info">
        ${o.tenant?.address ?? ''}${o.tenant?.phone ? '<br>Tel: ' + o.tenant.phone : ''}
      </div>
    </div>
    <div class="hdr-mid">
      <div class="hdr-mid-title">Ordem de Serviço</div>
      <div class="hdr-mid-sub">Check-list de Veículo</div>
    </div>
    <div class="hdr-os">
      <div class="hdr-os-lbl">N° OS</div>
      <div class="hdr-os-num">${osNum}</div>
      <div class="hdr-os-dt">${dateStr} — ${timeStr}</div>
    </div>
  </div>

  <!-- ══ DADOS (grid de células estilo CEABS) ══ -->
  <div class="grid">

    <!-- Linha 1: Nome | N° OS | Data/Hora -->
    <div class="row">
      <div class="cell w3"><div class="lbl">Nome do Cliente</div><div class="val">${o.client?.name ?? ''}</div></div>
      <div class="cell"><div class="lbl">N° OS</div><div class="val">${osNum}</div></div>
      <div class="cell w2"><div class="lbl">Data / Hora de Atendimento</div><div class="val">${dateStr} &nbsp; ${timeStr}</div></div>
    </div>

    <!-- Linha 2: Endereço Estética | Placa -->
    <div class="row">
      <div class="cell w4"><div class="lbl">Endereço da Estética</div><div class="val">${o.tenant?.address ?? ''}</div></div>
      <div class="cell w2"><div class="lbl">Placa do Veículo</div><div class="val plate">${o.vehicle?.plate ?? ''}</div></div>
    </div>

    <!-- Linha 3: Chassi | Veículo/Modelo | Ano -->
    <div class="row">
      <div class="cell w3"><div class="lbl">Chassi</div><div class="val chassis">${o.vehicle?.chassis ?? ''}</div></div>
      <div class="cell w2"><div class="lbl">Veículo / Modelo</div><div class="val">${(o.vehicle?.brand ?? '') + ' ' + (o.vehicle?.model ?? '')}</div></div>
      <div class="cell"><div class="lbl">Ano Fab.</div><div class="val">${o.vehicle?.year ?? ''}</div></div>
    </div>

    <!-- Linha 4: Estética/Resp. | Contato Cliente | Telefone -->
    <div class="row">
      <div class="cell w2"><div class="lbl">Estética / Responsável</div><div class="val">${o.tenant?.name ?? ''}</div></div>
      <div class="cell w2"><div class="lbl">Contato do Cliente</div><div class="val">${o.client?.whatsapp || o.client?.phone || ''}</div></div>
      <div class="cell w2"><div class="lbl">Ponto de Referência</div><div class="val"></div></div>
    </div>

    <!-- Linha 5: Observação (full width) -->
    <div class="row">
      <div class="cell"><div class="lbl">Observação do Cliente</div><div class="val">${o.notes ?? ''}</div></div>
    </div>

  </div><!-- /grid -->

  <!-- ══ SERVIÇOS A REALIZAR ══ -->
  <div style="margin-top:4px">
    <div class="srv-hdr">Serviços a Serem Realizados</div>
    <div class="srv-body">
      ${servicesList}
    </div>
  </div>

  <!-- ══ CHECK-LIST + MAPA DE DANOS ══ -->
  <div class="cl-map" style="margin-top:4px">
    <div class="cl-col">
      <div class="sec-hdr">Check-list de Entrada</div>
      <div class="cl-legend">OK = Conforme &nbsp;|&nbsp; DF = Com Defeito &nbsp;|&nbsp; NA = Não se Aplica</div>
      <div class="cl-groups">
        ${checklistGroupsHtml}
      </div>
    </div>
    <div class="map-col">
      <div class="sec-hdr" style="width:100%;text-align:center">Mapa de Danos</div>
      <div class="map-lbl">Vista Superior</div>
      ${topViewSvg}
      <div class="map-lbl" style="margin-top:5px">Vista Lateral</div>
      ${sideViewSvg}
      <div style="font-size:8px;color:#777;margin-top:5px;margin-bottom:2px;font-weight:bold;text-transform:uppercase">Observações</div>
      <div class="obs-area"></div>
    </div>
  </div>

  <!-- ══ TÉCNICO / VISTO ══ -->
  <div class="ftr-row" style="margin-top:4px">
    <div class="ftr-cell w3"><div class="ftr-lbl">Técnico Responsável</div><div class="ftr-val"></div></div>
    <div class="ftr-cell"><div class="ftr-lbl">Visto</div><div class="ftr-val"></div></div>
  </div>

  <!-- ══ DECLARAÇÃO ══ -->
  <div class="declaration">
    Declaro estar ciente do serviço realizado, e que em caso de dúvida, fui orientado a entrar em contato com <strong>${o.tenant?.name ?? 'a estética'}</strong>.
    Acompanhei a vistoria feita antes do serviço, estando em pleno acordo com as condições descritas neste documento.
    O veículo será devolvido nas mesmas condições registradas acima.
  </div>

  <!-- ══ ASSINATURA ══ -->
  <div class="sig-area">
    <div class="sig-row">
      <div class="sig-cell" style="flex:1"><div class="sig-lbl">Local e Data</div><div class="sig-val"></div></div>
    </div>
    <div class="sig-row">
      <div class="sig-cell" style="flex:3"><div class="sig-lbl">Nome do Responsável (Cliente)</div><div class="sig-val"></div></div>
      <div class="sig-cell" style="flex:2"><div class="sig-lbl">CPF</div><div class="sig-val"></div></div>
    </div>
    <div class="sig-row">
      <div class="sig-cell"><div class="sig-lbl">Assinatura</div><div class="sig-val" style="min-height:44px"></div></div>
    </div>
  </div>

</div>
</body></html>`

    // Usar iframe para evitar bloqueio de popup
    const iframe = document.createElement('iframe')
    iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;opacity:0;border:none'
    document.body.appendChild(iframe)
    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document
    if (!iframeDoc) { document.body.removeChild(iframe); return }
    iframeDoc.open(); iframeDoc.write(printHtml); iframeDoc.close()
    setTimeout(() => {
      iframe.contentWindow?.print()
      setTimeout(() => { try { document.body.removeChild(iframe) } catch {} }, 2000)
    }, 300)
  }

  const checklist = order?.checklist ? JSON.parse(order.checklist) : {}
  const beforePhotos = order?.photos?.filter((p: any) => p.type === 'before') ?? []
  const afterPhotos = order?.photos?.filter((p: any) => p.type === 'after') ?? []

  const OS_STATUS_OPTIONS = [
    { value: 'open', label: 'Aberta' },
    { value: 'in_progress', label: 'Em andamento' },
    { value: 'completed', label: 'Concluída' },
    { value: 'cancelled', label: 'Cancelada' },
  ]

  return (
    <>
      {/* Lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            className="absolute right-4 top-4 text-white"
            onClick={() => setLightboxUrl(null)}
          >
            <X className="h-8 w-8" />
          </button>
          <img
            src={lightboxUrl}
            alt="foto"
            className="max-h-full max-w-full rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center p-0 sm:p-4">
        <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white shadow-xl">
          {/* Header */}
          <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-6 py-4">
            <div>
              <h2 className="text-lg font-semibold">OS #{order?.number}</h2>
              {order && (
                <div className="flex items-center gap-2 mt-0.5">
                  {changingStatus ? (
                    <select
                      defaultValue={order.status}
                      onChange={(e) => {
                        statusMutation.mutate(e.target.value)
                        setChangingStatus(false)
                      }}
                      className="rounded border border-input px-2 py-0.5 text-xs outline-none focus:border-primary"
                      autoFocus
                      onBlur={() => setChangingStatus(false)}
                    >
                      {OS_STATUS_OPTIONS.map((s) => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  ) : (
                    <button
                      onClick={() => setChangingStatus(true)}
                      className={cn(
                        'flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                        STATUS_COLORS[order.status],
                      )}
                    >
                      {STATUS_LABELS[order.status]}
                      <ChevronDown className="h-3 w-3" />
                    </button>
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              {order && order.status !== 'cancelled' && order.status !== 'completed' && (
                <button
                  onClick={() => {
                    if (window.confirm('Cancelar esta ordem de serviço? Esta ação não pode ser desfeita.')) {
                      statusMutation.mutate('cancelled')
                    }
                  }}
                  disabled={statusMutation.isPending}
                  className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
                  title="Cancelar OS"
                >
                  <Ban className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Cancelar OS</span>
                </button>
              )}
              {order && (
                <button
                  onClick={handlePrint}
                  className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-muted"
                  title="Imprimir OS"
                >
                  <Printer className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Imprimir</span>
                </button>
              )}
              <button onClick={onClose}><X className="h-5 w-5 text-muted-foreground" /></button>
            </div>
          </div>

          {isLoading ? (
            <div className="flex h-40 items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : order && (
            <div id="os-print-area" className="space-y-6 p-6">
              {/* Info principal */}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-foreground">{order.client?.name}</p>
                    {order.client?.registrationNumber && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-mono font-bold text-primary">
                        {formatRegNum(order.client.registrationNumber)}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {order.vehicle?.brand} {order.vehicle?.model} {order.vehicle?.plate && `• ${order.vehicle.plate}`}
                  </p>
                  <p className="text-xs text-muted-foreground">{formatDate(order.createdAt)}</p>
                  {/* WhatsApp */}
                  {(order.client?.whatsapp || order.client?.phone) && (
                    <a
                      href={`https://wa.me/55${(order.client.whatsapp || order.client.phone || '').replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-green-600 hover:underline"
                    >
                      <MessageCircle className="h-3 w-3" />
                      WhatsApp
                    </a>
                  )}
                </div>

                {/* Valor + pagamentos */}
                <div className="text-right min-w-0">
                  {editingOS ? (
                    <div className="space-y-2 text-left">
                      <input
                        type="number"
                        step="0.01"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="w-32 rounded border border-input px-2 py-1 text-sm outline-none focus:border-primary"
                      />
                      <textarea
                        value={editNotes}
                        onChange={(e) => setEditNotes(e.target.value)}
                        rows={2}
                        placeholder="Observações"
                        className="w-full rounded border border-input px-2 py-1 text-xs outline-none focus:border-primary"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => setEditingOS(false)}
                          className="rounded border px-2 py-1 text-xs hover:bg-muted"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={saveOS}
                          disabled={savingOS}
                          className="flex items-center gap-1 rounded bg-primary px-2 py-1 text-xs font-semibold text-white hover:bg-primary/90 disabled:opacity-60"
                        >
                          <Save className="h-3 w-3" />
                          {savingOS ? 'Salvando...' : 'Salvar'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-end gap-1">
                        <p className="text-lg font-bold text-foreground">{formatCurrency(order.finalValue)}</p>
                        <button onClick={startEditOS} className="text-muted-foreground hover:text-foreground">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      {order.remaining > 0.01 ? (
                        <div className="mt-1 space-y-1">
                          <p className="text-xs text-red-600">Em aberto: {formatCurrency(order.remaining)}</p>
                          <button
                            onClick={() => { onPay(order); onClose() }}
                            className="rounded-lg bg-green-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-600"
                          >
                            Registrar pagamento
                          </button>
                        </div>
                      ) : (
                        <p className="text-xs text-green-600 font-medium">✓ Pago</p>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Histórico de pagamentos */}
              {order.payments?.length > 0 && (
                <div className="rounded-xl border p-3">
                  <p className="mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Pagamentos realizados</p>
                  <div className="space-y-1.5">
                    {order.payments.map((p: any) => (
                      <div key={p.id} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                            {PAYMENT_METHOD_LABELS[p.method] ?? p.method}
                            {p.installments && p.installments > 1 ? ` ${p.installments}x` : ''}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(p.paidAt).toLocaleDateString('pt-BR')}
                          </span>
                        </div>
                        <span className="font-semibold text-foreground">{formatCurrency(p.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Histórico de status */}
              {(statusHistory as any[]).length > 0 && (
                <div className="rounded-xl border p-3">
                  <p className="mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Histórico de status</p>
                  <div className="space-y-1.5">
                    {(statusHistory as any[]).map((h: any) => (
                      <div key={h.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="text-foreground font-medium">
                          {h.fromStatus ? `${STATUS_LABELS[h.fromStatus] ?? h.fromStatus} →` : ''}
                        </span>
                        <span className={cn('rounded-full px-2 py-0.5 font-medium', STATUS_COLORS[h.toStatus])}>
                          {STATUS_LABELS[h.toStatus] ?? h.toStatus}
                        </span>
                        {h.userName && <span>por {h.userName}</span>}
                        <span className="ml-auto">{new Date(h.createdAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Notas */}
              {order.notes && !editingOS && (
                <div className="rounded-xl border bg-muted/40 p-3">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Observações</p>
                  <p className="text-sm text-foreground">{order.notes}</p>
                </div>
              )}

              {/* Checklist */}
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-foreground">Check-list de entrada</h3>
                    <p className="text-xs text-muted-foreground">OK = Conforme &nbsp; DF = Com defeito &nbsp; NA = Não se aplica</p>
                  </div>
                  {checklistEdit ? (
                    <div className="flex gap-2">
                      <button onClick={() => setChecklistEdit(null)} className="rounded-lg border px-3 py-1 text-xs hover:bg-muted">Cancelar</button>
                      <button
                        onClick={saveChecklist}
                        disabled={savingChecklist}
                        className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1 text-xs font-semibold text-white hover:bg-primary/90 disabled:opacity-60"
                      >
                        <Save className="h-3 w-3" />
                        {savingChecklist ? 'Salvando...' : 'Salvar'}
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => setChecklistEdit({ ...checklist })} className="rounded-lg border px-3 py-1 text-xs hover:bg-muted">
                      {Object.keys(checklist).length > 0 ? 'Editar' : 'Preencher'}
                    </button>
                  )}
                </div>
                <div className="space-y-3">
                  {CHECKLIST_GROUPS.map((group) => (
                    <div key={group.label} className="rounded-xl border overflow-hidden">
                      <div className="bg-muted/60 px-4 py-2 text-xs font-semibold text-foreground uppercase tracking-wide border-b">
                        {group.label}
                      </div>
                      <div className="divide-y">
                        {group.items.map(({ key, label }) => {
                          const val = (checklistEdit ? checklistEdit[key] : checklist[key]) ?? ''
                          return (
                            <div key={key} className="flex items-center justify-between px-4 py-2">
                              <p className="text-xs text-foreground">{label}</p>
                              {checklistEdit ? (
                                <div className="flex gap-1">
                                  {(['ok', 'df', 'na'] as const).map((opt) => (
                                    <button
                                      key={opt}
                                      onClick={() => setChecklistEdit((prev) => ({ ...prev!, [key]: prev![key] === opt ? '' : opt }))}
                                      className={cn(
                                        'w-8 rounded border py-0.5 text-xs font-bold transition-colors',
                                        val === opt && opt === 'ok' && 'border-green-500 bg-green-100 text-green-700',
                                        val === opt && opt === 'df' && 'border-orange-400 bg-orange-100 text-orange-700',
                                        val === opt && opt === 'na' && 'border-slate-400 bg-slate-100 text-slate-600',
                                        val !== opt && 'border-input text-muted-foreground hover:bg-muted',
                                      )}
                                    >
                                      {opt.toUpperCase()}
                                    </button>
                                  ))}
                                </div>
                              ) : (
                                <span className={cn(
                                  'rounded px-2 py-0.5 text-xs font-bold',
                                  val === 'ok' && 'bg-green-100 text-green-700',
                                  val === 'df' && 'bg-orange-100 text-orange-700',
                                  val === 'na' && 'bg-slate-100 text-slate-600',
                                  !val && 'text-muted-foreground',
                                )}>
                                  {val ? val.toUpperCase() : '—'}
                                </span>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Mapa de Danos */}
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-foreground">Mapa de danos</h3>
                    <p className="text-xs text-muted-foreground">Clique nas bolinhas para marcar avarias</p>
                  </div>
                  {damageEditing ? (
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setDamageEditing(false); setActiveSpots(order.damageMap ? (() => { try { const p = JSON.parse(order.damageMap); return Array.isArray(p) && (p.length === 0 || typeof p[0] === 'string') ? p : [] } catch { return [] } })() : []) }}
                        className="rounded-lg border px-3 py-1 text-xs hover:bg-muted"
                      >Cancelar</button>
                      <button onClick={() => setActiveSpots([])} className="rounded-lg border border-red-200 px-3 py-1 text-xs text-red-600 hover:bg-red-50">Limpar</button>
                      <button onClick={saveDamage} disabled={savingDamage} className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1 text-xs font-semibold text-white hover:bg-primary/90 disabled:opacity-60">
                        <Save className="h-3 w-3" />
                        {savingDamage ? 'Salvando...' : 'Salvar'}
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => setDamageEditing(true)} className="rounded-lg border px-3 py-1 text-xs hover:bg-muted">
                      {activeSpots.length > 0 ? 'Editar' : 'Marcar danos'}
                    </button>
                  )}
                </div>
                <div className="rounded-xl border p-4">
                  <VehicleDamageMap
                    activeSpots={activeSpots}
                    onChange={damageEditing ? setActiveSpots : undefined}
                    readonly={!damageEditing}
                  />
                  {activeSpots.length > 0 && (
                    <div className="mt-3 border-t pt-3">
                      <p className="text-xs font-medium text-muted-foreground mb-2">Avarias marcadas ({activeSpots.length}):</p>
                      <div className="flex flex-wrap gap-1">
                        {activeSpots.map((id) => {
                          const spot = [...TOP_SPOTS, ...SIDE_SPOTS].find((s) => s.id === id)
                          return spot ? (
                            <span key={id} className="rounded-full bg-muted px-2 py-0.5 text-xs text-foreground">{spot.label}</span>
                          ) : null
                        })}
                      </div>
                    </div>
                  )}
                  {order.kmEntry && (
                    <div className="mt-3 rounded-lg bg-muted/40 p-2">
                      <p className="text-xs text-muted-foreground">KM na entrada</p>
                      <p className="font-semibold">{order.kmEntry.toLocaleString('pt-BR')} km</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Fotos */}
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-semibold text-foreground">Fotos</h3>
                  <div className="flex items-center gap-2">
                    <select
                      value={photoType}
                      onChange={(e) => setPhotoType(e.target.value as 'before' | 'after')}
                      className="rounded-lg border border-input px-2 py-1 text-xs outline-none focus:border-primary"
                    >
                      <option value="before">Antes</option>
                      <option value="after">Depois</option>
                    </select>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary/90 disabled:opacity-60"
                    >
                      <Camera className="h-3.5 w-3.5" />
                      {uploading ? 'Enviando...' : 'Adicionar foto'}
                    </button>
                    <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={handleUpload} />
                  </div>
                </div>

                {beforePhotos.length > 0 && (
                  <div className="mb-4">
                    <p className="mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Antes ({beforePhotos.length})</p>
                    <div className="grid grid-cols-3 gap-2">
                      {beforePhotos.map((photo: any) => (
                        <div key={photo.id} className="group relative overflow-hidden rounded-lg border bg-muted aspect-square cursor-pointer">
                          <img
                            src={photo.url}
                            alt="antes"
                            className="h-full w-full object-cover"
                            onClick={() => setLightboxUrl(photo.url)}
                          />
                          <button
                            onClick={() => deletePhotoMutation.mutate(photo.id)}
                            className="absolute right-1 top-1 hidden rounded-lg bg-red-500 p-1 text-white group-hover:flex"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {afterPhotos.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Depois ({afterPhotos.length})</p>
                    <div className="grid grid-cols-3 gap-2">
                      {afterPhotos.map((photo: any) => (
                        <div key={photo.id} className="group relative overflow-hidden rounded-lg border bg-muted aspect-square cursor-pointer">
                          <img
                            src={photo.url}
                            alt="depois"
                            className="h-full w-full object-cover"
                            onClick={() => setLightboxUrl(photo.url)}
                          />
                          <button
                            onClick={() => deletePhotoMutation.mutate(photo.id)}
                            className="absolute right-1 top-1 hidden rounded-lg bg-red-500 p-1 text-white group-hover:flex"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {beforePhotos.length === 0 && afterPhotos.length === 0 && (
                  <div className="rounded-xl border-2 border-dashed py-10 text-center text-sm text-muted-foreground">
                    <Camera className="mx-auto mb-2 h-8 w-8 opacity-30" />
                    <p>Nenhuma foto ainda</p>
                    <p className="text-xs">Clique em "Adicionar foto" para registrar o antes/depois</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// ─── PÁGINA PRINCIPAL ─────────────────────────────────────────────────────────

export default function ServiceOrdersPage() {
  const [showNewModal, setShowNewModal] = useState(false)
  const [payingOrder, setPayingOrder] = useState<any>(null)
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  const [viewingOrderId, setViewingOrderId] = useState<string | null>(null)
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['service-orders', statusFilter, search],
    queryFn: () =>
      api.get('/service-orders', {
        params: { status: statusFilter || undefined, search: search || undefined, limit: 50 },
      }).then((r) => r.data),
  })

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/service-orders/${id}/status`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['service-orders'] }),
  })

  const nextStatus: Record<string, string> = { open: 'in_progress', in_progress: 'completed' }
  const nextLabel: Record<string, string> = { open: 'Iniciar', in_progress: 'Concluir' }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Ordens de Serviço</h1>
          <p className="text-sm text-muted-foreground">{data?.total ?? 0} no total</p>
        </div>
        <button
          onClick={() => setShowNewModal(true)}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> Nova OS
        </button>
      </div>

      {/* Busca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por número ou nome do cliente..."
          className="w-full rounded-lg border border-input bg-white py-2.5 pl-9 pr-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
      </div>

      {/* Filtros de status */}
      <div className="flex flex-wrap gap-2">
        {['', 'open', 'in_progress', 'completed', 'cancelled'].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              statusFilter === s ? 'border-primary bg-primary text-white' : 'hover:bg-muted',
            )}
          >
            {s === '' ? 'Todos' : STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex h-40 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : (
        <div className="space-y-3">
          {data?.orders?.map((order: any) => {
            const totalPaid = order.payments?.reduce((a: number, p: any) => a + p.amount, 0) ?? 0
            const remaining = order.finalValue - totalPaid
            const waNumber = (order.client?.whatsapp || order.client?.phone || '').replace(/\D/g, '')
            const firstName = order.client?.name?.split(' ')[0] ?? ''
            const regNum = order.client?.registrationNumber
            return (
              <div
                key={order.id}
                className={cn(
                  'rounded-xl border bg-card p-4 shadow-sm',
                  order.status === 'in_progress' && 'border-yellow-300 bg-yellow-50',
                )}
              >
                {/* Layout: ícone + info à esquerda, valor + botões à direita */}
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <ClipboardList className="h-5 w-5 text-primary" />
                  </div>

                  {/* Info central — ocupa o espaço disponível */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="font-semibold text-foreground">OS #{order.number}</p>
                      {regNum && (
                        <span className="font-mono text-xs text-muted-foreground">{formatRegNum(regNum)}</span>
                      )}
                      <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', STATUS_COLORS[order.status])}>
                        {STATUS_LABELS[order.status]}
                      </span>
                    </div>
                    {/* Nome — truncado no mobile, completo no desktop */}
                    <p className="truncate text-sm font-medium text-muted-foreground sm:whitespace-normal">
                      <span className="sm:hidden">{firstName}</span>
                      <span className="hidden sm:inline">{order.client?.name}</span>
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {order.vehicle?.brand} {order.vehicle?.model}{' '}
                      {order.vehicle?.plate && `• ${order.vehicle.plate}`}
                    </p>
                    <p className="text-xs text-muted-foreground">{formatDate(order.createdAt)}</p>
                  </div>

                  {/* Valor + botões — à direita */}
                  <div className="shrink-0 text-right">
                    <p className="font-bold text-foreground">{formatCurrency(order.finalValue)}</p>
                    {remaining > 0.01 && (
                      <p className="text-xs text-red-600">Em aberto: {formatCurrency(remaining)}</p>
                    )}
                    {remaining <= 0.01 && totalPaid > 0 && (
                      <p className="text-xs text-green-600">Pago</p>
                    )}

                    {/* Botões — wrap no mobile */}
                    <div className="mt-2 flex flex-wrap justify-end gap-1.5">
                      {waNumber && (
                        <a
                          href={`https://wa.me/55${waNumber}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 rounded-lg bg-green-100 px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-200"
                          title="WhatsApp do cliente"
                        >
                          <MessageCircle className="h-3 w-3" />
                        </a>
                      )}
                      <button
                        onClick={() => setViewingOrderId(order.id)}
                        className="flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-medium hover:bg-muted"
                      >
                        <Eye className="h-3 w-3" /> Detalhes
                      </button>
                      {nextStatus[order.status] && (
                        <button
                          onClick={() => statusMutation.mutate({ id: order.id, status: nextStatus[order.status] })}
                          className="rounded-lg bg-primary px-2 py-1 text-xs font-semibold text-white hover:bg-primary/90"
                        >
                          {nextLabel[order.status]}
                        </button>
                      )}
                      {remaining > 0.01 && order.status !== 'cancelled' && (
                        <button
                          onClick={() => setPayingOrder(order)}
                          className="flex items-center gap-1 rounded-lg bg-green-100 px-2 py-1 text-xs font-semibold text-green-700 hover:bg-green-200"
                        >
                          <DollarSign className="h-3 w-3" /> Pagar
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
          {data?.orders?.length === 0 && (
            <div className="py-16 text-center text-muted-foreground">
              <ClipboardList className="mx-auto mb-3 h-10 w-10 opacity-30" />
              <p>Nenhuma ordem de serviço</p>
            </div>
          )}
        </div>
      )}

      {showNewModal && <NewOrderModal onClose={() => setShowNewModal(false)} />}
      {payingOrder && <PaymentModal order={payingOrder} onClose={() => setPayingOrder(null)} />}
      {viewingOrderId && (
        <OrderDetailModal
          orderId={viewingOrderId}
          onClose={() => setViewingOrderId(null)}
          onPay={(order) => setPayingOrder(order)}
        />
      )}
    </div>
  )
}
