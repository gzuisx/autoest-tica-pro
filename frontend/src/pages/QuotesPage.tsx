import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, FileText, X, MessageCircle, Trash2, Pencil, ClipboardList } from 'lucide-react'
import { useForm, useFieldArray, Controller } from 'react-hook-form'
import api from '../services/api'
import { formatCurrency, formatDate, STATUS_LABELS, STATUS_COLORS, cn, getErrorMessage } from '../lib/utils'
import { ClientCombobox } from '../components/ClientCombobox'

interface QuoteItemForm {
  serviceId?: string
  description: string
  price: number
  quantity: number
}

interface QuoteForm {
  clientId: string
  vehicleId: string
  items: QuoteItemForm[]
  discount: number
  validDays: number
  notes?: string
}

const fc = (hasError?: boolean) =>
  cn(
    'w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors',
    hasError
      ? 'border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-100'
      : 'border-input focus:border-primary focus:ring-2 focus:ring-primary/20',
  )

// ─── MODAL DE ORÇAMENTO (NOVO + EDITAR) ──────────────────────────────────────

function QuoteModal({ quote, onClose }: { quote?: any; onClose: () => void }) {
  const qc = useQueryClient()
  const isEdit = !!quote

  const defaultItems = isEdit
    ? quote.items.map((i: any) => ({ serviceId: i.serviceId ?? '', description: i.description, price: i.price, quantity: i.quantity }))
    : [{ description: '', price: 0, quantity: 1 }]

  const { register, handleSubmit, watch, control, setValue, formState: { errors } } = useForm<QuoteForm>({
    defaultValues: isEdit
      ? {
          clientId: quote.clientId,
          vehicleId: quote.vehicleId,
          items: defaultItems,
          discount: quote.discount,
          validDays: 7,
          notes: quote.notes ?? '',
        }
      : { items: [{ description: '', price: 0, quantity: 1 }], discount: 0, validDays: 7 },
  })
  const { fields, append, remove } = useFieldArray({ control, name: 'items' })
  const [waLink, setWaLink] = useState<string | null>(null)
  const selectedClientId = watch('clientId')

  const { data: vehiclesData } = useQuery({
    queryKey: ['vehicles', selectedClientId],
    queryFn: () => api.get('/vehicles', { params: { clientId: selectedClientId } }).then((r) => r.data),
    enabled: !!selectedClientId,
  })
  const { data: servicesData } = useQuery({
    queryKey: ['services'],
    queryFn: () => api.get('/services', { params: { active: true } }).then((r) => r.data),
  })

  const mutation = useMutation({
    mutationFn: (data: QuoteForm) => {
      const payload = {
        ...data,
        discount: Number(data.discount),
        validDays: Number(data.validDays),
        items: data.items.map((i) => ({
          ...i,
          price: Number(i.price),
          quantity: Number(i.quantity) || 1,
        })),
      }
      return isEdit
        ? api.put(`/quotes/${quote.id}`, payload)
        : api.post('/quotes', payload)
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['quotes'] })
      if (!isEdit && res.data.waLink) setWaLink(res.data.waLink)
      else onClose()
    },
  })

  if (waLink) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-xl">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
            <MessageCircle className="h-7 w-7 text-green-600" />
          </div>
          <h2 className="mb-2 text-lg font-semibold">Orçamento criado!</h2>
          <p className="mb-6 text-sm text-muted-foreground">Envie para o cliente pelo WhatsApp</p>
          <a
            href={waLink}
            target="_blank"
            rel="noopener noreferrer"
            className="mb-3 flex items-center justify-center gap-2 rounded-lg bg-green-500 py-3 text-sm font-semibold text-white hover:bg-green-600"
          >
            <MessageCircle className="h-4 w-4" /> Enviar orçamento pelo WhatsApp
          </a>
          <button onClick={onClose} className="w-full rounded-lg border py-2.5 text-sm font-medium hover:bg-muted">Fechar</button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{isEdit ? 'Editar orçamento' : 'Novo orçamento'}</h2>
          <button onClick={onClose}><X className="h-5 w-5 text-muted-foreground" /></button>
        </div>

        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          {Object.keys(errors).length > 0 && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2">
              <p className="text-sm font-medium text-red-600">Preencha todos os campos obrigatórios</p>
            </div>
          )}

          {/* Cliente */}
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

          {/* Veículo */}
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

          {/* Itens — layout responsivo */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-medium">Serviços / Itens *</label>
              <button
                type="button"
                onClick={() => append({ description: '', price: 0, quantity: 1 })}
                className="text-xs text-primary hover:underline"
              >
                + Adicionar item
              </button>
            </div>
            <div className="space-y-3">
              {fields.map((field, index) => (
                <div key={field.id} className="rounded-lg border p-3 space-y-2">
                  {/* Selecionar do catálogo */}
                  <select
                    onChange={(e) => {
                      const service = servicesData?.find((s: any) => s.id === e.target.value)
                      if (service) {
                        setValue(`items.${index}.description`, service.name)
                        setValue(`items.${index}.price`, service.basePrice)
                        setValue(`items.${index}.serviceId`, service.id)
                      }
                    }}
                    className="w-full rounded border border-input px-2 py-1.5 text-xs outline-none focus:border-primary"
                  >
                    <option value="">Selecionar do catálogo (opcional)</option>
                    {servicesData?.map((s: any) => (
                      <option key={s.id} value={s.id}>{s.name} — R${s.basePrice.toFixed(2)}</option>
                    ))}
                  </select>

                  {/* Descrição — linha inteira */}
                  <input
                    {...register(`items.${index}.description`, { required: true })}
                    placeholder="Descrição do serviço"
                    className={cn(
                      'w-full rounded border px-2 py-1.5 text-sm outline-none focus:border-primary',
                      errors.items?.[index]?.description ? 'border-red-500' : 'border-input',
                    )}
                  />

                  {/* Qtd + Preço + Delete — numa linha */}
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 flex-1">
                      <label className="text-xs text-muted-foreground whitespace-nowrap">Qtd</label>
                      <input
                        {...register(`items.${index}.quantity`)}
                        type="number" min="1"
                        className="w-16 rounded border border-input px-2 py-1.5 text-sm outline-none focus:border-primary"
                      />
                    </div>
                    <div className="flex items-center gap-1 flex-1">
                      <label className="text-xs text-muted-foreground whitespace-nowrap">Preço R$</label>
                      <input
                        {...register(`items.${index}.price`)}
                        type="number" step="0.01" min="0"
                        className="w-full rounded border border-input px-2 py-1.5 text-sm outline-none focus:border-primary"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => remove(index)}
                      disabled={fields.length === 1}
                      className="text-destructive hover:opacity-80 disabled:opacity-30 shrink-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium">Desconto (R$)</label>
              <input {...register('discount')} type="number" step="0.01" min="0" placeholder="0.00" className={fc()} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Validade (dias)</label>
              <input {...register('validDays')} type="number" min="1" placeholder="7" className={fc()} />
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
              {mutation.isPending ? 'Salvando...' : isEdit ? 'Salvar alterações' : 'Criar orçamento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── PÁGINA PRINCIPAL ─────────────────────────────────────────────────────────

export default function QuotesPage() {
  const [showModal, setShowModal] = useState(false)
  const [editingQuote, setEditingQuote] = useState<any>(null)
  const [statusFilter, setStatusFilter] = useState('')
  const [convertingId, setConvertingId] = useState<string | null>(null)
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['quotes', statusFilter],
    queryFn: () =>
      api.get('/quotes', { params: { status: statusFilter || undefined, limit: 50 } }).then((r) => r.data),
  })

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/quotes/${id}/status`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quotes'] }),
  })

  const convertMutation = useMutation({
    mutationFn: (id: string) => api.post(`/quotes/${id}/convert-to-os`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['quotes'] })
      qc.invalidateQueries({ queryKey: ['service-orders'] })
      setConvertingId(null)
    },
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Orçamentos</h1>
          <p className="text-sm text-muted-foreground">{data?.total ?? 0} no total</p>
        </div>
        <button
          onClick={() => { setEditingQuote(null); setShowModal(true) }}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> Novo orçamento
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {['', 'pending', 'approved', 'rejected', 'expired'].map((s) => (
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
          {data?.quotes?.map((q: any) => (
            <div key={q.id} className="rounded-xl border bg-card p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="font-semibold text-foreground">#{q.number}</p>
                      <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', STATUS_COLORS[q.status])}>
                        {STATUS_LABELS[q.status]}
                      </span>
                    </div>
                    <p className="truncate text-sm text-muted-foreground">{q.client?.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {q.vehicle?.brand} {q.vehicle?.model}{q.vehicle?.plate && ` • ${q.vehicle.plate}`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(q.createdAt)} • {q.items?.length} item(s)
                    </p>
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  <p className="text-lg font-bold text-foreground">{formatCurrency(q.totalValue)}</p>
                  {q.discount > 0 && (
                    <p className="text-xs text-muted-foreground">Desconto: {formatCurrency(q.discount)}</p>
                  )}

                  <div className="mt-2 flex flex-wrap justify-end gap-1.5">
                    {/* Editar — sempre disponível se não expirado/recusado */}
                    {q.status !== 'expired' && (
                      <button
                        onClick={() => { setEditingQuote(q); setShowModal(true) }}
                        className="flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-medium hover:bg-muted"
                      >
                        <Pencil className="h-3 w-3" /> Editar
                      </button>
                    )}

                    {q.status === 'pending' && (
                      <>
                        <button
                          onClick={() => statusMutation.mutate({ id: q.id, status: 'approved' })}
                          className="rounded-lg bg-green-100 px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-200"
                        >
                          Aprovar
                        </button>
                        <button
                          onClick={() => statusMutation.mutate({ id: q.id, status: 'rejected' })}
                          className="rounded-lg bg-red-100 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-200"
                        >
                          Recusar
                        </button>
                      </>
                    )}

                    {/* Converter em OS — disponível para pending e approved */}
                    {(q.status === 'approved' || q.status === 'pending') && (
                      convertingId === q.id ? (
                        <div className="flex items-center gap-1 rounded-lg bg-primary/10 px-2 py-1">
                          <span className="text-xs text-primary">Confirmar?</span>
                          <button
                            onClick={() => convertMutation.mutate(q.id)}
                            disabled={convertMutation.isPending}
                            className="text-xs font-semibold text-primary hover:underline disabled:opacity-60"
                          >
                            Sim
                          </button>
                          <span className="text-xs text-muted-foreground">/</span>
                          <button
                            onClick={() => setConvertingId(null)}
                            className="text-xs text-muted-foreground hover:underline"
                          >
                            Não
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConvertingId(q.id)}
                          className="flex items-center gap-1 rounded-lg bg-primary px-2 py-1 text-xs font-semibold text-white hover:bg-primary/90"
                        >
                          <ClipboardList className="h-3 w-3" /> Criar OS
                        </button>
                      )
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
          {data?.quotes?.length === 0 && (
            <div className="py-16 text-center text-muted-foreground">
              <FileText className="mx-auto mb-3 h-10 w-10 opacity-30" />
              <p>Nenhum orçamento encontrado</p>
            </div>
          )}
        </div>
      )}

      {showModal && (
        <QuoteModal
          quote={editingQuote}
          onClose={() => { setShowModal(false); setEditingQuote(null) }}
        />
      )}
    </div>
  )
}
