import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { Car, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'

interface LoginForm {
  slug: string
  email: string
  password: string
}

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>()

  async function onSubmit(data: LoginForm) {
    try {
      setLoading(true)
      setError('')
      await login(data.email, data.password, data.slug)
      navigate('/dashboard')
    } catch (err: any) {
      const responseData = err?.response?.data
      if (responseData?.pendingVerification) {
        navigate(`/verify-email?email=${encodeURIComponent(responseData.email || data.email)}`)
        return
      }
      setError(responseData?.error || 'Erro ao fazer login')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary shadow-lg">
            <Car className="h-8 w-8 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">AutoEstética Pro</h1>
            <p className="text-slate-400">Faça login para continuar</p>
          </div>
        </div>

        {/* Form */}
        <div className="rounded-2xl bg-white p-8 shadow-xl">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* Slug da estética */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                Identificador da estética
              </label>
              <input
                {...register('slug', { required: 'Obrigatório' })}
                placeholder="minha-estetica"
                className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
              {errors.slug && <p className="mt-1 text-xs text-destructive">{errors.slug.message}</p>}
            </div>

            {/* Email */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">E-mail</label>
              <input
                {...register('email', { required: 'Obrigatório' })}
                type="email"
                placeholder="seu@email.com"
                className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
              {errors.email && <p className="mt-1 text-xs text-destructive">{errors.email.message}</p>}
            </div>

            {/* Senha */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Senha</label>
              <div className="relative">
                <input
                  {...register('password', { required: 'Obrigatório' })}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2.5 pr-10 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && <p className="mt-1 text-xs text-destructive">{errors.password.message}</p>}
            </div>

            {error && (
              <div className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:opacity-60"
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>

          <div className="mt-6 space-y-3 text-center text-sm text-muted-foreground">
            <div>
              <Link to="/forgot-password" className="font-medium text-primary hover:underline">
                Esqueci minha senha
              </Link>
            </div>
            <div>
              Ainda não tem conta?{' '}
              <Link to="/register" className="font-medium text-primary hover:underline">
                Cadastre sua estética
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
