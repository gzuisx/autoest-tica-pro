import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, ToggleLeft, ToggleRight, X } from 'lucide-react'
import { useForm } from 'react-hook-form'
import api from '../services/api'
import { formatCurrency, cn, getErrorMessage } from '../lib/utils'

interface ServiceForm {
  name: string
  description?: string
  basePrice: number
  estimatedMinutes: number
  category?: string
  recurrenceDays?: number
}

const fc = (hasError?: boolean) =>
  cn(
    'w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors',
    hasError
      ? 'border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-100'
      : 'border-input focus:border-primary focus:ring-2 focus:ring-primary/20',
  )

function ServiceModal({ service, onClose }: { service?: any; onClose: () => void }) {
  const qc = useQueryClient()
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ServiceForm>({
    defaultValues: service || { estimatedMinutes: 60 },
  })

  const mutation = useMutation({
    mutationFn: (data: ServiceForm) =>
      service ? api.put(`/services/${service.id}`, data) : api.post('/services', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['services'] })
      onClose()
    },
  })

  const hasErrors = Object.keys(errors).length > 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{service ? 'Editar serviço' : 'Novo serviço'}</h2>
          <button onClick={onClose}>
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        <form
          onSubmit={handleSubmit((d) =>
            mutation.mutate({
              ...d,
              basePrice: Number(d.basePrice),
              estimatedMinutes: Number(d.estimatedMinutes),
              recurrenceDays: d.recurrenceDays ? Number(d.recurrenceDays) : undefined,
            }),
          )}
          className="space-y-4"
        >
          {hasErrors && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2">
              <p className="text-sm font-medium text-red-600">Preencha todos os campos obrigatórios</p>
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium">Nome do serviço *</label>
            <input
              {...register('name', { required: 'Obrigatório' })}
              placeholder="Ex: Higienização interna"
              className={fc(errors.name)}
            />
            {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Descrição</label>
            <textarea {...register('description')} rows={2} className={fc()} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium">Preço (R$) *</label>
              <input
                {...register('basePrice', {
                  required: 'Obrigatório',
                  min: { value: 0.01, message: 'Valor deve ser maior que zero' },
                })}
                type="number"
                step="0.01"
                min="0"
                placeholder="150.00"
                className={fc(errors.basePrice)}
              />
              {errors.basePrice && <p className="mt-1 text-xs text-red-600">{errors.basePrice.message}</p>}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Duração (min)</label>
              <input
                {...register('estimatedMinutes')}
                type="number"
                min="15"
                placeholder="60"
                className={fc()}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium">Categoria</label>
              <select {...register('category')} className={fc()}>
                <option value="">Sem categoria</option>
                <option value="lavagem">Lavagem</option>
                <option value="polimento">Polimento</option>
                <option value="protecao">Proteção</option>
                <option value="higienizacao">Higienização</option>
                <option value="estetica">Estética</option>
                <option value="outros">Outros</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Retorno sugerido (dias)</label>
              <input
                {...register('recurrenceDays')}
                type="number"
                min="1"
                placeholder="30"
                className={fc()}
              />
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

export default function ServicesPage() {
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const qc = useQueryClient()

  const { data: services = [], isLoading } = useQuery({
    queryKey: ['services'],
    queryFn: () => api.get('/services').then((r) => r.data),
  })

  const toggleMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/services/${id}/toggle`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['services'] }),
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Serviços</h1>
          <p className="text-sm text-muted-foreground">Catálogo de serviços oferecidos</p>
        </div>
        <button
          onClick={() => {
            setEditing(null)
            setShowModal(true)
          }}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Novo serviço
        </button>
      </div>

      {isLoading ? (
        <div className="flex h-40 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((service: any) => (
            <div
              key={service.id}
              className={cn('rounded-xl border bg-card p-4 shadow-sm transition-opacity', !service.active && 'opacity-60')}
            >
              <div className="mb-3 flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-foreground">{service.name}</p>
                  {service.category && (
                    <span className="text-xs capitalize text-muted-foreground">{service.category}</span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => toggleMutation.mutate(service.id)}
                    className="text-muted-foreground hover:text-foreground"
                    title={service.active ? 'Desativar' : 'Ativar'}
                  >
                    {service.active ? (
                      <ToggleRight className="h-5 w-5 text-green-500" />
                    ) : (
                      <ToggleLeft className="h-5 w-5" />
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setEditing(service)
                      setShowModal(true)
                    }}
                    className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {service.description && (
                <p className="mb-3 line-clamp-2 text-xs text-muted-foreground">{service.description}</p>
              )}

              <div className="flex items-center justify-between text-sm">
                <span className="text-xl font-bold text-primary">{formatCurrency(service.basePrice)}</span>
                <div className="text-right text-xs text-muted-foreground">
                  <p>{service.estimatedMinutes}min</p>
                  {service.recurrenceDays && <p>Retorno: {service.recurrenceDays}d</p>}
                </div>
              </div>
            </div>
          ))}
          {services.length === 0 && (
            <div className="col-span-full py-16 text-center text-muted-foreground">
              <p className="mb-2 text-4xl">🛠️</p>
              <p>Nenhum serviço cadastrado ainda</p>
              <p className="mt-1 text-xs">Cadastre os serviços que sua estética oferece</p>
            </div>
          )}
        </div>
      )}

      {showModal && (
        <ServiceModal
          service={editing}
          onClose={() => {
            setShowModal(false)
            setEditing(null)
          }}
        />
      )}
    </div>
  )
}
