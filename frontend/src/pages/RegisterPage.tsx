import { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { Car, CheckCircle, Loader2, AlertCircle, KeyRound } from 'lucide-react'
import api from '../services/api'

interface RegisterForm {
  tenantName: string
  tenantSlug: string
  ownerName: string
  email: string
  password: string
  phone: string
  activationCode: string
}

const PLAN_LABELS: Record<string, string> = {
  basic: 'Basic (R$ 97/mês)',
  pro: 'Pro (R$ 197/mês)',
}

export default function RegisterPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  // Parâmetros de retorno do MP (sem token ainda)
  const paymentSuccess = searchParams.get('payment') === 'success'
  const paidPlan = searchParams.get('plan') || ''

  // Token/código de cadastro pós-pagamento (vindo da URL do e-mail ou digitado)
  const tokenFromUrl = searchParams.get('token') || ''

  const [tokenStatus, setTokenStatus] = useState<'idle' | 'loading' | 'valid' | 'invalid'>('idle')
  const [tokenPlan, setTokenPlan] = useState('')

  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<RegisterForm>({
    defaultValues: { activationCode: tokenFromUrl },
  })

  // Valida token da URL ao carregar a página
  useEffect(() => {
    if (!tokenFromUrl) return
    setTokenStatus('loading')
    api.get(`/auth/registration-token?token=${tokenFromUrl}`)
      .then(({ data }) => {
        setTokenStatus('valid')
        setTokenPlan(data.plan)
        setValue('email', data.email)
        setValue('activationCode', tokenFromUrl)
      })
      .catch(() => setTokenStatus('invalid'))
  }, [tokenFromUrl])

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
      const { activationCode, ...rest } = data
      const payload: any = { ...rest }
      const code = activationCode?.trim().toUpperCase()
      if (code) payload.registrationToken = code
      const { data: result } = await api.post('/auth/register', payload)
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

  const activationCodeValue = watch('activationCode')

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

        {/* Banner: validando token da URL */}
        {tokenStatus === 'loading' && (
          <div className="mb-4 flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4">
            <Loader2 className="h-5 w-5 shrink-0 animate-spin text-blue-600" />
            <p className="text-sm text-blue-700">Validando seu código de ativação...</p>
          </div>
        )}
        {tokenStatus === 'valid' && (
          <div className="mb-4 flex items-start gap-3 rounded-xl border border-green-300 bg-green-50 p-4">
            <CheckCircle className="h-5 w-5 shrink-0 text-green-600 mt-0.5" />
            <div>
              <p className="font-semibold text-green-800">Pagamento confirmado!</p>
              <p className="text-sm text-green-700">
                Plano <strong>{PLAN_LABELS[tokenPlan] ?? tokenPlan}</strong> será ativado automaticamente ao criar sua conta.
              </p>
            </div>
          </div>
        )}
        {tokenStatus === 'invalid' && (
          <div className="mb-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
            <AlertCircle className="h-5 w-5 shrink-0 text-red-600 mt-0.5" />
            <div>
              <p className="font-semibold text-red-800">Código inválido ou expirado</p>
              <p className="text-sm text-red-700">Este código de ativação não é mais válido. Entre em contato com o suporte.</p>
            </div>
          </div>
        )}

        {/* Banner: retorno direto do MP (aguardando e-mail com código) */}
        {paymentSuccess && !tokenFromUrl && (
          <div className="mb-4 flex items-start gap-3 rounded-xl border border-green-300 bg-green-50 p-4">
            <CheckCircle className="h-5 w-5 shrink-0 text-green-600 mt-0.5" />
            <div>
              <p className="font-semibold text-green-800">Pagamento aprovado!</p>
              <p className="text-sm text-green-700">
                {paidPlan ? `Plano ${PLAN_LABELS[paidPlan] ?? paidPlan}. ` : ''}
                Você receberá um <strong>código de ativação por e-mail</strong> em instantes. Digite-o abaixo ao preencher o cadastro.
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
                readOnly={tokenStatus === 'valid'}
                className="w-full rounded-lg border border-input px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 read-only:bg-muted"
              />
              {tokenStatus === 'valid' && (
                <p className="mt-1 text-xs text-muted-foreground">E-mail vinculado ao pagamento</p>
              )}
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

            {/* Código de ativação — sempre visível, obrigatório apenas se há pagamento */}
            <div className="rounded-lg border border-dashed border-primary/40 bg-primary/5 p-4">
              <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-primary">
                <KeyRound className="h-4 w-4" />
                Código de ativação
              </label>
              <input
                {...register('activationCode')}
                placeholder="Ex: XKAP92BM"
                readOnly={tokenStatus === 'valid'}
                onChange={(e) => {
                  register('activationCode').onChange(e)
                  setValue('activationCode', e.target.value.toUpperCase())
                }}
                className="mt-1 w-full rounded-lg border border-input bg-white px-3 py-2.5 text-sm font-mono tracking-widest outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 read-only:bg-muted uppercase"
              />
              <p className="mt-1.5 text-xs text-muted-foreground">
                {tokenStatus === 'valid'
                  ? 'Código validado — plano pago será ativado'
                  : paymentSuccess
                  ? 'Aguarde o e-mail com seu código e digite-o aqui'
                  : 'Recebeu um código por e-mail após o pagamento? Digite aqui para ativar seu plano.'
                }
              </p>
            </div>

            {error && (
              <div className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>
            )}

            <button
              type="submit"
              disabled={loading || tokenStatus === 'invalid'}
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
