import { Router } from 'express';
import { prisma } from '../utils/prisma';
import { authenticate } from '../middleware/auth';

export const reportsRouter = Router();
reportsRouter.use(authenticate);

// GET /api/reports/financial?start=2024-01-01&end=2024-01-31
reportsRouter.get('/financial', async (req, res) => {
  const tenantId = req.user!.tenantId;
  const { start, end } = req.query;

  const startDate = start ? new Date(String(start)) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const endDate = end ? new Date(String(end) + 'T23:59:59') : new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0, 23, 59, 59);

  const [payments, serviceOrders, topServices, paymentMethods] = await Promise.all([
    // Todos os pagamentos no período
    prisma.payment.findMany({
      where: { tenantId, paidAt: { gte: startDate, lte: endDate } },
      include: {
        serviceOrder: {
          select: {
            number: true,
            client: { select: { name: true } },
            vehicle: { select: { brand: true, model: true } },
          },
        },
      },
      orderBy: { paidAt: 'desc' },
    }),

    // OS concluídas no período
    prisma.serviceOrder.findMany({
      where: {
        tenantId,
        status: 'completed',
        completedAt: { gte: startDate, lte: endDate },
      },
      select: { id: true, number: true, finalValue: true, completedAt: true },
    }),

    // Serviços mais faturados (via OS concluídas)
    prisma.scheduleService.groupBy({
      by: ['serviceId'],
      where: {
        schedule: {
          tenantId,
          status: 'completed',
          dateTime: { gte: startDate, lte: endDate },
        },
      },
      _count: { serviceId: true },
      _sum: { price: true },
      orderBy: { _sum: { price: 'desc' } },
      take: 10,
    }),

    // Métodos de pagamento
    prisma.payment.groupBy({
      by: ['method'],
      where: { tenantId, paidAt: { gte: startDate, lte: endDate } },
      _sum: { amount: true },
      _count: { method: true },
    }),
  ]);

  // Enriquecer topServices com nomes
  const serviceIds = topServices.map((s) => s.serviceId);
  const serviceDetails = await prisma.service.findMany({
    where: { id: { in: serviceIds } },
    select: { id: true, name: true },
  });

  const enrichedTopServices = topServices.map((ts) => ({
    service: serviceDetails.find((s) => s.id === ts.serviceId),
    count: ts._count.serviceId,
    total: ts._sum.price ?? 0,
  }));

  // Faturamento por dia
  const revenueByDay: Record<string, number> = {};
  const dayCount = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  for (let i = 0; i <= Math.min(dayCount, 90); i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    const key = d.toISOString().split('T')[0];
    revenueByDay[key] = 0;
  }
  for (const p of payments) {
    const key = new Date(p.paidAt).toISOString().split('T')[0];
    if (key in revenueByDay) revenueByDay[key] += p.amount;
  }
  const dailyRevenue = Object.entries(revenueByDay).map(([date, value]) => ({
    date,
    label: new Date(date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
    value,
  }));

  const totalRevenue = payments.reduce((acc, p) => acc + p.amount, 0);
  const totalOrders = serviceOrders.length;
  const avgTicket = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  res.json({
    summary: { totalRevenue, totalOrders, avgTicket, totalPayments: payments.length },
    payments,
    dailyRevenue,
    topServices: enrichedTopServices,
    paymentMethods,
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
  });
});
