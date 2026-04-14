import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, PieChart, Pie, Cell, Legend,
} from 'recharts'
import { TrendingUp, DollarSign, ClipboardList, BarChart2, Download } from 'lucide-react'
import api from '../services/api'
import { formatCurrency, PAYMENT_METHOD_LABELS, cn } from '../lib/utils'

const COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']

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

function MetricCard({ label, value, icon: Icon, color, sub }: any) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className={cn('mb-3 inline-flex rounded-lg p-2', color)}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
      {sub && <p className="mt-1 text-xs font-medium text-muted-foreground">{sub}</p>}
    </div>
  )
}

function exportCSV(payments: any[], startDate: string, endDate: string) {
  const header = ['Data', 'Cliente', 'OS', 'Forma de Pagamento', 'Parcelas', 'Valor']
  const rows = payments.map((p: any) => [
    new Date(p.paidAt).toLocaleDateString('pt-BR'),
    `"${p.serviceOrder?.client?.name ?? ''}"`,
    `#${p.serviceOrder?.number ?? ''}`,
    PAYMENT_METHOD_LABELS[p.method] ?? p.method,
    p.installments && p.installments > 1 ? `${p.installments}x` : '1x',
    formatCurrency(p.amount).replace('R$\u00a0', '').replace('.', '').replace(',', '.'),
  ])
  const csv = [header, ...rows].map((r) => r.join(';')).join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `extrato_${startDate}_${endDate}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

const MONTHS = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
]

export default function ReportsPage() {
  const now = new Date()
  const [startDate, setStartDate] = useState(
    new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0],
  )
  const [endDate, setEndDate] = useState(
    new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0],
  )
  const [selMonth, setSelMonth] = useState(now.getMonth())
  const [selYear, setSelYear] = useState(now.getFullYear())

  const years = useMemo(() => {
    const y = []
    for (let i = now.getFullYear(); i >= now.getFullYear() - 5; i--) y.push(i)
    return y
  }, [])

  const { data, isLoading } = useQuery({
    queryKey: ['reports-financial', startDate, endDate],
    queryFn: () =>
      api.get('/reports/financial', { params: { start: startDate, end: endDate } }).then((r) => r.data),
  })

  const pieData = (data?.paymentMethods ?? []).map((m: any) => ({
    name: PAYMENT_METHOD_LABELS[m.method] ?? m.method,
    value: m._sum.amount ?? 0,
    count: m._count.method,
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Relatórios</h1>
        <p className="text-sm text-muted-foreground">Análise financeira do seu negócio</p>
      </div>

      {/* Filtro de período */}
      <div className="rounded-xl border bg-card p-4 shadow-sm space-y-4">
        {/* Atalhos rápidos */}
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">Atalhos</p>
          <div className="flex flex-wrap gap-2">
            {[
              { label: 'Esta semana', fn: () => {
                const d = new Date(now)
                const day = d.getDay()
                const mon = new Date(d); mon.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
                const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
                setStartDate(mon.toISOString().split('T')[0])
                setEndDate(sun.toISOString().split('T')[0])
              }},
              { label: 'Este mês', fn: () => {
                setStartDate(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0])
                setEndDate(new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0])
              }},
              { label: 'Mês anterior', fn: () => {
                setStartDate(new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0])
                setEndDate(new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0])
              }},
              { label: 'Este ano', fn: () => {
                setStartDate(new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0])
                setEndDate(new Date(now.getFullYear(), 11, 31).toISOString().split('T')[0])
              }},
            ].map((s) => (
              <button key={s.label} onClick={s.fn} className="rounded-full border px-3 py-1 text-xs font-medium hover:bg-muted">
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Seletor mês + ano */}
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">Mês / Ano específico</p>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selMonth}
              onChange={(e) => setSelMonth(Number(e.target.value))}
              className="rounded-lg border border-input px-3 py-2 text-sm outline-none focus:border-primary"
            >
              {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
            </select>
            <select
              value={selYear}
              onChange={(e) => setSelYear(Number(e.target.value))}
              className="rounded-lg border border-input px-3 py-2 text-sm outline-none focus:border-primary"
            >
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            <button
              onClick={() => {
                setStartDate(new Date(selYear, selMonth, 1).toISOString().split('T')[0])
                setEndDate(new Date(selYear, selMonth + 1, 0).toISOString().split('T')[0])
              }}
              className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white hover:bg-primary/90"
            >
              Aplicar
            </button>
          </div>
        </div>

        {/* Período personalizado */}
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">Período personalizado</p>
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="rounded-lg border border-input px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            <span className="text-sm text-muted-foreground">até</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="rounded-lg border border-input px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>

        <div className="border-t pt-2 text-xs text-muted-foreground">
          Exibindo: <span className="font-medium text-foreground">
            {new Date(startDate + 'T00:00:00').toLocaleDateString('pt-BR')} até {new Date(endDate + 'T00:00:00').toLocaleDateString('pt-BR')}
          </span>
        </div>
      </div>

      {isLoading ? (
        <div className="flex h-40 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : (
        <>
          {/* Cards resumo */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <MetricCard label="Faturamento total" value={formatCurrency(data?.summary?.totalRevenue ?? 0)} icon={DollarSign} color="bg-green-100 text-green-700" />
            <MetricCard label="OS concluídas" value={data?.summary?.totalOrders ?? 0} icon={ClipboardList} color="bg-blue-100 text-blue-700" />
            <MetricCard label="Ticket médio" value={formatCurrency(data?.summary?.avgTicket ?? 0)} icon={TrendingUp} color="bg-purple-100 text-purple-700" />
            <MetricCard label="Pagamentos registrados" value={data?.summary?.totalPayments ?? 0} icon={BarChart2} color="bg-orange-100 text-orange-700" />
          </div>

          {/* Gráfico faturamento por dia */}
          {data?.dailyRevenue && (
            <div className="rounded-xl border bg-card p-5 shadow-sm">
              <h2 className="mb-4 font-semibold text-foreground">Faturamento por dia</h2>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data.dailyRevenue} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} interval={Math.floor(data.dailyRevenue.length / 10)} />
                  <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={32} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Serviços mais faturados */}
            <div className="rounded-xl border bg-card p-5 shadow-sm">
              <h2 className="mb-4 font-semibold text-foreground">Serviços mais faturados</h2>
              {!data?.topServices?.length ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Nenhum serviço concluído no período</p>
              ) : (
                <div className="space-y-3">
                  {data.topServices.map((ts: any, i: number) => {
                    const maxTotal = data.topServices[0]?.total ?? 1
                    const pct = Math.round((ts.total / maxTotal) * 100)
                    return (
                      <div key={ts.service?.id ?? i}>
                        <div className="mb-1 flex items-center justify-between text-sm">
                          <span className="font-medium text-foreground truncate max-w-[60%]">{ts.service?.name}</span>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className="text-xs text-muted-foreground">{ts.count}x</span>
                            <span className="font-bold text-primary">{formatCurrency(ts.total)}</span>
                          </div>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted">
                          <div className="h-1.5 rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Formas de pagamento */}
            <div className="rounded-xl border bg-card p-5 shadow-sm">
              <h2 className="mb-4 font-semibold text-foreground">Formas de pagamento</h2>
              {!pieData.length ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Nenhum pagamento no período</p>
              ) : (
                <div className="flex flex-col items-center">
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                        {pieData.map((_: any, index: number) => (
                          <Cell key={index} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Legend formatter={(value) => <span className="text-xs text-foreground">{value}</span>} />
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="mt-2 w-full space-y-1">
                    {pieData.map((m: any, i: number) => (
                      <div key={i} className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-1.5">
                        <div className="flex items-center gap-2">
                          <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                          <span className="text-sm font-medium text-foreground">{m.name}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-muted-foreground">{m.count}x</span>
                          <span className="text-sm font-bold text-foreground">{formatCurrency(m.value)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Extrato de pagamentos — responsivo */}
          {data?.payments?.length > 0 && (
            <div className="rounded-xl border bg-card p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-2">
                <h2 className="font-semibold text-foreground">
                  Extrato de pagamentos ({data.payments.length})
                </h2>
                <button
                  onClick={() => exportCSV(data.payments, startDate, endDate)}
                  className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-muted"
                >
                  <Download className="h-3.5 w-3.5" />
                  Exportar CSV
                </button>
              </div>

              {/* Versão desktop: tabela */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="pb-2 pr-3 font-medium whitespace-nowrap">Data</th>
                      <th className="pb-2 pr-3 font-medium">Cliente</th>
                      <th className="pb-2 pr-3 font-medium whitespace-nowrap">OS</th>
                      <th className="pb-2 pr-3 font-medium whitespace-nowrap">Forma</th>
                      <th className="pb-2 text-right font-medium whitespace-nowrap">Valor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {data.payments.map((p: any) => (
                      <tr key={p.id}>
                        <td className="py-2 pr-3 text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(p.paidAt).toLocaleDateString('pt-BR')}
                        </td>
                        <td className="py-2 pr-3 font-medium text-foreground max-w-[180px]">
                          <span className="block truncate">{p.serviceOrder?.client?.name}</span>
                        </td>
                        <td className="py-2 pr-3 text-muted-foreground whitespace-nowrap">
                          #{p.serviceOrder?.number}
                        </td>
                        <td className="py-2 pr-3 text-muted-foreground whitespace-nowrap">
                          {PAYMENT_METHOD_LABELS[p.method] ?? p.method}
                          {p.installments && p.installments > 1 ? ` (${p.installments}x)` : ''}
                        </td>
                        <td className="py-2 text-right font-bold text-primary whitespace-nowrap">
                          {formatCurrency(p.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t">
                      <td colSpan={4} className="pt-2 text-sm font-semibold text-foreground">Total</td>
                      <td className="pt-2 text-right text-sm font-bold text-primary">
                        {formatCurrency(data.summary.totalRevenue)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Versão mobile: cards */}
              <div className="sm:hidden space-y-2">
                {data.payments.map((p: any) => (
                  <div key={p.id} className="rounded-lg border p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-foreground truncate">{p.serviceOrder?.client?.name}</p>
                        <p className="text-xs text-muted-foreground">
                          OS #{p.serviceOrder?.number} • {new Date(p.paidAt).toLocaleDateString('pt-BR')}
                        </p>
                        <span className="mt-1 inline-block rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                          {PAYMENT_METHOD_LABELS[p.method] ?? p.method}
                          {p.installments && p.installments > 1 ? ` ${p.installments}x` : ''}
                        </span>
                      </div>
                      <span className="shrink-0 font-bold text-primary">{formatCurrency(p.amount)}</span>
                    </div>
                  </div>
                ))}
                <div className="flex justify-between rounded-lg bg-muted/50 px-3 py-2">
                  <span className="text-sm font-semibold text-foreground">Total</span>
                  <span className="font-bold text-primary">{formatCurrency(data.summary.totalRevenue)}</span>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
