import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { Car, CheckCircle } from 'lucide-react'
import api from '../services/api'

interface RegisterForm {
  tenantName: string
  tenantSlug: string
  ownerName: string
  email: string
  password: string
  phone: string
}

const PLAN_LABELS: Record<string, string> = {
  basic: 'Basic (R$ 97/mês)',
  pro: 'Pro (R$ 197/mês)',
}

export default function RegisterPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const paymentSuccess = searchParams.get('payment') === 'success'
  const paidPlan = searchParams.get('plan') || ''
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<RegisterForm>()

  function generateSlug(name: string) {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim()
  }

  async function onSubmit(data: RegisterForm) {
    try {
      setLoading(true)
      setError('')
      const { data: result } = await api.post('/auth/register', data)
      // Backend returns pendingVerification — redirect to verify page
      if (result.pendingVerification) {
        navigate(`/verify-email?email=${encodeURIComponent(result.email)}`)
        return
      }
      navigate('/dashboard')
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Erro ao criar conta')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 px-4 py-8">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary shadow-lg">
            <Car className="h-8 w-8 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">AutoEstética Pro</h1>
            <p className="text-slate-400">Cadastre sua estética agora mesmo</p>
          </div>
        </div>

        {paymentSuccess && (
          <div className="mb-4 flex items-start gap-3 rounded-xl border border-green-300 bg-green-50 p-4">
            <CheckCircle className="h-5 w-5 shrink-0 text-green-600 mt-0.5" />
            <div>
              <p className="font-semibold text-green-800">Pagamento aprovado!</p>
              <p className="text-sm text-green-700">
                {paidPlan ? `Plano ${PLAN_LABELS[paidPlan] ?? paidPlan} ativo. ` : ''}
                Agora crie sua conta para acessar o sistema.
              </p>
            </div>
          </div>
        )}

        <div className="rounded-2xl bg-white p-8 shadow-xl">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Nome da estética</label>
              <input
                {...register('tenantName', { required: 'Obrigatório' })}
                placeholder="Estética Premium"
                onChange={(e) => {
                  register('tenantName').onChange(e)
                  setValue('tenantSlug', generateSlug(e.target.value))
                }}
                className="w-full rounded-lg border border-input px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
              {errors.tenantName && <p className="mt-1 text-xs text-destructive">{errors.tenantName.message}</p>}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">Identificador (URL)</label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">app.com/</span>
                <input
                  {...register('tenantSlug', { required: 'Obrigatório', pattern: { value: /^[a-z0-9-]+$/, message: 'Apenas letras minúsculas, números e -' } })}
                  placeholder="estetica-premium"
                  className="flex-1 rounded-lg border border-input px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
              {errors.tenantSlug && <p className="mt-1 text-xs text-destructive">{errors.tenantSlug.message}</p>}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">Seu nome</label>
              <input
                {...register('ownerName', { required: 'Obrigatório' })}
                placeholder="João Silva"
                className="w-full rounded-lg border border-input px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">WhatsApp</label>
              <input
                {...register('phone')}
                placeholder="(11) 99999-9999"
                className="w-full rounded-lg border border-input px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">E-mail</label>
              <input
                {...register('email', { required: 'Obrigatório' })}
                type="email"
                placeholder="seu@email.com"
                className="w-full rounded-lg border border-input px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">Senha</label>
              <input
                {...register('password', { required: 'Obrigatório', minLength: { value: 8, message: 'Mínimo 8 caracteres' } })}
                type="password"
                placeholder="Mínimo 8 caracteres"
                className="w-full rounded-lg border border-input px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
              {errors.password && <p className="mt-1 text-xs text-destructive">{errors.password.message}</p>}
            </div>

            {error && (
              <div className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60"
            >
              {loading ? 'Criando conta...' : 'Criar minha estética'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Já tem conta?{' '}
            <Link to="/login" className="font-medium text-primary hover:underline">Entrar</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
