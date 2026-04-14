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

  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Últimos 30 dias para gráfico
  const thirtyDaysAgoForChart = new Date(now);
  thirtyDaysAgoForChart.setDate(thirtyDaysAgoForChart.getDate() - 29);
  thirtyDaysAgoForChart.setHours(0, 0, 0, 0);

  const [
    todaySchedules,
    inProgressOrders,
    newClientsThisWeek,
    todayRevenue,
    weekRevenue,
    monthRevenue,
    upcomingReturns,
    topServices,
    recentOrders,
    dailyPayments,
    totalClients,
    openOrders,
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

    // Faturamento mês
    prisma.payment.aggregate({
      where: { tenantId, paidAt: { gte: monthStart, lte: monthEnd } },
      _sum: { amount: true },
    }),

    // Clientes para retorno (última OS há mais de 30 dias)
    prisma.client.findMany({
      where: {
        tenantId,
        serviceOrders: {
          some: {
            completedAt: { lt: thirtyDaysAgo },
            status: 'completed',
          },
          none: {
            completedAt: { gte: thirtyDaysAgo },
          },
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
      revenue: monthRevenue._sum.amount ?? 0,
      topServices: enrichedTopServices,
    },
    upcomingReturns,
    recentOrders,
    revenueChart,
    totalClients,
    openOrders,
  });
});
