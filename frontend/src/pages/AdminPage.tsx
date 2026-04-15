import { useEffect, useState, useCallback } from 'react'
import { adminApi, adminLogin, adminLogout, isAdminLoggedIn } from '../services/adminApi'

// ─── Types ────────────────────────────────────────────────────────────────────

interface AdminStats {
  totalTenants: number
  premiumTenants: number
  basicTenants: number
  totalUsers: number
  newTenantsThisMonth: number
  conversionRate: string
  growthRate: string | null
}

interface ActivityItem {
  type: string
  label: string
  email: string
  tenantName: string
  plan?: string
  createdAt: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (minutes < 1) return 'Agora'
  if (minutes < 60) return `Há ${minutes} min`
  if (hours < 24) return `Há ${hours}h`
  return `Há ${days}d`
}

function labelColor(type: string): string {
  switch (type) {
    case 'new_registration': return 'text-emerald-400'
    case 'upgrade': return 'text-violet-400'
    case 'cancellation': return 'text-red-400'
    default: return 'text-sky-400'
  }
}

// ─── Login Screen ─────────────────────────────────────────────────────────────

function AdminLogin({ onLogin }: { onLogin: () => void }) {
  const [secret, setSecret] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await adminLogin(secret)
      onLogin()
    } catch {
      setError('Senha incorreta.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0d1117] flex items-center justify-center">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-violet-600 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-white">Painel Administrativo</h1>
          <p className="text-[#8b949e] text-sm mt-1">AutoEstética Pro — Sistema</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-[#161b22] border border-[#30363d] rounded-xl p-6 space-y-4">
          <div>
            <label className="block text-sm text-[#8b949e] mb-1.5">Senha de acesso</label>
            <input
              type="password"
              value={secret}
              onChange={e => setSecret(e.target.value)}
              placeholder="••••••••••••"
              className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
              required
            />
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg text-sm transition-colors"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  icon,
  iconBg,
  value,
  label,
  sub,
}: {
  icon: React.ReactNode
  iconBg: string
  value: string | number
  label: string
  sub?: string
}) {
  return (
    <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-5">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-lg ${iconBg} flex items-center justify-center`}>{icon}</div>
      </div>
      <div className="text-3xl font-bold text-white mb-1">
        {typeof value === 'number' ? value.toLocaleString('pt-BR') : value}
      </div>
      <div className="text-[#8b949e] text-sm">{label}</div>
      {sub && <div className="text-[#8b949e] text-xs mt-1">{sub}</div>}
    </div>
  )
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export function AdminPage() {
  const [loggedIn, setLoggedIn] = useState(isAdminLoggedIn())
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [statsRes, activityRes] = await Promise.all([
        adminApi.get('/stats'),
        adminApi.get('/activity?limit=20'),
      ])
      setStats(statsRes.data)
      setActivity(activityRes.data)
    } catch {
      adminLogout()
      setLoggedIn(false)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (loggedIn) fetchData()
  }, [loggedIn, fetchData])

  if (!loggedIn) {
    return <AdminLogin onLogin={() => setLoggedIn(true)} />
  }

  return (
    <div className="min-h-screen bg-[#0d1117] text-white">
      {/* Header */}
      <div className="border-b border-[#30363d] bg-[#161b22]">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold flex items-center gap-2">
              <svg className="w-5 h-5 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              Painel Administrativo
            </h1>
            <p className="text-[#8b949e] text-xs mt-0.5">AutoEstética Pro — Dashboard</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchData}
              disabled={loading}
              className="text-[#8b949e] hover:text-white transition-colors p-1.5 rounded-lg hover:bg-[#30363d]"
              title="Atualizar"
            >
              <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
            <button
              onClick={() => { adminLogout(); setLoggedIn(false) }}
              className="text-[#8b949e] hover:text-red-400 transition-colors text-sm"
            >
              Sair
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        {/* Stat Cards */}
        {stats ? (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <StatCard
              icon={
                <svg className="w-5 h-5 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              }
              iconBg="bg-sky-500/10"
              value={stats.totalTenants}
              label="Total de Estéticas"
              sub={stats.growthRate ? `${stats.growthRate} este mês` : `${stats.newTenantsThisMonth} este mês`}
            />
            <StatCard
              icon={
                <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
              }
              iconBg="bg-amber-500/10"
              value={stats.premiumTenants}
              label="Assinantes Premium"
              sub={`${stats.conversionRate} de conversão`}
            />
            <StatCard
              icon={
                <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              }
              iconBg="bg-emerald-500/10"
              value={stats.totalUsers}
              label="Total de Usuários"
              sub="Todos os planos"
            />
            <StatCard
              icon={
                <svg className="w-5 h-5 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              }
              iconBg="bg-violet-500/10"
              value={stats.basicTenants}
              label="Assinantes Basic"
              sub={`${stats.totalTenants - stats.premiumTenants - stats.basicTenants} sem plano`}
            />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-[#161b22] border border-[#30363d] rounded-xl p-5 animate-pulse">
                <div className="w-10 h-10 bg-[#30363d] rounded-lg mb-3" />
                <div className="h-8 bg-[#30363d] rounded w-2/3 mb-2" />
                <div className="h-3 bg-[#30363d] rounded w-1/2" />
              </div>
            ))}
          </div>
        )}

        {/* Atividade Recente */}
        <div className="bg-[#161b22] border border-[#30363d] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#30363d] flex items-center gap-2">
            <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span className="font-medium text-sm">Atividade Recente</span>
          </div>

          {activity.length === 0 && !loading ? (
            <div className="px-5 py-8 text-center text-[#8b949e] text-sm">
              Nenhuma atividade registrada ainda.
            </div>
          ) : (
            <div className="divide-y divide-[#30363d]">
              {activity.map((item, i) => (
                <div key={i} className="px-5 py-3.5 flex items-center justify-between hover:bg-[#1c2128] transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                      item.type === 'new_registration' ? 'bg-emerald-400' :
                      item.type === 'upgrade' ? 'bg-violet-400' :
                      item.type === 'cancellation' ? 'bg-red-400' : 'bg-sky-400'
                    }`} />
                    <div className="min-w-0">
                      <span className={`text-sm font-medium ${labelColor(item.type)}`}>{item.label}</span>
                      {item.type === 'new_registration' && item.plan && (
                        <span className={`ml-2 text-xs px-1.5 py-0.5 rounded font-medium ${
                          item.plan === 'pro'
                            ? 'bg-amber-500/15 text-amber-400'
                            : 'bg-sky-500/15 text-sky-400'
                        }`}>
                          {item.plan === 'pro' ? 'Premium' : 'Basic'}
                        </span>
                      )}
                      <div className="text-[#8b949e] text-xs truncate">{item.email}</div>
                    </div>
                  </div>
                  <span className="text-[#8b949e] text-xs flex-shrink-0 ml-4">{timeAgo(item.createdAt)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
