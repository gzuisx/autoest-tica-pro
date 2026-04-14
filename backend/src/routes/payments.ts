import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { authenticate } from '../middleware/auth';

export const paymentsRouter = Router();
paymentsRouter.use(authenticate);

const paymentSchema = z.object({
  serviceOrderId: z.string().uuid(),
  amount: z.number().positive(),
  method: z.enum(['pix', 'cash', 'credit_card', 'debit_card', 'transfer']),
  installments: z.number().int().min(1).max(24).optional(),
  notes: z.string().optional(),
  paidAt: z.string().optional(),
});

// GET /api/payments?serviceOrderId=xxx
paymentsRouter.get('/', async (req, res) => {
  const { serviceOrderId } = req.query;
  const tenantId = req.user!.tenantId;
  const where: any = { tenantId };
  if (serviceOrderId) where.serviceOrderId = String(serviceOrderId);

  const payments = await prisma.payment.findMany({
    where,
    orderBy: { paidAt: 'desc' },
    include: {
      serviceOrder: {
        select: { number: true, client: { select: { name: true } } },
      },
    },
  });
  res.json(payments);
});

// POST /api/payments
paymentsRouter.post('/', async (req, res) => {
  try {
    const data = paymentSchema.parse(req.body);
    const tenantId = req.user!.tenantId;

    const order = await prisma.serviceOrder.findFirst({
      where: { id: data.serviceOrderId, tenantId },
      include: { payments: true },
    });
    if (!order) {
      res.status(404).json({ error: 'Ordem de serviço não encontrada' });
      return;
    }

    const totalPaid = order.payments.reduce((acc, p) => acc + p.amount, 0);
    if (totalPaid + data.amount > order.finalValue + 0.01) {
      res.status(400).json({
        error: `Valor excede o saldo em aberto (R$${(order.finalValue - totalPaid).toFixed(2)})`,
      });
      return;
    }

    const payment = await prisma.payment.create({
      data: {
        tenantId,
        serviceOrderId: data.serviceOrderId,
        amount: data.amount,
        method: data.method,
        installments: data.method === 'credit_card' ? (data.installments ?? 1) : null,
        notes: data.notes,
        paidAt: data.paidAt ? new Date(data.paidAt) : new Date(),
      },
    });

    // Se totalmente pago, marcar OS como concluída (se ainda estiver aberta)
    const newTotal = totalPaid + data.amount;
    if (newTotal >= order.finalValue - 0.01 && order.status === 'open') {
      await prisma.serviceOrder.update({
        where: { id: order.id },
        data: { status: 'completed', completedAt: new Date() },
      });
    }

    res.status(201).json(payment);
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.errors[0].message });
      return;
    }
    res.status(500).json({ error: 'Erro ao registrar pagamento' });
  }
});

// DELETE /api/payments/:id
paymentsRouter.delete('/:id', async (req, res) => {
  const payment = await prisma.payment.findFirst({
    where: { id: req.params.id, tenantId: req.user!.tenantId },
  });
  if (!payment) {
    res.status(404).json({ error: 'Pagamento não encontrado' });
    return;
  }
  await prisma.payment.delete({ where: { id: req.params.id } });
  res.json({ message: 'Pagamento removido' });
});
