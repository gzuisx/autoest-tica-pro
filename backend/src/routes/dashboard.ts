import { Router } from 'express';
import { prisma } from '../utils/prisma';
import { authenticate } from '../middleware/auth';

export const dashboardRouter = Router();
dashboardRouter.use(authenticate);

// GET /api/dashboard
dashboardRouter.get('/', async (req, res) => {
  const tenantId = req.user!.tenantId;
  const now = new Date();

  // Períodos
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now); todayEnd.setHours(23, 59, 59, 999);

  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const thirtyDaysAgoForChart = new Date(now);
  thirtyDaysAgoForChart.setDate(thirtyDaysAgoForChart.getDate() - 29);
  thirtyDaysAgoForChart.setHours(0, 0, 0, 0);

  // Projeção: dias passados no mês atual
  const dayOfMonth = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

  const [
    todaySchedules,
    inProgressOrders,
    newClientsThisWeek,
    todayRevenue,
    weekRevenue,
    monthRevenue,
    prevMonthRevenue,
    upcomingReturns,
    topServices,
    recentOrders,
    dailyPayments,
    totalClients,
    openOrders,
    // Ticket médio: OS concluídas no mês
    monthCompletedOrders,
    // Receita pendente (OS abertas com valor)
    pendingOrders,
    // Top clientes por receita (todos os tempos)
    topClientsPayments,
  ] = await Promise.all([
    // Agendamentos de hoje
    prisma.schedule.findMany({
      where: { tenantId, dateTime: { gte: todayStart, lte: todayEnd } },
      include: {
        client: { select: { name: true } },
        vehicle: { select: { brand: true, model: true, plate: true } },
        services: { include: { service: { select: { name: true } } } },
      },
      orderBy: { dateTime: 'asc' },
    }),

    // OS em andamento
    prisma.serviceOrder.count({ where: { tenantId, status: 'in_progress' } }),

    // Novos clientes esta semana
    prisma.client.count({ where: { tenantId, createdAt: { gte: weekStart } } }),

    // Faturamento hoje
    prisma.payment.aggregate({
      where: { tenantId, paidAt: { gte: todayStart, lte: todayEnd } },
      _sum: { amount: true },
    }),

    // Faturamento semana
    prisma.payment.aggregate({
      where: { tenantId, paidAt: { gte: weekStart } },
      _sum: { amount: true },
    }),

    // Faturamento mês atual
    prisma.payment.aggregate({
      where: { tenantId, paidAt: { gte: monthStart, lte: monthEnd } },
      _sum: { amount: true },
    }),

    // Faturamento mês anterior
    prisma.payment.aggregate({
      where: { tenantId, paidAt: { gte: prevMonthStart, lte: prevMonthEnd } },
      _sum: { amount: true },
    }),

    // Clientes para retorno (última OS há mais de 30 dias)
    prisma.client.findMany({
      where: {
        tenantId,
        serviceOrders: {
          some: { completedAt: { lt: thirtyDaysAgo }, status: 'completed' },
          none: { completedAt: { gte: thirtyDaysAgo } },
        },
        acceptsPromo: true,
      },
      take: 10,
      select: {
        id: true, name: true, phone: true, whatsapp: true,
        serviceOrders: {
          where: { status: 'completed' },
          orderBy: { completedAt: 'desc' },
          take: 1,
          select: { completedAt: true },
        },
      },
    }),

    // Serviços mais vendidos no mês
    prisma.scheduleService.groupBy({
      by: ['serviceId'],
      where: {
        schedule: {
          tenantId,
          dateTime: { gte: monthStart, lte: monthEnd },
          status: 'completed',
        },
      },
      _count: { serviceId: true },
      orderBy: { _count: { serviceId: 'desc' } },
      take: 5,
    }),

    // Últimas OS
    prisma.serviceOrder.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: {
        client: { select: { name: true } },
        vehicle: { select: { brand: true, model: true } },
        payments: { select: { amount: true } },
      },
    }),

    // Pagamentos diários últimos 30 dias
    prisma.payment.findMany({
      where: { tenantId, paidAt: { gte: thirtyDaysAgoForChart } },
      select: { amount: true, paidAt: true },
    }),

    // Total de clientes ativos
    prisma.client.count({ where: { tenantId } }),

    // OS abertas
    prisma.serviceOrder.count({ where: { tenantId, status: { in: ['open', 'in_progress'] } } }),

    // OS concluídas no mês (para ticket médio)
    prisma.serviceOrder.aggregate({
      where: { tenantId, status: 'completed', completedAt: { gte: monthStart, lte: monthEnd } },
      _count: { id: true },
      _sum: { finalValue: true },
    }),

    // Receita pendente (OS abertas)
    prisma.serviceOrder.findMany({
      where: { tenantId, status: { in: ['open', 'in_progress'] } },
      select: {
        finalValue: true,
        payments: { select: { amount: true } },
      },
    }),

    // Pagamentos por cliente (top clientes)
    prisma.payment.groupBy({
      by: ['serviceOrderId'],
      where: { tenantId },
      _sum: { amount: true },
    }),
  ]);

  // Montar gráfico de faturamento últimos 30 dias
  const revenueByDay: Record<string, number> = {};
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split('T')[0];
    revenueByDay[key] = 0;
  }
  for (const p of dailyPayments) {
    const key = new Date(p.paidAt).toISOString().split('T')[0];
    if (key in revenueByDay) revenueByDay[key] += p.amount;
  }
  const revenueChart = Object.entries(revenueByDay).map(([date, value]) => ({
    date,
    label: new Date(date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
    value,
  }));

  // Enriquecer topServices com nomes
  const serviceIds = topServices.map((s) => s.serviceId);
  const serviceDetails = await prisma.service.findMany({
    where: { id: { in: serviceIds } },
    select: { id: true, name: true },
  });
  const enrichedTopServices = topServices.map((ts) => ({
    service: serviceDetails.find((s) => s.id === ts.serviceId),
    count: ts._count.serviceId,
  }));

  // Ticket médio do mês
  const monthOrderCount = monthCompletedOrders._count.id ?? 0;
  const monthOrderRevenue = monthCompletedOrders._sum.finalValue ?? 0;
  const avgTicket = monthOrderCount > 0 ? monthOrderRevenue / monthOrderCount : 0;

  // Comparativo com mês anterior
  const currentMonthRevenue = monthRevenue._sum.amount ?? 0;
  const lastMonthRevenue = prevMonthRevenue._sum.amount ?? 0;
  const monthGrowth = lastMonthRevenue > 0
    ? ((currentMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100
    : null;

  // Projeção do mês
  const monthProjection = dayOfMonth > 0
    ? (currentMonthRevenue / dayOfMonth) * daysInMonth
    : 0;

  // Receita pendente
  const pendingRevenue = pendingOrders.reduce((acc, os) => {
    const paid = os.payments.reduce((a, p) => a + p.amount, 0);
    const remaining = (os.finalValue ?? 0) - paid;
    return acc + Math.max(0, remaining);
  }, 0);

  // Top clientes: juntar pagamentos com dados do cliente
  const orderIds = topClientsPayments.map((p) => p.serviceOrderId).filter(Boolean) as string[];
  const ordersWithClients = await prisma.serviceOrder.findMany({
    where: { id: { in: orderIds }, tenantId },
    select: {
      id: true,
      clientId: true,
      client: { select: { id: true, name: true, phone: true, whatsapp: true } },
    },
  });

  const clientRevenueMap: Record<string, { client: any; total: number; orderCount: number }> = {};
  for (const p of topClientsPayments) {
    if (!p.serviceOrderId) continue;
    const order = ordersWithClients.find((o) => o.id === p.serviceOrderId);
    if (!order?.client) continue;
    const clientId = order.client.id;
    if (!clientRevenueMap[clientId]) {
      clientRevenueMap[clientId] = { client: order.client, total: 0, orderCount: 0 };
    }
    clientRevenueMap[clientId].total += p._sum.amount ?? 0;
    clientRevenueMap[clientId].orderCount += 1;
  }

  const topClients = Object.values(clientRevenueMap)
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  res.json({
    today: {
      schedules: todaySchedules,
      inProgressOrders,
      revenue: todayRevenue._sum.amount ?? 0,
    },
    week: {
      newClients: newClientsThisWeek,
      revenue: weekRevenue._sum.amount ?? 0,
    },
    month: {
      revenue: currentMonthRevenue,
      prevRevenue: lastMonthRevenue,
      growth: monthGrowth,
      avgTicket,
      completedOrders: monthOrderCount,
      projection: monthProjection,
      topServices: enrichedTopServices,
    },
    pendingRevenue,
    upcomingReturns,
    recentOrders,
    revenueChart,
    totalClients,
    openOrders,
    topClients,
  });
});
