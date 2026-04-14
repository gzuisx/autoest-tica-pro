import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  DollarSign,
  Users,
  Calendar,
  TrendingUp,
  Clock,
  Car,
  ClipboardList,
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

function MetricCard({
  label,
  value,
  icon: Icon,
  color,
  sub,
}: {
  label: string
  value: string | number
  icon: any
  color: string
  sub?: string
}) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className={cn('mb-3 inline-flex rounded-lg p-2', color)}>
        <Icon className="h-5 w-5" />
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

      {/* Cards de métricas */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 xl:grid-cols-7">
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
          value={formatCurrency(data?.month?.revenue ?? 0)}
          icon={TrendingUp}
          color="bg-purple-100 text-purple-700"
        />
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
          label="OS abertas"
          value={data?.openOrders ?? 0}
          icon={ClipboardList}
          color="bg-orange-100 text-orange-700"
        />
        <MetricCard
          label="Total de clientes"
          value={data?.totalClients ?? 0}
          icon={Users}
          color="bg-indigo-100 text-indigo-700"
          sub={`+${data?.week?.newClients ?? 0} esta semana`}
        />
      </div>

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
          <ResponsiveContainer width="100%" height={180}>
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
                const isPaid = paid >= o.finalValue
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
                      <p className="text-sm font-bold text-foreground">{formatCurrency(o.finalValue)}</p>
                      <p className={cn('text-xs font-medium', isPaid ? 'text-green-600' : 'text-orange-500')}>
                        {isPaid ? 'Pago' : `Em aberto: ${formatCurrency(o.finalValue - paid)}`}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Serviços mais vendidos */}
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <h2 className="mb-4 font-semibold text-foreground">Mais vendidos no mês</h2>
          {!data?.month?.topServices?.length ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Nenhum serviço concluído este mês</p>
          ) : (
            <div className="space-y-2">
              {data.month.topServices.map((ts: any, i: number) => (
                <div key={ts.service?.id} className="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
                    {i + 1}
                  </span>
                  <p className="flex-1 truncate text-sm font-medium text-foreground">{ts.service?.name}</p>
                  <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
                    {ts.count}x
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
