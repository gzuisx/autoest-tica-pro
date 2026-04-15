import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  DollarSign,
  Users,
  Calendar,
  TrendingUp,
  TrendingDown,
  Clock,
  Car,
  ClipboardList,
  Target,
  AlertCircle,
  Crown,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'
import api from '../services/api'
import { formatCurrency, STATUS_LABELS, STATUS_COLORS, cn } from '../lib/utils'
import { OnboardingWizard, useOnboarding } from '../components/OnboardingWizard'

function GrowthBadge({ value }: { value: number | null }) {
  if (value === null) return null
  const positive = value >= 0
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold',
        positive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600',
      )}
    >
      {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {positive ? '+' : ''}{value.toFixed(1)}%
    </span>
  )
}

function MetricCard({
  label,
  value,
  icon: Icon,
  color,
  sub,
  growth,
  highlight,
}: {
  label: string
  value: string | number
  icon: any
  color: string
  sub?: string
  growth?: number | null
  highlight?: boolean
}) {
  return (
    <div className={cn('rounded-xl border bg-card p-4 shadow-sm', highlight && 'ring-2 ring-primary/20')}>
      <div className="mb-3 flex items-start justify-between">
        <div className={cn('inline-flex rounded-lg p-2', color)}>
          <Icon className="h-5 w-5" />
        </div>
        {growth !== undefined && <GrowthBadge value={growth ?? null} />}
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
      {sub && <p className="mt-1 text-xs font-medium text-primary">{sub}</p>}
    </div>
  )
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload?.length) {
    return (
      <div className="rounded-lg border bg-white px-3 py-2 shadow-md text-xs">
        <p className="font-medium text-muted-foreground mb-1">{label}</p>
        <p className="font-bold text-primary">{formatCurrency(payload[0].value)}</p>
      </div>
    )
  }
  return null
}

