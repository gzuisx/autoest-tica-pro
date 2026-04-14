import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { Car, ArrowLeft } from 'lucide-react'
import api from '../services/api'

interface ForgotForm {
  slug: string
  email: string
}

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false)
  const [devUrl, setDevUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { register, handleSubmit, formState: { errors } } = useForm<ForgotForm>()

  async function onSubmit(data: ForgotForm) {
    try {
      setLoading(true)
      setError('')
      const res = await api.post('/auth/forgot-password', data)
      setSent(true)
      if (res.data.devResetUrl) setDevUrl(res.data.devResetUrl)
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Erro ao processar solicitação')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary shadow-lg">
            <Car className="h-8 w-8 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">AutoEstética Pro</h1>
            <p className="text-slate-400">Recuperação de senha</p>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-8 shadow-xl">
          {sent ? (
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
                <svg className="h-7 w-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="mb-2 text-lg font-semibold">Solicitação enviada!</h2>
              <p className="mb-6 text-sm text-muted-foreground">
                Se o e-mail existir em nossa base, você receberá um link para redefinir sua senha.
              </p>

              {devUrl && (
                <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-3 text-left">
                  <p className="mb-1 text-xs font-semibold text-amber-700">Modo desenvolvimento — link de reset:</p>
                  <a
                    href={devUrl}
                    className="break-all text-xs text-primary underline"
                  >
                    {devUrl}
                  </a>
                </div>
              )}

              <Link
                to="/login"
                className="flex items-center justify-center gap-2 text-sm font-medium text-primary hover:underline"
              >
                <ArrowLeft className="h-4 w-4" />
                Voltar para o login
              </Link>
            </div>
          ) : (
            <>
              <p className="mb-6 text-sm text-muted-foreground">
                Informe o identificador da sua estética e o e-mail cadastrado. Você receberá um link para criar uma nova senha.
              </p>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Identificador da estética</label>
                  <input
                    {...register('slug', { required: 'Obrigatório' })}
                    placeholder="minha-estetica"
                    className="w-full rounded-lg border border-input px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                  {errors.slug && <p className="mt-1 text-xs text-destructive">{errors.slug.message}</p>}
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium">E-mail</label>
                  <input
                    {...register('email', { required: 'Obrigatório' })}
                    type="email"
                    placeholder="seu@email.com"
                    className="w-full rounded-lg border border-input px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                  {errors.email && <p className="mt-1 text-xs text-destructive">{errors.email.message}</p>}
                </div>

                {error && (
                  <div className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60"
                >
                  {loading ? 'Enviando...' : 'Enviar link de recuperação'}
                </button>
              </form>

              <div className="mt-6 text-center">
                <Link
                  to="/login"
                  className="flex items-center justify-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Voltar para o login
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
