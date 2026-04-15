import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Car, Mail } from 'lucide-react'
import api from '../services/api'
import { useAuth } from '../hooks/useAuth'

const RESEND_COOLDOWN = 60 // seconds

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams()
  const email = searchParams.get('email') || ''
  const navigate = useNavigate()
  const { setSession } = useAuth()

  const [digits, setDigits] = useState(['', '', '', '', '', ''])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  const [resendSuccess, setResendSuccess] = useState(false)

  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  // Start resend cooldown on mount (just registered)
  useEffect(() => {
    startCooldown()
  }, [])

  function startCooldown() {
    setResendCooldown(RESEND_COOLDOWN)
  }

  useEffect(() => {
    if (resendCooldown <= 0) return
    const timer = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) { clearInterval(timer); return 0 }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [resendCooldown])

  function handleDigitChange(index: number, value: string) {
    // Allow paste of full code
    if (value.length > 1) {
      const cleaned = value.replace(/\D/g, '').slice(0, 6)
      if (cleaned.length === 6) {
        const next = cleaned.split('')
        setDigits(next)
        inputRefs.current[5]?.focus()
        submitCode(next.join(''))
        return
      }
    }

    const digit = value.replace(/\D/g, '').slice(-1)
    const next = [...digits]
    next[index] = digit
    setDigits(next)

    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }

    if (next.every((d) => d !== '') && next.join('').length === 6) {
      submitCode(next.join(''))
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  async function submitCode(code: string) {
    if (code.length !== 6) return
    try {
      setLoading(true)
      setError('')
      const { data } = await api.post('/auth/verify-email', { email, code })
      setSession(data)
      navigate('/dashboard', { replace: true })
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Código inválido ou expirado.')
      setDigits(['', '', '', '', '', ''])
      setTimeout(() => inputRefs.current[0]?.focus(), 50)
    } finally {
      setLoading(false)
    }
  }

  async function handleResend() {
    if (resendCooldown > 0) return
    try {
      setResendSuccess(false)
      await api.post('/auth/resend-verification', { email })
      setResendSuccess(true)
      startCooldown()
    } catch {
      // generic — backend always returns 200
      setResendSuccess(true)
      startCooldown()
    }
  }

  const maskedEmail = email
    ? email.replace(/(.{2}).+(@.+)/, '$1****$2')
    : 'seu e-mail'

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
          </div>
        </div>

        <div className="rounded-2xl bg-white p-8 shadow-xl text-center">
          {/* Icon */}
          <div className="mb-4 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <Mail className="h-8 w-8 text-primary" />
            </div>
          </div>

          <h2 className="text-xl font-bold text-foreground mb-2">Verifique seu e-mail</h2>
          <p className="text-sm text-muted-foreground mb-8">
            Enviamos um código de 6 dígitos para{' '}
            <span className="font-medium text-foreground">{maskedEmail}</span>.
            <br />
            Digite-o abaixo para ativar sua conta.
          </p>

          {/* 6-digit input boxes */}
          <div className="flex justify-center gap-3 mb-6">
            {digits.map((digit, i) => (
              <input
                key={i}
                ref={(el) => { inputRefs.current[i] = el }}
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={digit}
                onChange={(e) => handleDigitChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                onFocus={(e) => e.target.select()}
                disabled={loading}
                className={`
                  h-14 w-11 rounded-xl border-2 text-center text-xl font-bold outline-none transition
                  ${digit ? 'border-primary bg-primary/5 text-primary' : 'border-input bg-background text-foreground'}
                  focus:border-primary focus:ring-2 focus:ring-primary/20
                  disabled:opacity-50
                `}
              />
            ))}
          </div>

          {error && (
            <div className="mb-4 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {resendSuccess && !error && (
            <div className="mb-4 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
              Novo código enviado! Verifique sua caixa de entrada.
            </div>
          )}

          {loading && (
            <div className="mb-4 flex justify-center">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          )}

          {/* Resend */}
          <div className="text-sm text-muted-foreground">
            Não recebeu o código?{' '}
            {resendCooldown > 0 ? (
              <span className="text-muted-foreground">
                Reenviar em <span className="font-medium text-foreground tabular-nums">{resendCooldown}s</span>
              </span>
            ) : (
              <button
                type="button"
                onClick={handleResend}
                className="font-medium text-primary hover:underline"
              >
                Reenviar código
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
