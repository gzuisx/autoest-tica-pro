import { useState, useRef, useCallback, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
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
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['service-orders'] }); onClose() },
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

const CHECKLIST_FIELDS = [
  { key: 'scratches', label: 'Arranhões / riscos' },
  { key: 'stains', label: 'Manchas / sujeiras' },
  { key: 'fuelLevel', label: 'Nível de combustível' },
  { key: 'personalItems', label: 'Objetos pessoais' },
  { key: 'generalCondition', label: 'Estado geral' },
  { key: 'observations', label: 'Observações adicionais' },
]

// ─── MAPA DE DANOS ────────────────────────────────────────────────────────────

type DamagePoint = { id: string; x: number; y: number }

function VehicleDamageMap({
  points,
  onChange,
  readonly = false,
}: {
  points: DamagePoint[]
  onChange?: (pts: DamagePoint[]) => void
  readonly?: boolean
}) {
  const svgRef = useRef<SVGSVGElement>(null)

  const handleSvgClick = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (readonly || !onChange) return
      const svg = svgRef.current
      if (!svg) return
      const pt = svg.createSVGPoint()
      pt.x = e.clientX
      pt.y = e.clientY
      const svgPt = pt.matrixTransform(svg.getScreenCTM()!.inverse())
      onChange([...points, { id: Date.now().toString(), x: Math.round(svgPt.x), y: Math.round(svgPt.y) }])
    },
    [points, onChange, readonly],
  )

  const removePoint = useCallback(
    (id: string, e: React.MouseEvent) => {
      e.stopPropagation()
      if (readonly || !onChange) return
      onChange(points.filter((p) => p.id !== id))
    },
    [points, onChange, readonly],
  )

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 160 320"
      onClick={handleSvgClick}
      style={{ cursor: readonly ? 'default' : 'crosshair', width: '100%', maxWidth: '160px', display: 'block' }}
    >
      {/* Frente label */}
      <text x="80" y="12" textAnchor="middle" fontSize="8" fill="#666" fontFamily="Arial">FRENTE</text>
      {/* Bumper dianteiro */}
      <rect x="35" y="16" width="90" height="7" rx="3" fill="#ccc" stroke="#555" strokeWidth="1"/>
      {/* Capô */}
      <rect x="28" y="23" width="104" height="60" rx="14" fill="#f0f0f0" stroke="#555" strokeWidth="1.5"/>
      {/* Para-brisas dianteiro */}
      <rect x="38" y="83" width="84" height="38" rx="3" fill="#b8d4f0" stroke="#555" strokeWidth="1"/>
      {/* Cabine / teto */}
      <rect x="28" y="121" width="104" height="78" rx="4" fill="#e0e0e0" stroke="#555" strokeWidth="1.5"/>
      {/* Linha divisória portas */}
      <line x1="28" y1="160" x2="132" y2="160" stroke="#aaa" strokeWidth="0.8"/>
      {/* Maçanetas */}
      <rect x="30" y="148" width="7" height="3" rx="1" fill="#999"/>
      <rect x="123" y="148" width="7" height="3" rx="1" fill="#999"/>
      <rect x="30" y="168" width="7" height="3" rx="1" fill="#999"/>
      <rect x="123" y="168" width="7" height="3" rx="1" fill="#999"/>
      {/* Para-brisas traseiro */}
      <rect x="38" y="199" width="84" height="34" rx="3" fill="#b8d4f0" stroke="#555" strokeWidth="1"/>
      {/* Tampa do porta-malas */}
      <rect x="28" y="233" width="104" height="50" rx="14" fill="#f0f0f0" stroke="#555" strokeWidth="1.5"/>
      {/* Bumper traseiro */}
      <rect x="35" y="283" width="90" height="7" rx="3" fill="#ccc" stroke="#555" strokeWidth="1"/>
      {/* Traseira label */}
      <text x="80" y="300" textAnchor="middle" fontSize="8" fill="#666" fontFamily="Arial">TRASEIRA</text>
      {/* Rodas dianteiras */}
      <rect x="8" y="38" width="18" height="40" rx="5" fill="#333"/>
      <rect x="134" y="38" width="18" height="40" rx="5" fill="#333"/>
      {/* Rodas traseiras */}
      <rect x="8" y="242" width="18" height="40" rx="5" fill="#333"/>
      <rect x="134" y="242" width="18" height="40" rx="5" fill="#333"/>

      {/* Pontos de dano */}
      {points.map((p, i) => (
        <g key={p.id} onClick={(e) => removePoint(p.id, e)} style={{ cursor: readonly ? 'default' : 'pointer' }}>
          <circle cx={p.x} cy={p.y} r="7" fill="#ef4444" fillOpacity="0.85" stroke="white" strokeWidth="1.5"/>
          <text x={p.x} y={p.y + 3.5} textAnchor="middle" fontSize="7" fill="white" fontWeight="bold" fontFamily="Arial">
            {i + 1}
          </text>
        </g>
      ))}
    </svg>
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
  const [damagePoints, setDamagePoints] = useState<DamagePoint[]>([])
  const [savingDamage, setSavingDamage] = useState(false)
  const [damageEditing, setDamageEditing] = useState(false)

  const { data: order, isLoading } = useQuery({
    queryKey: ['service-order-detail', orderId],
    queryFn: () => api.get(`/service-orders/${orderId}`).then((r) => r.data),
  })

  useEffect(() => {
    if (order?.damageMap) {
      try { setDamagePoints(JSON.parse(order.damageMap)) } catch { setDamagePoints([]) }
    } else {
      setDamagePoints([])
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
      await api.patch(`/service-orders/${orderId}`, { damageMap: JSON.stringify(damagePoints) })
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
    const pts: DamagePoint[] = damagePoints

    const carSvg = `<svg viewBox="0 0 160 320" width="130" height="260" style="display:block">
      <text x="80" y="12" text-anchor="middle" font-size="8" fill="#666" font-family="Arial">FRENTE</text>
      <rect x="35" y="16" width="90" height="7" rx="3" fill="#ccc" stroke="#555" stroke-width="1"/>
      <rect x="28" y="23" width="104" height="60" rx="14" fill="#f0f0f0" stroke="#555" stroke-width="1.5"/>
      <rect x="38" y="83" width="84" height="38" rx="3" fill="#b8d4f0" stroke="#555" stroke-width="1"/>
      <rect x="28" y="121" width="104" height="78" rx="4" fill="#e0e0e0" stroke="#555" stroke-width="1.5"/>
      <line x1="28" y1="160" x2="132" y2="160" stroke="#aaa" stroke-width="0.8"/>
      <rect x="30" y="148" width="7" height="3" rx="1" fill="#999"/>
      <rect x="123" y="148" width="7" height="3" rx="1" fill="#999"/>
      <rect x="30" y="168" width="7" height="3" rx="1" fill="#999"/>
      <rect x="123" y="168" width="7" height="3" rx="1" fill="#999"/>
      <rect x="38" y="199" width="84" height="34" rx="3" fill="#b8d4f0" stroke="#555" stroke-width="1"/>
      <rect x="28" y="233" width="104" height="50" rx="14" fill="#f0f0f0" stroke="#555" stroke-width="1.5"/>
      <rect x="35" y="283" width="90" height="7" rx="3" fill="#ccc" stroke="#555" stroke-width="1"/>
      <text x="80" y="300" text-anchor="middle" font-size="8" fill="#666" font-family="Arial">TRASEIRA</text>
      <rect x="8" y="38" width="18" height="40" rx="5" fill="#333"/>
      <rect x="134" y="38" width="18" height="40" rx="5" fill="#333"/>
      <rect x="8" y="242" width="18" height="40" rx="5" fill="#333"/>
      <rect x="134" y="242" width="18" height="40" rx="5" fill="#333"/>
      ${pts.map((p, i) => `
        <circle cx="${p.x}" cy="${p.y}" r="7" fill="#ef4444" fill-opacity="0.85" stroke="white" stroke-width="1.5"/>
        <text x="${p.x}" y="${p.y + 3.5}" text-anchor="middle" font-size="7" fill="white" font-weight="bold" font-family="Arial">${i + 1}</text>
      `).join('')}
    </svg>`

    const services = o.quote?.items ?? []
    const servicesRows = services.length > 0
      ? services.map((item: any) => `
        <tr>
          <td>${item.service?.name ?? item.description ?? '—'}</td>
          <td style="text-align:center">${item.quantity ?? 1}</td>
          <td style="text-align:right">R$ ${Number(item.unitPrice ?? 0).toFixed(2)}</td>
          <td style="text-align:right">R$ ${Number(item.totalPrice ?? 0).toFixed(2)}</td>
        </tr>`).join('')
      : `<tr><td colspan="4" style="text-align:center;color:#888">Serviços não detalhados</td></tr>`

    const checklist = o.checklist ? JSON.parse(o.checklist) : {}
    const checklistHtml = CHECKLIST_FIELDS
      .filter((f) => checklist[f.key])
      .map((f) => `<tr><td style="color:#555">${f.label}</td><td>${checklist[f.key]}</td></tr>`)
      .join('')

    const damageLegende = pts.length > 0
      ? `<p style="font-size:11px;margin-top:6px;color:#333"><b>Danos registrados:</b> ${pts.map((_, i) => i + 1).join(', ')}</p>`
      : ''

    const win = window.open('', '_blank', 'width=900,height=700')
    if (!win) return
    win.document.write(`<!DOCTYPE html>
<html><head>
<meta charset="UTF-8"/>
<title>OS #${o.number} — ${o.client?.name}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 12px; color: #111; padding: 20px; }
  .os-wrap { max-width: 800px; margin: 0 auto; border: 2px solid #222; padding: 0; }
  /* Cabeçalho */
  .header { display: flex; justify-content: space-between; align-items: flex-start; padding: 12px 16px; border-bottom: 2px solid #222; background: #f8f8f8; }
  .header-left { flex: 1; }
  .store-name { font-size: 18px; font-weight: bold; margin-bottom: 2px; }
  .store-info { font-size: 11px; color: #444; line-height: 1.5; }
  .header-right { text-align: right; }
  .os-number { font-size: 22px; font-weight: bold; }
  .os-date { font-size: 11px; color: #555; margin-top: 4px; }
  /* Seções */
  .section { display: flex; border-bottom: 1px solid #ccc; }
  .section-box { flex: 1; padding: 10px 14px; }
  .section-box + .section-box { border-left: 1px solid #ccc; }
  .section-title { font-size: 9px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.08em; color: #777; margin-bottom: 6px; border-bottom: 1px solid #eee; padding-bottom: 3px; }
  .field { margin-bottom: 4px; }
  .field-label { font-size: 10px; color: #666; }
  .field-value { font-size: 12px; font-weight: bold; }
  /* Tabela de serviços */
  .services-section { padding: 10px 14px; border-bottom: 1px solid #ccc; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #f0f0f0; border: 1px solid #ccc; padding: 5px 8px; font-size: 11px; text-align: left; }
  td { border: 1px solid #ddd; padding: 5px 8px; font-size: 11px; }
  .total-row td { background: #f8f8f8; font-weight: bold; }
  /* Condição do veículo */
  .condition-section { display: flex; border-bottom: 1px solid #ccc; }
  .condition-left { flex: 1; padding: 10px 14px; }
  .condition-right { width: 160px; padding: 10px 14px; border-left: 1px solid #ccc; display: flex; flex-direction: column; align-items: center; }
  /* Rodapé assinatura */
  .footer-section { display: flex; gap: 0; border-top: 1px solid #ccc; }
  .sig-box { flex: 1; padding: 14px 16px; }
  .sig-box + .sig-box { border-left: 1px solid #ccc; }
  .sig-line { border-top: 1px solid #333; margin-top: 40px; padding-top: 4px; font-size: 11px; color: #555; }
  .disclaimer { font-size: 9.5px; color: #555; padding: 8px 16px; border-top: 1px solid #ccc; line-height: 1.4; text-align: center; background: #f8f8f8; }
  @media print {
    body { padding: 0; }
    .os-wrap { border: 2px solid #000; }
    @page { margin: 10mm; }
  }
</style>
</head><body>
<div class="os-wrap">

  <!-- CABEÇALHO -->
  <div class="header">
    <div class="header-left">
      <div class="store-name">${o.tenant?.name ?? 'Estética Automotiva'}</div>
      <div class="store-info">
        ${o.tenant?.address ? o.tenant.address + '<br>' : ''}
        ${o.tenant?.phone ? 'Tel: ' + o.tenant.phone : ''}
        ${o.tenant?.email ? ' | ' + o.tenant.email : ''}
      </div>
    </div>
    <div class="header-right">
      <div class="os-number">OS #${String(o.number).padStart(5, '0')}</div>
      <div class="os-date">Data: ${new Date(o.createdAt).toLocaleDateString('pt-BR')}</div>
      <div class="os-date">Status: ${o.status === 'open' ? 'Aberta' : o.status === 'in_progress' ? 'Em andamento' : o.status === 'completed' ? 'Concluída' : 'Cancelada'}</div>
    </div>
  </div>

  <!-- CLIENTE | VEÍCULO -->
  <div class="section">
    <div class="section-box">
      <div class="section-title">Dados do Cliente</div>
      <div class="field"><span class="field-label">Nome: </span><span class="field-value">${o.client?.name ?? '—'}</span></div>
      ${o.client?.cpf ? `<div class="field"><span class="field-label">CPF: </span><span class="field-value">${o.client.cpf}</span></div>` : ''}
      ${o.client?.rg ? `<div class="field"><span class="field-label">RG: </span><span class="field-value">${o.client.rg}</span></div>` : ''}
      <div class="field"><span class="field-label">Telefone: </span><span class="field-value">${o.client?.whatsapp || o.client?.phone || '—'}</span></div>
      ${o.client?.street ? `<div class="field"><span class="field-label">Endereço: </span><span class="field-value">${o.client.street}${o.client.addressNumber ? ', ' + o.client.addressNumber : ''}${o.client.neighborhood ? ' - ' + o.client.neighborhood : ''}${o.client.city ? ', ' + o.client.city : ''}${o.client.state ? '/' + o.client.state : ''}</span></div>` : ''}
    </div>
    <div class="section-box">
      <div class="section-title">Dados do Veículo</div>
      <div class="field"><span class="field-label">Veículo: </span><span class="field-value">${o.vehicle?.brand ?? ''} ${o.vehicle?.model ?? ''} ${o.vehicle?.year ? '(' + o.vehicle.year + ')' : ''}</span></div>
      ${o.vehicle?.color ? `<div class="field"><span class="field-label">Cor: </span><span class="field-value">${o.vehicle.color}</span></div>` : ''}
      ${o.vehicle?.plate ? `<div class="field"><span class="field-label">Placa: </span><span class="field-value" style="font-size:14px;letter-spacing:2px">${o.vehicle.plate}</span></div>` : ''}
      ${o.vehicle?.chassis ? `<div class="field"><span class="field-label">Chassi: </span><span class="field-value" style="font-size:11px;letter-spacing:1px">${o.vehicle.chassis}</span></div>` : ''}
      ${o.kmEntry ? `<div class="field"><span class="field-label">KM entrada: </span><span class="field-value">${o.kmEntry.toLocaleString('pt-BR')} km</span></div>` : ''}
      <div class="field"><span class="field-label">Técnico: </span><span class="field-value">${o.user?.name ?? '—'}</span></div>
    </div>
  </div>

  <!-- SERVIÇOS -->
  <div class="services-section">
    <div class="section-title" style="margin-bottom:8px">Serviços Realizados</div>
    <table>
      <thead>
        <tr>
          <th>Descrição</th>
          <th style="width:60px;text-align:center">Qtd</th>
          <th style="width:100px;text-align:right">Unit.</th>
          <th style="width:100px;text-align:right">Total</th>
        </tr>
      </thead>
      <tbody>
        ${servicesRows}
      </tbody>
      <tfoot>
        <tr class="total-row">
          <td colspan="3" style="text-align:right">TOTAL</td>
          <td style="text-align:right">R$ ${Number(o.finalValue).toFixed(2)}</td>
        </tr>
      </tfoot>
    </table>
  </div>

  <!-- CONDIÇÃO DO VEÍCULO + MAPA DE DANOS -->
  <div class="condition-section">
    <div class="condition-left">
      <div class="section-title">Condição do Veículo na Entrada</div>
      ${o.notes ? `<div class="field" style="margin-bottom:8px"><span class="field-label">Observações: </span>${o.notes}</div>` : ''}
      ${checklistHtml ? `<table style="margin-top:6px"><tbody>${checklistHtml}</tbody></table>` : '<p style="color:#888;font-size:11px">Nenhuma observação registrada.</p>'}
    </div>
    <div class="condition-right">
      <div class="section-title" style="text-align:center">Mapa de Danos</div>
      ${carSvg}
      ${damageLegende}
    </div>
  </div>

  <!-- ASSINATURA -->
  <div class="footer-section">
    <div class="sig-box">
      <div style="font-size:11px;color:#555;margin-bottom:2px">Técnico Responsável</div>
      <div class="sig-line">${o.user?.name ?? ''}</div>
    </div>
    <div class="sig-box">
      <div style="font-size:11px;color:#555;margin-bottom:2px">Assinatura do Cliente</div>
      <div style="font-size:10px;color:#777;margin-bottom:2px">
        ${o.client?.cpf ? 'CPF: ' + o.client.cpf : o.client?.rg ? 'RG: ' + o.client.rg : ''}
      </div>
      <div class="sig-line"></div>
    </div>
  </div>

  <!-- DECLARAÇÃO -->
  <div class="disclaimer">
    Declaro que li e concordo com os termos do serviço. O veículo será entregue nas condições descritas acima.<br>
    Data: ____/____/________
  </div>

</div>
</body></html>`)
    win.document.close()
    win.print()
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
                  <h3 className="font-semibold text-foreground">Checklist de entrada</h3>
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
                <div className="rounded-xl border divide-y">
                  {CHECKLIST_FIELDS.map(({ key, label }) => (
                    <div key={key} className="flex items-start gap-3 px-4 py-2.5">
                      <p className="w-36 shrink-0 text-xs font-medium text-muted-foreground pt-1">{label}</p>
                      {checklistEdit ? (
                        <input
                          value={checklistEdit[key] ?? ''}
                          onChange={(e) => setChecklistEdit((prev) => ({ ...prev!, [key]: e.target.value }))}
                          className="flex-1 rounded border border-input px-2 py-1 text-sm outline-none focus:border-primary"
                          placeholder="—"
                        />
                      ) : (
                        <p className="text-sm text-foreground">{checklist[key] || <span className="text-muted-foreground">—</span>}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Mapa de Danos */}
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-semibold text-foreground">Mapa de danos</h3>
                  {damageEditing ? (
                    <div className="flex gap-2">
                      <button onClick={() => { setDamageEditing(false); try { setDamagePoints(order.damageMap ? JSON.parse(order.damageMap) : []) } catch { setDamagePoints([]) } }} className="rounded-lg border px-3 py-1 text-xs hover:bg-muted">Cancelar</button>
                      <button onClick={() => setDamagePoints([])} className="rounded-lg border border-red-200 px-3 py-1 text-xs text-red-600 hover:bg-red-50">Limpar</button>
                      <button onClick={saveDamage} disabled={savingDamage} className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1 text-xs font-semibold text-white hover:bg-primary/90 disabled:opacity-60">
                        <Save className="h-3 w-3" />
                        {savingDamage ? 'Salvando...' : 'Salvar'}
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => setDamageEditing(true)} className="rounded-lg border px-3 py-1 text-xs hover:bg-muted">
                      {damagePoints.length > 0 ? 'Editar' : 'Marcar danos'}
                    </button>
                  )}
                </div>
                <div className="flex gap-4 rounded-xl border p-4">
                  <div className="flex-shrink-0">
                    <VehicleDamageMap
                      points={damagePoints}
                      onChange={damageEditing ? setDamagePoints : undefined}
                      readonly={!damageEditing}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    {damageEditing && (
                      <p className="mb-3 text-xs text-muted-foreground bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                        Clique no veículo para marcar um ponto de dano. Clique em um ponto existente para removê-lo.
                      </p>
                    )}
                    {damagePoints.length > 0 ? (
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground mb-2">Pontos marcados:</p>
                        {damagePoints.map((p, i) => (
                          <div key={p.id} className="flex items-center gap-2 text-xs">
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white font-bold text-[10px]">{i + 1}</span>
                            <span className="text-muted-foreground">x:{Math.round(p.x)}, y:{Math.round(p.y)}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Nenhum dano marcado.</p>
                    )}
                    {/* KM entrada */}
                    {order.kmEntry && (
                      <div className="mt-4 rounded-lg bg-muted/40 p-2">
                        <p className="text-xs text-muted-foreground">KM na entrada</p>
                        <p className="font-semibold">{order.kmEntry.toLocaleString('pt-BR')} km</p>
                      </div>
                    )}
                  </div>
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
