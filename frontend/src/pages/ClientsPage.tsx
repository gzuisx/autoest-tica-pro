import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, MessageCircle, ChevronRight, X, Pencil, Car, ClipboardList, MapPin, Loader2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import api from '../services/api'
import { formatPhone, formatDate, formatCurrency, STATUS_LABELS, STATUS_COLORS, cn, getErrorMessage } from '../lib/utils'
import { usePlanLimit, handleLimitError } from '../hooks/usePlanLimit'
import { usePlanUsage } from '../hooks/usePlanUsage'

interface ClientForm {
  name: string
  phone?: string
  whatsapp: string
  email?: string
  cpf?: string
  rg?: string
  origin?: string
  notes?: string
  acceptsPromo: boolean
  zipCode?: string
  street?: string
  addressNumber?: string
  neighborhood?: string
  city?: string
  state?: string
}

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

function ClientModal({ client, onClose }: { client?: any; onClose: () => void }) {
  const qc = useQueryClient()
  const { showUpgradeModal, refreshUsage } = usePlanLimit()
  const { data: planUsage } = usePlanUsage()
  const [cepLoading, setCepLoading] = useState(false)
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<ClientForm>({
    defaultValues: client || { acceptsPromo: true },
  })

  const mutation = useMutation({
    mutationFn: (data: ClientForm) =>
      client ? api.put(`/clients/${client.id}`, data) : api.post('/clients', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients'] })
      refreshUsage()
      onClose()
    },
    onError: (err: any) => {
      if (!client) {
        handleLimitError(err, showUpgradeModal, planUsage?.plan ?? 'basic', planUsage?.monthly ?? false)
      }
    },
  })

  const hasErrors = Object.keys(errors).length > 0

  async function handleCepBlur(e: React.FocusEvent<HTMLInputElement>) {
    const cep = e.target.value.replace(/\D/g, '')
    if (cep.length !== 8) return
    setCepLoading(true)
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`)
      const data = await res.json()
      if (!data.erro) {
        setValue('street', data.logradouro || '')
        setValue('neighborhood', data.bairro || '')
        setValue('city', data.localidade || '')
        setValue('state', data.uf || '')
      }
    } catch {
      // silencia erro de rede
    } finally {
      setCepLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md max-h-[88vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">{client ? 'Editar cliente' : 'Novo cliente'}</h2>
            {client?.registrationNumber && (
              <p className="text-xs font-mono text-muted-foreground">
                Cadastro {formatRegNum(client.registrationNumber)}
              </p>
            )}
            {!client && (
              <p className="text-xs text-muted-foreground">Número de cadastro será atribuído automaticamente</p>
            )}
          </div>
          <button onClick={onClose}>
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          {hasErrors && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2">
              <p className="text-sm font-medium text-red-600">Preencha todos os campos obrigatórios</p>
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium">Nome *</label>
            <input
              {...register('name', { required: 'Obrigatório', minLength: { value: 2, message: 'Mínimo 2 caracteres' } })}
              className={fc(errors.name)}
            />
            {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium">Telefone</label>
              <input
                {...register('phone', { minLength: { value: 8, message: 'Mínimo 8 dígitos' } })}
                placeholder="(11) 99999-9999"
                className={fc(errors.phone)}
              />
              {errors.phone && <p className="mt-1 text-xs text-red-600">{errors.phone.message}</p>}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">WhatsApp *</label>
              <input
                {...register('whatsapp', { required: 'Obrigatório', minLength: { value: 8, message: 'Mínimo 8 dígitos' } })}
                placeholder="(11) 99999-9999"
                className={fc(errors.whatsapp)}
              />
              {errors.whatsapp && <p className="mt-1 text-xs text-red-600">{errors.whatsapp.message}</p>}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">E-mail</label>
            <input
              {...register('email', {
                validate: (v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) || 'E-mail inválido',
              })}
              type="email"
              className={fc(errors.email)}
            />
            {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium">CPF</label>
              <input {...register('cpf')} placeholder="000.000.000-00" className={fc()} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">RG</label>
              <input {...register('rg')} placeholder="00.000.000-0" className={fc()} />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Como nos encontrou?</label>
            <select {...register('origin')} className={fc()}>
              <option value="">Selecione</option>
              <option value="indicacao">Indicação</option>
              <option value="instagram">Instagram</option>
              <option value="google">Google</option>
              <option value="facebook">Facebook</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="outro">Outro</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Observações</label>
            <textarea {...register('notes')} rows={2} className={fc()} />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" {...register('acceptsPromo')} className="rounded" />
            Aceita receber promoções por WhatsApp
          </label>

          {/* Endereço */}
          <div className="border-t pt-4">
            <div className="mb-3 flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">Endereço (opcional)</span>
            </div>
            <div className="space-y-3">
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <label className="mb-1 block text-sm font-medium">CEP</label>
                  <input
                    {...register('zipCode')}
                    placeholder="00000-000"
                    className={fc()}
                    onBlur={handleCepBlur}
                  />
                </div>
                {cepLoading && <Loader2 className="mb-2 h-5 w-5 animate-spin text-primary" />}
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="mb-1 block text-sm font-medium">Rua</label>
                  <input {...register('street')} className={fc()} />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Número</label>
                  <input {...register('addressNumber')} className={fc()} />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Bairro</label>
                <input {...register('neighborhood')} className={fc()} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="mb-1 block text-sm font-medium">Cidade</label>
                  <input {...register('city')} className={fc()} />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">UF</label>
                  <input {...register('state')} maxLength={2} className={fc()} style={{ textTransform: 'uppercase' }} />
                </div>
              </div>
            </div>
          </div>

          {mutation.error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2">
              <p className="text-sm text-red-600">
                {getErrorMessage(mutation.error)}
              </p>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border py-2 text-sm font-medium hover:bg-muted"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="flex-1 rounded-lg bg-primary py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60"
            >
              {mutation.isPending ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ClientDetailModal({ clientId, onClose, onEdit }: { clientId: string; onClose: () => void; onEdit: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['client-detail', clientId],
    queryFn: () => api.get(`/clients/${clientId}`).then((r) => r.data),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center p-0 sm:p-4">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white shadow-xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold">Detalhe do cliente</h2>
            {data?.registrationNumber && (
              <p className="text-xs font-mono text-muted-foreground">Cadastro {formatRegNum(data.registrationNumber)}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onEdit}
              className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-muted"
            >
              <Pencil className="h-3.5 w-3.5" /> Editar
            </button>
            <button onClick={onClose}><X className="h-5 w-5 text-muted-foreground" /></button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex h-40 items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : data && (
          <div className="space-y-5 p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xl font-bold text-primary">
                {data.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-lg font-bold text-foreground">{data.name}</p>
                <p className="text-sm text-muted-foreground">{formatPhone(data.whatsapp || data.phone || '')}</p>
                {data.email && <p className="text-sm text-muted-foreground">{data.email}</p>}
              </div>
              {(data.whatsapp || data.phone) && (
                <a
                  href={`https://wa.me/55${(data.whatsapp || data.phone || '').replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto rounded-xl bg-green-500 px-4 py-2 text-sm font-semibold text-white hover:bg-green-600"
                >
                  WhatsApp
                </a>
              )}
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl border bg-muted/40 p-3 text-center">
                <p className="text-xl font-bold text-primary">{formatCurrency(data.totalSpent ?? 0)}</p>
                <p className="text-xs text-muted-foreground">Total gasto</p>
              </div>
              <div className="rounded-xl border bg-muted/40 p-3 text-center">
                <p className="text-xl font-bold text-foreground">{data.serviceOrders?.length ?? 0}</p>
                <p className="text-xs text-muted-foreground">Ordens de serviço</p>
              </div>
              <div className="rounded-xl border bg-muted/40 p-3 text-center">
                <p className="text-xl font-bold text-foreground">{data.daysSinceLastVisit ?? '—'}</p>
                <p className="text-xs text-muted-foreground">Dias sem visita</p>
              </div>
            </div>

            {(data.origin || data.notes) && (
              <div className="rounded-xl border p-3 space-y-1 text-sm">
                {data.origin && (
                  <p className="text-muted-foreground">Como chegou: <span className="font-medium text-foreground capitalize">{data.origin}</span></p>
                )}
                {data.notes && (
                  <p className="text-muted-foreground">Obs: <span className="text-foreground">{data.notes}</span></p>
                )}
              </div>
            )}

            {data.vehicles?.length > 0 && (
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <Car className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold">Veículos ({data.vehicles.length})</h3>
                </div>
                <div className="space-y-2">
                  {data.vehicles.map((v: any) => (
                    <div key={v.id} className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3">
                      <div>
                        <p className="text-sm font-medium">{v.brand} {v.model} {v.year && `(${v.year})`}</p>
                        <p className="text-xs text-muted-foreground">
                          {v.color && `${v.color} • `}
                          {v.plate && <span className="font-mono font-bold">{v.plate}</span>}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {data.serviceOrders?.length > 0 && (
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <ClipboardList className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold">Últimas ordens de serviço</h3>
                </div>
                <div className="space-y-2">
                  {data.serviceOrders.map((o: any) => {
                    const paid = o.payments?.reduce((a: number, p: any) => a + p.amount, 0) ?? 0
                    const isPaid = paid >= o.finalValue
                    return (
                      <div key={o.id} className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium">#{o.number}</p>
                            <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', STATUS_COLORS[o.status])}>
                              {STATUS_LABELS[o.status]}
                            </span>
                            <span className={cn('text-xs font-medium', isPaid ? 'text-green-600' : 'text-orange-500')}>
                              {isPaid ? '✓ Pago' : 'Em aberto'}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">{formatDate(o.createdAt)}</p>
                        </div>
                        <p className="shrink-0 text-sm font-bold text-foreground">{formatCurrency(o.finalValue)}</p>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {(data.waLinks?.returnReminder || data.waLinks?.birthday) && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold">Mensagens rápidas</h3>
                {data.waLinks.returnReminder && (
                  <a
                    href={data.waLinks.returnReminder}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 rounded-lg border bg-green-50 px-4 py-2.5 text-sm font-medium text-green-700 hover:bg-green-100"
                  >
                    <MessageCircle className="h-4 w-4" />
                    Lembrete de retorno
                  </a>
                )}
                {data.waLinks.birthday && (
                  <a
                    href={data.waLinks.birthday}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 rounded-lg border bg-orange-50 px-4 py-2.5 text-sm font-medium text-orange-700 hover:bg-orange-100"
                  >
                    <MessageCircle className="h-4 w-4" />
                    Parabéns de aniversário
                  </a>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default function ClientsPage() {
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [viewingClientId, setViewingClientId] = useState<string | null>(null)
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['clients', search],
    queryFn: () => api.get('/clients', { params: { search, limit: 50 } }).then((r) => r.data),
  } as any)

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/clients/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clients'] }),
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Clientes</h1>
          <p className="text-sm text-muted-foreground">{data?.total ?? 0} cadastrados</p>
        </div>
        <button
          onClick={() => {
            setEditing(null)
            setShowModal(true)
          }}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Novo cliente
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome, telefone, placa ou #cadastro..."
          className="w-full rounded-lg border border-input bg-white py-2.5 pl-9 pr-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
      </div>

      {isLoading ? (
        <div className="flex h-40 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : (
        <div className="space-y-2">
          {data?.clients?.map((client: any) => {
            const waNumber = (client.whatsapp || client.phone || '').replace(/\D/g, '')
            return (
              <div
                key={client.id}
                className="flex items-center gap-4 rounded-xl border bg-card p-4 shadow-sm transition-colors hover:border-primary/30"
              >
                <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                  {client.name.charAt(0).toUpperCase()}
                  {client.registrationNumber && (
                    <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 rounded-full bg-primary px-1 text-[9px] font-bold text-white whitespace-nowrap">
                      {formatRegNum(client.registrationNumber)}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground">{client.name}</p>
                  <p className="text-sm text-muted-foreground">{formatPhone(client.whatsapp || client.phone || '')}</p>
                  {client.vehicles?.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {client.vehicles.map((v: any) => `${v.brand} ${v.model}`).join(' · ')}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{client._count?.serviceOrders ?? 0} OS</span>
                  {waNumber && (
                    <a
                      href={`https://wa.me/55${waNumber}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg bg-green-100 p-2 text-green-700 hover:bg-green-200"
                    >
                      <MessageCircle className="h-4 w-4" />
                    </a>
                  )}
                  <button
                    onClick={() => {
                      setEditing(client)
                      setShowModal(true)
                    }}
                    className="rounded-lg border p-2 hover:bg-muted"
                    title="Editar"
                  >
                    <Pencil className="h-4 w-4 text-muted-foreground" />
                  </button>
                  <button
                    onClick={() => setViewingClientId(client.id)}
                    className="rounded-lg border p-2 hover:bg-muted"
                    title="Ver detalhes"
                  >
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </button>
                </div>
              </div>
            )
          })}
          {data?.clients?.length === 0 && (
            <div className="py-16 text-center text-muted-foreground">
              <UsersIcon className="mx-auto mb-3 h-10 w-10 opacity-30" />
              <p>Nenhum cliente encontrado</p>
            </div>
          )}
        </div>
      )}

      {showModal && (
        <ClientModal
          client={editing}
          onClose={() => {
            setShowModal(false)
            setEditing(null)
          }}
        />
      )}
      {viewingClientId && (
        <ClientDetailModal
          clientId={viewingClientId}
          onClose={() => setViewingClientId(null)}
          onEdit={() => {
            const client = data?.clients?.find((c: any) => c.id === viewingClientId)
            setEditing(client ?? null)
            setViewingClientId(null)
            setShowModal(true)
          }}
        />
      )}
    </div>
  )
}

function UsersIcon(props: any) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      {...props}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z"
      />
    </svg>
  )
}
