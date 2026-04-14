import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Car, CheckCircle2, ChevronRight, Wrench, X } from 'lucide-react'
import { useForm } from 'react-hook-form'
import api from '../services/api'
import { useAuth } from '../hooks/useAuth'
import { cn } from '../lib/utils'

const ONBOARDING_KEY = 'onboarding_done'

interface ServiceForm {
  name: string
  basePrice: string
  estimatedMinutes: string
  category: string
}

const CATEGORY_OPTIONS = [
  { value: 'lavagem', label: 'Lavagem' },
  { value: 'polimento', label: 'Polimento' },
  { value: 'higienizacao', label: 'Higienização' },
  { value: 'blindagem', label: 'Blindagem / PPF' },
  { value: 'detalhamento', label: 'Detalhamento' },
  { value: 'outro', label: 'Outro' },
]

function StepIndicator({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'h-1.5 rounded-full transition-all',
            i < step ? 'w-6 bg-primary' : i === step ? 'w-6 bg-primary' : 'w-3 bg-muted',
          )}
        />
      ))}
    </div>
  )
}

export function OnboardingWizard({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0)
  const qc = useQueryClient()
  const { user } = useAuth()

  const { register, handleSubmit, formState: { errors } } = useForm<ServiceForm>({
    defaultValues: { estimatedMinutes: '60', category: 'lavagem' },
  })

  const serviceMutation = useMutation({
    mutationFn: (data: ServiceForm) =>
      api.post('/services', {
        name: data.name,
        basePrice: Number(data.basePrice),
        estimatedMinutes: Number(data.estimatedMinutes),
        category: data.category,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['services'] })
      setStep(2)
    },
  })

  function finish() {
    localStorage.setItem(ONBOARDING_KEY, '1')
    onDone()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
              <Car className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Bem-vindo ao AutoEstética Pro!</p>
              <StepIndicator step={step} total={3} />
            </div>
          </div>
          <button onClick={finish} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Step 0 — Boas-vindas */}
        {step === 0 && (
          <div className="p-6 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
              <Car className="h-9 w-9 text-primary" />
            </div>
            <h2 className="mb-2 text-xl font-bold">Olá, {user?.name?.split(' ')[0]}!</h2>
            <p className="mb-6 text-sm text-muted-foreground">
              Sua estética está quase pronta. Vamos configurar o básico em 2 passos rápidos para você começar a usar hoje mesmo.
            </p>
            <div className="mb-6 space-y-3 text-left">
              {[
                { icon: Wrench, label: 'Cadastrar seu primeiro serviço' },
                { icon: CheckCircle2, label: 'Pronto para usar!' },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <item.icon className="h-4 w-4 text-primary" />
                  </div>
                  <p className="text-sm font-medium">{item.label}</p>
                </div>
              ))}
            </div>
            <button
              onClick={() => setStep(1)}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-semibold text-white hover:bg-primary/90"
            >
              Vamos lá
              <ChevronRight className="h-4 w-4" />
            </button>
            <button onClick={finish} className="mt-3 w-full text-sm text-muted-foreground hover:text-foreground">
              Pular por agora
            </button>
          </div>
        )}

        {/* Step 1 — Criar primeiro serviço */}
        {step === 1 && (
          <div className="p-6">
            <div className="mb-5">
              <h2 className="text-lg font-bold">Seu primeiro serviço</h2>
              <p className="text-sm text-muted-foreground">
                Cadastre um serviço para começar a criar agendamentos e ordens de serviço.
              </p>
            </div>
            <form onSubmit={handleSubmit((d) => serviceMutation.mutate(d))} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Nome do serviço *</label>
                <input
                  {...register('name', { required: 'Obrigatório' })}
                  placeholder="Ex: Lavagem completa"
                  className="w-full rounded-lg border border-input px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
                {errors.name && <p className="mt-1 text-xs text-destructive">{errors.name.message}</p>}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Categoria</label>
                <select
                  {...register('category')}
                  className="w-full rounded-lg border border-input px-3 py-2 text-sm outline-none focus:border-primary"
                >
                  {CATEGORY_OPTIONS.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium">Preço (R$) *</label>
                  <input
                    {...register('basePrice', { required: 'Obrigatório' })}
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0,00"
                    className="w-full rounded-lg border border-input px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                  {errors.basePrice && <p className="mt-1 text-xs text-destructive">{errors.basePrice.message}</p>}
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Duração (min)</label>
                  <input
                    {...register('estimatedMinutes')}
                    type="number"
                    min="5"
                    placeholder="60"
                    className="w-full rounded-lg border border-input px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>

              {serviceMutation.error && (
                <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  Erro ao criar serviço. Tente novamente.
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setStep(0)}
                  className="flex-1 rounded-lg border py-2 text-sm font-medium hover:bg-muted"
                >
                  Voltar
                </button>
                <button
                  type="submit"
                  disabled={serviceMutation.isPending}
                  className="flex-1 rounded-lg bg-primary py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60"
                >
                  {serviceMutation.isPending ? 'Criando...' : 'Criar serviço'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Step 2 — Concluído */}
        {step === 2 && (
          <div className="p-6 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <CheckCircle2 className="h-9 w-9 text-green-600" />
            </div>
            <h2 className="mb-2 text-xl font-bold">Tudo pronto!</h2>
            <p className="mb-6 text-sm text-muted-foreground">
              Seu primeiro serviço foi cadastrado. Agora você pode cadastrar clientes, criar agendamentos e gerar ordens de serviço.
            </p>
            <div className="mb-6 space-y-2 text-left">
              {[
                'Cadastre seus clientes e veículos',
                'Agende atendimentos pela Agenda',
                'Converta agendamentos em OS com 1 clique',
                'Acompanhe pagamentos e relatórios',
              ].map((tip, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
                  {tip}
                </div>
              ))}
            </div>
            <button
              onClick={finish}
              className="w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-white hover:bg-primary/90"
            >
              Começar a usar
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export function useOnboarding(hasServices: boolean) {
  const done = localStorage.getItem(ONBOARDING_KEY) === '1'
  return !done && !hasServices
}
