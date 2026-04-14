import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Calendar, X, MessageCircle, Check, Pencil, ClipboardList } from 'lucide-react'
import { useForm, Controller } from 'react-hook-form'
import api from '../services/api'
import { STATUS_LABELS, STATUS_COLORS, cn, getErrorMessage } from '../lib/utils'
import { ClientCombobox } from '../components/ClientCombobox'

interface ScheduleForm {
  clientId: string
  vehicleId: string
  dateTime: string
  notes?: string
}

const fc = (hasError?: boolean) =>
  cn(
    'w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors',
    hasError
      ? 'border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-100'
      : 'border-input focus:border-primary focus:ring-2 focus:ring-primary/20',
  )

function ServiceCheckboxList({
  servicesData,
  selectedIds,
  onToggle,
  hasError,
}: {
  servicesData: any[]
  selectedIds: string[]
  onToggle: (id: string) => void
  hasError: boolean
}) {
  return (
    <>
      <div
        className={cn(
          'max-h-52 overflow-y-auto rounded-lg border p-2',
          hasError ? 'border-red-500' : 'border-input',
        )}
      >
        {!servicesData || servicesData.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">
            Nenhum serviço ativo. Cadastre serviços primeiro.
          </p>
        ) : (
          <div className="space-y-1">
            {servicesData.map((s: any) => {
              const isSelected = selectedIds.includes(s.id)
              return (
                <div
                  key={s.id}
                  onClick={() => onToggle(s.id)}
                  className={cn(
                    'flex cursor-pointer select-none items-center gap-3 rounded-lg p-2 transition-colors',
                    isSelected ? 'bg-primary/10' : 'hover:bg-muted',
                  )}
                >
                  <div
                    className={cn(
                      'flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors',
                      isSelected ? 'border-primary bg-primary' : 'border-muted-foreground/30 bg-white',
                    )}
                  >
                    {isSelected && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">{s.name}</p>
                    <p className="text-xs text-muted-foreground">
                      R${s.basePrice.toFixed(2)} • {s.estimatedMinutes}min
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
      {hasError && <p className="mt-1 text-xs text-red-600">Selecione pelo menos um serviço</p>}
      {selectedIds.length > 0 && (
        <p className="mt-1 text-xs text-muted-foreground">{selectedIds.length} serviço(s) selecionado(s)</p>
      )}
    </>
  )
}

function NewScheduleModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const {
    register,
    handleSubmit,
    watch,
    control,
    formState: { errors },
  } = useForm<ScheduleForm>()
  const selectedClientId = watch('clientId')
  const [waLink, setWaLink] = useState<string | null>(null)
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([])
  const [serviceError, setServiceError] = useState(false)

  const { data: vehiclesData } = useQuery({
    queryKey: ['vehicles', selectedClientId],
    queryFn: () =>
      api.get('/vehicles', { params: { clientId: selectedClientId } }).then((r) => r.data),
    enabled: !!selectedClientId,
  })

  const { data: servicesData = [] } = useQuery({
    queryKey: ['services'],
    queryFn: () => api.get('/services', { params: { active: true } }).then((r) => r.data),
  })

  const mutation = useMutation({
    mutationFn: (data: ScheduleForm & { serviceIds: string[] }) => api.post('/schedules', data),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['schedules'] })
      if (res.data.warning) alert(`⚠️ ${res.data.warning}`)
      if (res.data.waConfirmLink) setWaLink(res.data.waConfirmLink)
      else onClose()
    },
  })

  const toggleService = (id: string) => {
    setSelectedServiceIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
    setServiceError(false)
  }

  const onSubmit = (data: ScheduleForm) => {
    if (selectedServiceIds.length === 0) { setServiceError(true); return }
    mutation.mutate({ ...data, serviceIds: selectedServiceIds })
  }

  const hasErrors = Object.keys(errors).length > 0 || serviceError

  if (waLink) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-xl">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
            <MessageCircle className="h-7 w-7 text-green-600" />
          </div>
          <h2 className="mb-2 text-lg font-semibold">Agendamento criado!</h2>
          <p className="mb-6 text-sm text-muted-foreground">Confirme com o cliente pelo WhatsApp</p>
          <a
            href={waLink}
            target="_blank"
            rel="noopener noreferrer"
            className="mb-3 flex items-center justify-center gap-2 rounded-lg bg-green-500 py-3 text-sm font-semibold text-white hover:bg-green-600"
          >
            <MessageCircle className="h-4 w-4" />
            Enviar confirmação pelo WhatsApp
          </a>
          <button onClick={onClose} className="w-full rounded-lg border py-2.5 text-sm font-medium hover:bg-muted">
            Fechar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Novo agendamento</h2>
          <button onClick={onClose}><X className="h-5 w-5 text-muted-foreground" /></button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {hasErrors && (
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
                <ClientCombobox
                  value={field.value ?? ''}
                  onChange={(id) => field.onChange(id)}
                  hasError={!!errors.clientId}
                />
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
                <option key={v.id} value={v.id}>
                  {v.brand} {v.model} {v.plate && `(${v.plate})`}
                </option>
              ))}
            </select>
            {errors.vehicleId && <p className="mt-1 text-xs text-red-600">{errors.vehicleId.message}</p>}
            {selectedClientId && vehiclesData?.length === 0 && (
              <p className="mt-1 text-xs text-amber-600">Este cliente não tem veículos. Cadastre um veículo primeiro.</p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Serviços *</label>
            <ServiceCheckboxList
              servicesData={servicesData}
              selectedIds={selectedServiceIds}
              onToggle={toggleService}
              hasError={serviceError}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Data e hora *</label>
            <input
              {...register('dateTime', {
                required: 'Obrigatório',
                validate: (v) => new Date(v) > new Date() || 'O agendamento deve ser em uma data futura',
              })}
              type="datetime-local"
              className={fc(errors.dateTime)}
            />
            {errors.dateTime && <p className="mt-1 text-xs text-red-600">{errors.dateTime.message}</p>}
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
            <button type="button" onClick={onClose} className="flex-1 rounded-lg border py-2 text-sm font-medium hover:bg-muted">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="flex-1 rounded-lg bg-primary py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60"
            >
              {mutation.isPending ? 'Criando...' : 'Criar agendamento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function EditScheduleModal({ schedule, onClose }: { schedule: any; onClose: () => void }) {
  const qc = useQueryClient()
  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: {
      dateTime: schedule.dateTime ? new Date(schedule.dateTime).toISOString().slice(0, 16) : '',
      notes: schedule.notes || '',
    },
  })
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>(
    schedule.services?.map((sv: any) => sv.serviceId) ?? [],
  )
  const [serviceError, setServiceError] = useState(false)
  const [waLink, setWaLink] = useState<string | null>(null)

  const { data: servicesData = [] } = useQuery({
    queryKey: ['services'],
    queryFn: () => api.get('/services', { params: { active: true } }).then((r) => r.data),
  })

  const mutation = useMutation({
    mutationFn: (data: any) => api.put(`/schedules/${schedule.id}`, data),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['schedules'] })
      if (res.data.waUpdateLink) setWaLink(res.data.waUpdateLink)
      else onClose()
    },
  })

  const toggleService = (id: string) => {
    setSelectedServiceIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
    setServiceError(false)
  }

  const onSubmit = (data: any) => {
    if (selectedServiceIds.length === 0) { setServiceError(true); return }
    mutation.mutate({ ...data, serviceIds: selectedServiceIds })
  }

  if (waLink) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-xl">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
            <MessageCircle className="h-7 w-7 text-green-600" />
          </div>
          <h2 className="mb-2 text-lg font-semibold">Agendamento atualizado!</h2>
          <p className="mb-6 text-sm text-muted-foreground">Avise o cliente sobre a alteração</p>
          <a
            href={waLink}
            target="_blank"
            rel="noopener noreferrer"
            className="mb-3 flex items-center justify-center gap-2 rounded-lg bg-green-500 py-3 text-sm font-semibold text-white hover:bg-green-600"
          >
            <MessageCircle className="h-4 w-4" />
            Enviar atualização pelo WhatsApp
          </a>
          <button onClick={onClose} className="w-full rounded-lg border py-2.5 text-sm font-medium hover:bg-muted">
            Fechar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Editar agendamento</h2>
          <button onClick={onClose}><X className="h-5 w-5 text-muted-foreground" /></button>
        </div>

        <div className="mb-4 rounded-lg bg-muted/50 px-3 py-2 text-sm">
          <p className="font-medium">{schedule.client?.name}</p>
          <p className="text-muted-foreground">{schedule.vehicle?.brand} {schedule.vehicle?.model} {schedule.vehicle?.plate && `• ${schedule.vehicle.plate}`}</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Nova data e hora *</label>
            <input
              {...register('dateTime', { required: 'Obrigatório' })}
              type="datetime-local"
              className={fc(errors.dateTime)}
            />
            {errors.dateTime && <p className="mt-1 text-xs text-red-600">{errors.dateTime.message}</p>}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Serviços *</label>
            <ServiceCheckboxList
              servicesData={servicesData}
              selectedIds={selectedServiceIds}
              onToggle={toggleService}
              hasError={serviceError}
            />
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
            <button type="button" onClick={onClose} className="flex-1 rounded-lg border py-2 text-sm font-medium hover:bg-muted">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="flex-1 rounded-lg bg-primary py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60"
            >
              {mutation.isPending ? 'Salvando...' : 'Salvar alterações'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const ALL_STATUSES = [
  { value: 'scheduled', label: 'Agendado' },
  { value: 'confirmed', label: 'Confirmado' },
  { value: 'in_progress', label: 'Em andamento' },
  { value: 'completed', label: 'Concluído' },
  { value: 'cancelled', label: 'Cancelado' },
  { value: 'no_show', label: 'Não compareceu' },
]

function StatusPicker({ scheduleId, current }: { scheduleId: string; current: string }) {
  const [open, setOpen] = useState(false)
  const qc = useQueryClient()

  const mutation = useMutation({
    mutationFn: (status: string) => api.patch(`/schedules/${scheduleId}/status`, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['schedules'] })
      setOpen(false)
    },
  })

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn('rounded-full px-2 py-0.5 text-xs font-medium', STATUS_COLORS[current])}
      >
        {STATUS_LABELS[current]} ▾
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-44 rounded-lg border bg-white shadow-lg">
          {ALL_STATUSES.map((s) => (
            <button
              key={s.value}
              onClick={() => mutation.mutate(s.value)}
              disabled={s.value === current}
              className={cn(
                'flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-muted',
                s.value === current && 'font-semibold opacity-50',
              )}
            >
              {s.value === current && <Check className="h-3 w-3" />}
              {s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function ConvertToOSButton({ schedule }: { schedule: any }) {
  const qc = useQueryClient()
  const [done, setDone] = useState<{ number: number } | null>(null)

  const mutation = useMutation({
    mutationFn: () => api.post(`/schedules/${schedule.id}/to-service-order`),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['schedules'] })
      setDone({ number: res.data.number })
    },
  })

  if (done) {
    return (
      <span className="rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
        OS #{String(done.number).padStart(3, '0')} criada!
      </span>
    )
  }

  const alreadyInProgress = schedule.status === 'in_progress' || schedule.status === 'completed'

  return (
    <button
      onClick={() => mutation.mutate()}
      disabled={mutation.isPending || alreadyInProgress}
      title={alreadyInProgress ? 'Já convertido em OS' : 'Converter em Ordem de Serviço'}
      className={cn(
        'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
        alreadyInProgress
          ? 'cursor-default bg-muted text-muted-foreground'
          : 'bg-primary text-white hover:bg-primary/90 disabled:opacity-60',
      )}
    >
      <ClipboardList className="h-3.5 w-3.5" />
      {mutation.isPending ? 'Criando...' : 'Abrir OS'}
    </button>
  )
}

export default function SchedulesPage() {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [showModal, setShowModal] = useState(false)
  const [editingSchedule, setEditingSchedule] = useState<any>(null)

  const { data = [], isLoading } = useQuery({
    queryKey: ['schedules', date],
    queryFn: () => api.get('/schedules', { params: { date } }).then((r) => r.data),
  })

  // Week count
  const weekStart = new Date(date)
  weekStart.setDate(weekStart.getDate() - weekStart.getDay())
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 6)

  const { data: weekData = [] } = useQuery({
    queryKey: ['schedules-week', weekStart.toISOString().split('T')[0]],
    queryFn: () =>
      api
        .get('/schedules', {
          params: {
            start: weekStart.toISOString().split('T')[0],
            end: weekEnd.toISOString().split('T')[0],
          },
        })
        .then((r) => r.data),
  })

  // Month count
  const monthStart = new Date(date.slice(0, 7) + '-01')
  const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0)

  const { data: monthData = [] } = useQuery({
    queryKey: ['schedules-month', date.slice(0, 7)],
    queryFn: () =>
      api
        .get('/schedules', {
          params: {
            start: monthStart.toISOString().split('T')[0],
            end: monthEnd.toISOString().split('T')[0],
          },
        })
        .then((r) => r.data),
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Agenda</h1>
          <p className="text-sm text-muted-foreground">
            {(data as any[]).length} hoje • {(weekData as any[]).length} esta semana • {(monthData as any[]).length} este mês
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Novo agendamento
        </button>
      </div>

      {/* Seletor de data */}
      <div className="flex items-center gap-3">
        <Calendar className="h-5 w-5 text-muted-foreground" />
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-lg border border-input px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
      </div>

      {isLoading ? (
        <div className="flex h-40 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : (
        <div className="space-y-3">
          {(data as any[]).map((s: any) => {
            const waNumber = (s.client?.whatsapp || s.client?.phone || '').replace(/\D/g, '')
            const totalValue = s.services?.reduce((acc: number, sv: any) => acc + (sv.price ?? 0), 0) ?? 0
            return (
              <div
                key={s.id}
                className={cn(
                  'rounded-xl border bg-card p-4 shadow-sm',
                  s.status === 'in_progress' && 'border-yellow-300 bg-yellow-50',
                  s.status === 'completed' && 'border-green-200 bg-green-50/50',
                  s.status === 'cancelled' && 'border-red-200 opacity-60',
                )}
              >
                <div className="flex items-start gap-4">
                  <div className="text-center">
                    <p className="text-lg font-bold text-foreground">
                      {new Date(s.dateTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                    {s.endDateTime && (
                      <p className="text-xs text-muted-foreground">
                        até {new Date(s.endDateTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-foreground">{s.client?.name}</p>
                      <StatusPicker scheduleId={s.id} current={s.status} />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {s.vehicle?.brand} {s.vehicle?.model} {s.vehicle?.plate && `• ${s.vehicle.plate}`}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {s.services?.map((sv: any) => sv.service?.name).join(', ')}
                    </p>
                    {totalValue > 0 && (
                      <p className="mt-1 text-xs font-medium text-primary">
                        R$ {totalValue.toFixed(2)}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <ConvertToOSButton schedule={s} />
                    <button
                      onClick={() => setEditingSchedule(s)}
                      className="rounded-lg border px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted"
                      title="Editar"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    {waNumber && (
                      <a
                        href={`https://wa.me/55${waNumber}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-lg bg-green-100 px-3 py-1.5 text-xs font-semibold text-green-700 hover:bg-green-200"
                      >
                        WhatsApp
                      </a>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
          {(data as any[]).length === 0 && (
            <div className="py-16 text-center text-muted-foreground">
              <Calendar className="mx-auto mb-3 h-10 w-10 opacity-30" />
              <p>Nenhum agendamento nesta data</p>
            </div>
          )}
        </div>
      )}

      {showModal && <NewScheduleModal onClose={() => setShowModal(false)} />}
      {editingSchedule && (
        <EditScheduleModal schedule={editingSchedule} onClose={() => setEditingSchedule(null)} />
      )}
    </div>
  )
}