export default function DashboardPage() {
  const [showOnboarding, setShowOnboarding] = useState(true)

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.get('/dashboard').then((r) => r.data),
    refetchInterval: 60_000,
  })

  const { data: servicesData } = useQuery({
    queryKey: ['services'],
    queryFn: () => api.get('/services').then((r) => r.data),
  })

  const hasServices = Array.isArray(servicesData) ? servicesData.length > 0 : true
  const needsOnboarding = useOnboarding(hasServices)

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  const monthRevenue = data?.month?.revenue ?? 0
  const monthProjection = data?.month?.projection ?? 0
  const projectionPct = monthProjection > 0 ? Math.min(Math.round((monthRevenue / monthProjection) * 100), 100) : 0

  return (
    <div className="space-y-6">
      {needsOnboarding && showOnboarding && (
        <OnboardingWizard onDone={() => setShowOnboarding(false)} />
      )}

      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>

      {/* Cards principais */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard
          label="Faturamento hoje"
          value={formatCurrency(data?.today?.revenue ?? 0)}
          icon={DollarSign}
          color="bg-green-100 text-green-700"
        />
        <MetricCard
          label="Faturamento semana"
          value={formatCurrency(data?.week?.revenue ?? 0)}
          icon={TrendingUp}
          color="bg-blue-100 text-blue-700"
        />
        <MetricCard
          label="Faturamento mês"
          value={formatCurrency(monthRevenue)}
          icon={TrendingUp}
          color="bg-purple-100 text-purple-700"
          growth={data?.month?.growth ?? null}
          sub={data?.month?.prevRevenue > 0 ? `Mês anterior: ${formatCurrency(data.month.prevRevenue)}` : undefined}
        />
        <MetricCard
          label="Ticket médio (mês)"
          value={formatCurrency(data?.month?.avgTicket ?? 0)}
          icon={Target}
          color="bg-indigo-100 text-indigo-700"
          sub={`${data?.month?.completedOrders ?? 0} OS concluídas`}
          highlight
        />
      </div>

      {/* Segunda linha de cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard
          label="Agendamentos hoje"
          value={data?.today?.schedules?.length ?? 0}
          icon={Calendar}
          color="bg-sky-100 text-sky-700"
        />
        <MetricCard
          label="OS em andamento"
          value={data?.today?.inProgressOrders ?? 0}
          icon={Clock}
          color="bg-yellow-100 text-yellow-700"
        />
        <MetricCard
          label="Total de clientes"
          value={data?.totalClients ?? 0}
          icon={Users}
          color="bg-teal-100 text-teal-700"
          sub={`+${data?.week?.newClients ?? 0} esta semana`}
        />
        <div className="rounded-xl border bg-card p-4 shadow-sm ring-2 ring-orange-200">
          <div className="mb-3 flex items-start justify-between">
            <div className="inline-flex rounded-lg p-2 bg-orange-100 text-orange-700">
              <AlertCircle className="h-5 w-5" />
            </div>
          </div>
          <p className="text-2xl font-bold text-foreground">{formatCurrency(data?.pendingRevenue ?? 0)}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Receita pendente</p>
          <p className="mt-1 text-xs font-medium text-orange-600">{data?.openOrders ?? 0} OS em aberto</p>
        </div>
      </div>

      {/* Projeção do mês */}
      {monthProjection > 0 && (
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div>
              <h2 className="font-semibold text-foreground">Projeção do mês</h2>
              <p className="text-xs text-muted-foreground">Baseada no ritmo atual de faturamento</p>
            </div>
            <div className="text-right">
              <p className="text-xl font-bold text-primary">{formatCurrency(monthProjection)}</p>
              <p className="text-xs text-muted-foreground">estimativa final</p>
            </div>
          </div>
          <div className="h-3 rounded-full bg-muted overflow-hidden">
            <div
              className="h-3 rounded-full bg-primary transition-all duration-500"
              style={{ width: `${projectionPct}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
            <span>{formatCurrency(monthRevenue)} realizado</span>
            <span>{projectionPct}% do mês</span>
          </div>
        </div>
      )}

      {/* Gráfico de faturamento */}
      {data?.revenueChart && (
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <h2 className="mb-1 font-semibold text-foreground">Faturamento — últimos 30 dias</h2>
          <p className="mb-4 text-xs text-muted-foreground">
            Total:{' '}
            <span className="font-bold text-primary">
              {formatCurrency(data.revenueChart.reduce((a: number, d: any) => a + d.value, 0))}
            </span>
          </p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data.revenueChart} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: '#9ca3af' }}
                tickLine={false}
                axisLine={false}
                interval={4}
              />
              <YAxis
                tick={{ fontSize: 10, fill: '#9ca3af' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
              <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={32} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Agendamentos de hoje */}
        <div className="lg:col-span-2 rounded-xl border bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            <h2 className="font-semibold text-foreground">Agendamentos de hoje</h2>
            <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              {data?.today?.schedules?.length ?? 0}
            </span>
          </div>
          {data?.today?.schedules?.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Nenhum agendamento para hoje</p>
          ) : (
            <div className="space-y-2">
              {data?.today?.schedules?.map((s: any) => (
                <div key={s.id} className="flex items-start gap-3 rounded-lg bg-muted/50 p-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <Car className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm text-foreground">{s.client?.name}</p>
                      <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', STATUS_COLORS[s.status])}>
                        {STATUS_LABELS[s.status]}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {s.vehicle?.brand} {s.vehicle?.model} {s.vehicle?.plate && `• ${s.vehicle.plate}`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(s.dateTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      {' — '}
                      {s.services?.map((sv: any) => sv.service?.name).join(', ')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top Clientes */}
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Crown className="h-5 w-5 text-yellow-500" />
            <h2 className="font-semibold text-foreground">Top clientes</h2>
          </div>
          {!data?.topClients?.length ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Nenhum dado ainda</p>
          ) : (
            <div className="space-y-2">
              {data.topClients.map((tc: any, i: number) => {
                const waNumber = (tc.client?.whatsapp || tc.client?.phone || '').replace(/\D/g, '')
                const msg = encodeURIComponent(`Olá, ${tc.client?.name}! Obrigado pela fidelidade. 🚗✨`)
                return (
                  <div key={tc.client?.id} className="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
                    <span
                      className={cn(
                        'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                        i === 0 ? 'bg-yellow-400 text-yellow-900' :
                        i === 1 ? 'bg-slate-300 text-slate-700' :
                        i === 2 ? 'bg-orange-300 text-orange-800' :
                        'bg-muted text-muted-foreground',
                      )}
                    >
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{tc.client?.name}</p>
                      <p className="text-xs text-muted-foreground">{tc.orderCount} OS</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-primary">{formatCurrency(tc.total)}</p>
                      {waNumber && (
                        <a
                          href={`https://wa.me/55${waNumber}?text=${msg}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-green-600 hover:underline"
                        >
                          WA
                        </a>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Últimas OS */}
        <div className="lg:col-span-2 rounded-xl border bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" />
            <h2 className="font-semibold text-foreground">Últimas ordens de serviço</h2>
          </div>
          {!data?.recentOrders?.length ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma OS encontrada</p>
          ) : (
            <div className="space-y-2">
              {data.recentOrders.map((o: any) => {
                const paid = o.payments?.reduce((a: number, p: any) => a + p.amount, 0) ?? 0
                const isPaid = paid >= (o.finalValue ?? 0)
                return (
                  <div key={o.id} className="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-foreground">#{o.number} — {o.client?.name}</p>
                        <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', STATUS_COLORS[o.status])}>
                          {STATUS_LABELS[o.status]}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {o.vehicle?.brand} {o.vehicle?.model}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-foreground">{formatCurrency(o.finalValue ?? 0)}</p>
                      <p className={cn('text-xs font-medium', isPaid ? 'text-green-600' : 'text-orange-500')}>
                        {isPaid ? 'Pago' : `Em aberto: ${formatCurrency((o.finalValue ?? 0) - paid)}`}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Clientes para reativar */}
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <h2 className="mb-4 font-semibold text-foreground">Clientes para reativar</h2>
          {!data?.upcomingReturns?.length ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Nenhum cliente para reativar</p>
          ) : (
            <div className="space-y-2">
              {data.upcomingReturns.slice(0, 6).map((c: any) => {
                const lastVisit = c.serviceOrders?.[0]?.completedAt
                const days = lastVisit
                  ? Math.floor((Date.now() - new Date(lastVisit).getTime()) / (1000 * 60 * 60 * 24))
                  : null
                const waNumber = (c.whatsapp || c.phone || '').replace(/\D/g, '')
                const msg = encodeURIComponent(
                  `Olá, ${c.name}! Faz ${days} dias desde sua última visita. Que tal agendar? 🚗✨`,
                )
                return (
                  <div key={c.id} className="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-100 text-xs font-bold text-orange-700">
                      {c.name.charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{c.name}</p>
                      <p className="text-xs text-muted-foreground">{days ? `${days} dias sem visita` : 'Sem visitas'}</p>
                    </div>
                    {waNumber && (
                      <a
                        href={`https://wa.me/55${waNumber}?text=${msg}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 rounded-lg bg-green-500 px-2 py-1 text-xs font-medium text-white hover:bg-green-600"
                      >
                        WA
                      </a>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Serviços mais vendidos */}
      {data?.month?.topServices?.length > 0 && (
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <h2 className="mb-4 font-semibold text-foreground">Serviços mais vendidos no mês</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {data.month.topServices.map((ts: any, i: number) => (
              <div key={ts.service?.id} className="flex flex-col items-center rounded-lg bg-muted/50 p-3 text-center">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-white mb-2">
                  {i + 1}
                </span>
                <p className="text-xs font-medium text-foreground leading-tight">{ts.service?.name}</p>
                <span className="mt-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
                  {ts.count}x
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
