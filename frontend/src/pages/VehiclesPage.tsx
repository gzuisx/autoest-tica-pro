import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, Car, Pencil, X, ChevronDown } from 'lucide-react'
import { useForm, Controller } from 'react-hook-form'
import api from '../services/api'
import { cn, getErrorMessage } from '../lib/utils'
import { ClientCombobox } from '../components/ClientCombobox'
import { usePlanLimit, handleLimitError } from '../hooks/usePlanLimit'
import { usePlanUsage } from '../hooks/usePlanUsage'

const FIPE_BASE = 'https://parallelum.com.br/fipe/api/v1/carros'

async function fipeFetch(path: string) {
  const res = await fetch(`${FIPE_BASE}${path}`)
  if (!res.ok) throw new Error('FIPE error')
  return res.json()
}

function FipePicker({
  onSelect,
  defaultBrand,
  defaultModel,
  defaultYear,
}: {
  onSelect: (brand: string, model: string, year: string) => void
  defaultBrand?: string
  defaultModel?: string
  defaultYear?: string
}) {
  const [brands, setBrands] = useState<{ codigo: string; nome: string }[]>([])
  const [models, setModels] = useState<{ codigo: number; nome: string }[]>([])
  const [years, setYears] = useState<{ codigo: string; nome: string }[]>([])
  const [selBrand, setSelBrand] = useState('')
  const [selModel, setSelModel] = useState('')
  const [selYear, setSelYear] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fipeFetch('/marcas').then(setBrands).catch(() => {})
  }, [])

  async function handleBrand(codigo: string, nome: string) {
    setSelBrand(codigo)
    setModels([])
    setYears([])
    setSelModel('')
    setSelYear('')
    if (!codigo) return
    setLoading(true)
    try {
      const data = await fipeFetch(`/marcas/${codigo}/modelos`)
      setModels(data.modelos ?? [])
    } finally {
      setLoading(false)
    }
    onSelect(nome, '', '')
  }

  async function handleModel(codigo: string, nome: string) {
    setSelModel(codigo)
    setYears([])
    setSelYear('')
    if (!codigo) return
    setLoading(true)
    try {
      const data = await fipeFetch(`/marcas/${selBrand}/modelos/${codigo}/anos`)
      setYears(data)
    } finally {
      setLoading(false)
    }
    const brandNome = brands.find((b) => b.codigo === selBrand)?.nome ?? ''
    onSelect(brandNome, nome, '')
  }

  function handleYear(codigo: string, nome: string) {
    setSelYear(codigo)
    const brandNome = brands.find((b) => b.codigo === selBrand)?.nome ?? ''
    const modelNome = models.find((m) => String(m.codigo) === selModel)?.nome ?? ''
    onSelect(brandNome, modelNome, nome.split(' ')[0]) // pega só o ano numérico
  }

  return (
    <div className="space-y-3 rounded-lg border border-dashed border-primary/40 bg-primary/5 p-3">
      <p className="text-xs font-medium text-primary">Buscar pela tabela FIPE</p>
      <div className="relative">
        <select
          value={selBrand}
          onChange={(e) => {
            const opt = e.target.options[e.target.selectedIndex]
            handleBrand(e.target.value, opt.text)
          }}
          className="w-full appearance-none rounded-lg border border-input bg-white px-3 py-2 pr-8 text-sm outline-none focus:border-primary"
        >
          <option value="">Selecione a marca</option>
          {brands.map((b) => (
            <option key={b.codigo} value={b.codigo}>{b.nome}</option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      </div>
      {models.length > 0 && (
        <div className="relative">
          <select
            value={selModel}
            onChange={(e) => {
              const opt = e.target.options[e.target.selectedIndex]
              handleModel(e.target.value, opt.text)
            }}
            className="w-full appearance-none rounded-lg border border-input bg-white px-3 py-2 pr-8 text-sm outline-none focus:border-primary"
          >
            <option value="">Selecione o modelo</option>
            {models.map((m) => (
              <option key={m.codigo} value={String(m.codigo)}>{m.nome}</option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        </div>
      )}
      {years.length > 0 && (
        <div className="relative">
          <select
            value={selYear}
            onChange={(e) => {
              const opt = e.target.options[e.target.selectedIndex]
              handleYear(e.target.value, opt.text)
            }}
            className="w-full appearance-none rounded-lg border border-input bg-white px-3 py-2 pr-8 text-sm outline-none focus:border-primary"
          >
            <option value="">Selecione o ano</option>
            {years.map((y) => (
              <option key={y.codigo} value={y.codigo}>{y.nome}</option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        </div>
      )}
      {loading && <p className="text-xs text-muted-foreground">Carregando...</p>}
    </div>
  )
}

interface VehicleForm {
  clientId: string
  brand: string
  model: string
  year?: number
  color?: string
  plate?: string
  chassis?: string
  mileage?: number
  notes?: string
}

const fc = (hasError?: boolean) =>
  cn(
    'w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors',
    hasError
      ? 'border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-100'
      : 'border-input focus:border-primary focus:ring-2 focus:ring-primary/20',
  )

function VehicleModal({ vehicle, onClose }: { vehicle?: any; onClose: () => void }) {
  const qc = useQueryClient()
  const { showUpgradeModal, refreshUsage } = usePlanLimit()
  const { data: planUsage } = usePlanUsage()
  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm<VehicleForm>({ defaultValues: vehicle || {} })

  const mutation = useMutation({
    mutationFn: (data: VehicleForm) =>
      vehicle ? api.put(`/vehicles/${vehicle.id}`, data) : api.post('/vehicles', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vehicles'] })
      refreshUsage()
      onClose()
    },
    onError: (err: any) => {
      if (!vehicle) {
        handleLimitError(err, showUpgradeModal, planUsage?.plan ?? 'basic', planUsage?.monthly ?? false)
      }
    },
  })

  const hasErrors = Object.keys(errors).length > 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{vehicle ? 'Editar veículo' : 'Novo veículo'}</h2>
          <button onClick={onClose}>
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        <form
          onSubmit={handleSubmit((d) =>
            mutation.mutate({
              ...d,
              year: d.year ? Number(d.year) : undefined,
              mileage: d.mileage ? Number(d.mileage) : undefined,
            }),
          )}
          className="space-y-4"
        >
          {hasErrors && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2">
              <p className="text-sm font-medium text-red-600">Preencha todos os campos obrigatórios</p>
            </div>
          )}

          {!vehicle && (
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
          )}

          <FipePicker
            onSelect={(brand, model, year) => {
              if (brand) setValue('brand', brand)
              if (model) setValue('model', model)
              if (year) setValue('year', Number(year))
            }}
          />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium">Marca *</label>
              <input
                {...register('brand', { required: 'Obrigatório' })}
                placeholder="Toyota"
                className={fc(errors.brand)}
              />
              {errors.brand && <p className="mt-1 text-xs text-red-600">{errors.brand.message}</p>}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Modelo *</label>
              <input
                {...register('model', { required: 'Obrigatório' })}
                placeholder="Corolla"
                className={fc(errors.model)}
              />
              {errors.model && <p className="mt-1 text-xs text-red-600">{errors.model.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium">Ano</label>
              <input
                {...register('year')}
                type="number"
                placeholder="2022"
                className={fc()}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Cor</label>
              <input {...register('color')} placeholder="Prata" className={fc()} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Placa</label>
              <input
                {...register('plate')}
                placeholder="ABC1D23"
                className={fc()}
                onChange={(e) => {
                  e.target.value = e.target.value.toUpperCase()
                }}
                style={{ textTransform: 'uppercase' }}
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Chassi (VIN) *</label>
            <input
              {...register('chassis', { required: 'Chassi é obrigatório' })}
              placeholder="9BWZZZ377VT004251"
              className={fc(!!errors.chassis)}
              onChange={(e) => { e.target.value = e.target.value.toUpperCase() }}
              style={{ textTransform: 'uppercase' }}
            />
            {errors.chassis && <p className="mt-1 text-xs text-red-600">{errors.chassis.message}</p>}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Observações</label>
            <textarea {...register('notes')} rows={2} className={fc()} />
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

export default function VehiclesPage() {
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<any>(null)

  const { data = [], isLoading } = useQuery({
    queryKey: ['vehicles', search],
    queryFn: () => api.get('/vehicles', { params: { search } }).then((r) => r.data),
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Veículos</h1>
          <p className="text-sm text-muted-foreground">{data.length} cadastrados</p>
        </div>
        <button
          onClick={() => {
            setEditing(null)
            setShowModal(true)
          }}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Novo veículo
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por marca, modelo, placa ou nome do cliente..."
          className="w-full rounded-lg border border-input bg-white py-2.5 pl-9 pr-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
      </div>

      {isLoading ? (
        <div className="flex h-40 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((vehicle: any) => (
            <div key={vehicle.id} className="rounded-xl border bg-card p-4 shadow-sm">
              <div className="mb-3 flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                    <Car className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">
                      {vehicle.brand} {vehicle.model}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {vehicle.color} {vehicle.year && `• ${vehicle.year}`}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setEditing(vehicle)
                    setShowModal(true)
                  }}
                  className="rounded p-1.5 hover:bg-muted"
                >
                  <Pencil className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>

              {vehicle.plate && (
                <div className="mb-2 inline-block rounded bg-slate-100 px-2 py-1 font-mono text-xs font-bold tracking-widest">
                  {vehicle.plate}
                </div>
              )}

              <p className="text-xs text-muted-foreground">Dono: {vehicle.client?.name}</p>
              <p className="text-xs text-muted-foreground">
                {vehicle._count?.serviceOrders ?? 0} ordens de serviço
              </p>
            </div>
          ))}
          {data.length === 0 && (
            <div className="col-span-full py-16 text-center text-muted-foreground">
              <Car className="mx-auto mb-3 h-10 w-10 opacity-30" />
              <p>Nenhum veículo cadastrado</p>
            </div>
          )}
        </div>
      )}

      {showModal && (
        <VehicleModal
          vehicle={editing}
          onClose={() => {
            setShowModal(false)
            setEditing(null)
          }}
        />
      )}
    </div>
  )
}
