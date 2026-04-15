import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { authenticate, requireRole } from '../middleware/auth';
import * as audit from '../utils/auditLog';
import { checkLimit, PlanType } from '../utils/planLimits';

export const serviceOrdersRouter = Router();
serviceOrdersRouter.use(authenticate);

const checklistSchema = z.object({
  scratches: z.string().optional(),
  stains: z.string().optional(),
  fuelLevel: z.string().optional(),
  mileage: z.number().optional(),
  personalItems: z.string().optional(),
  generalCondition: z.string().optional(),
  observations: z.string().optional(),
});

const serviceOrderSchema = z.object({
  clientId: z.string().uuid(),
  vehicleId: z.string().uuid(),
  quoteId: z.string().uuid().optional(),
  finalValue: z.number().positive(),
  notes: z.string().optional(),
  checklist: checklistSchema.optional(),
  kmEntry: z.number().int().optional(),
  userId: z.string().uuid().optional(),
});

async function getNextOSNumber(tenantId: string): Promise<number> {
  const last = await prisma.serviceOrder.findFirst({
    where: { tenantId },
    orderBy: { number: 'desc' },
    select: { number: true },
  });
  return (last?.number ?? 0) + 1;
}

// GET /api/service-orders
serviceOrdersRouter.get('/', async (req, res) => {
  const { status, clientId, search, page = '1', limit = '20' } = req.query;
  const tenantId = req.user!.tenantId;
  const where: any = { tenantId };
  if (status) where.status = String(status);
  if (clientId) where.clientId = String(clientId);
  if (search) {
    const searchStr = String(search);
    const searchNum = parseInt(searchStr);
    where.AND = [
      {
        OR: [
          { client: { name: { contains: searchStr, mode: 'insensitive' } } },
          ...(!isNaN(searchNum) ? [{ number: searchNum }] : []),
        ],
      },
    ];
  }

  const limitNum = Math.min(Number(limit), 100);
  const skip = (Number(page) - 1) * limitNum;
  const [orders, total] = await Promise.all([
    prisma.serviceOrder.findMany({
      where,
      skip,
      take: limitNum,
      orderBy: { createdAt: 'desc' },
      include: {
        client: { select: { id: true, name: true, phone: true, whatsapp: true, registrationNumber: true } },
        vehicle: { select: { id: true, brand: true, model: true, plate: true } },
        user: { select: { id: true, name: true } },
        payments: true,
        _count: { select: { photos: true } },
      },
    }),
    prisma.serviceOrder.count({ where }),
  ]);

  res.json({ orders, total, page: Number(page), totalPages: Math.ceil(total / limitNum) });
});

// GET /api/service-orders/:id
serviceOrdersRouter.get('/:id', async (req, res) => {
  const order = await prisma.serviceOrder.findFirst({
    where: { id: String(req.params.id), tenantId: req.user!.tenantId },
    include: {
      client: true,
      vehicle: true,
      user: { select: { id: true, name: true } },
      quote: { include: { items: { include: { service: true } } } },
      payments: { orderBy: { paidAt: 'asc' } },
      photos: { orderBy: { createdAt: 'asc' } },
      tenant: { select: { name: true, phone: true, email: true, address: true, logoUrl: true } },
    },
  });
  if (!order) {
    res.status(404).json({ error: 'Ordem de serviço não encontrada' });
    return;
  }

  const totalPaid = order.payments.reduce((acc, p) => acc + p.amount, 0);
  const remaining = order.finalValue - totalPaid;

  res.json({ ...order, totalPaid, remaining });
});

// POST /api/service-orders — admin e atendente
serviceOrdersRouter.post('/', requireRole('admin', 'attendant'), async (req, res) => {
  try {
    const data = serviceOrderSchema.parse(req.body);
    const tenantId = req.user!.tenantId;

    // Verifica limite do plano
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { plan: true } });
    const limitCheck = await checkLimit(tenantId, (tenant?.plan || 'basic') as PlanType, 'serviceOrders');
    if (!limitCheck.allowed) {
      res.status(402).json({
        error: 'Limite de ordens de serviço atingido para o seu plano.',
        limitExceeded: true,
        resource: 'serviceOrders',
        used: limitCheck.used,
        limit: limitCheck.limit,
      });
      return;
    }

    const number = await getNextOSNumber(tenantId);

    const order = await prisma.serviceOrder.create({
      data: {
        tenantId,
        clientId: data.clientId,
        vehicleId: data.vehicleId,
        quoteId: data.quoteId,
        userId: data.userId || req.user!.userId,
        number,
        finalValue: data.finalValue,
        notes: data.notes,
        checklist: data.checklist ? JSON.stringify(data.checklist) : null,
        kmEntry: data.kmEntry,
        status: 'open',
      },
      include: { client: true, vehicle: true },
    });

    if (data.quoteId) {
      await prisma.quote.update({
        where: { id: data.quoteId },
        data: { status: 'approved' },
      });
    }

    await audit.log({
      tenantId,
      userId: req.user!.userId,
      action: 'CREATE',
      entity: 'service_order',
      entityId: order.id,
      details: { number: order.number, clientName: order.client.name, finalValue: order.finalValue },
    });

    res.status(201).json(order);
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.errors[0].message });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'Erro ao criar ordem de serviço' });
  }
});

// PATCH /api/service-orders/:id — editar valor, notas, kmEntry e damageMap (admin e atendente)
serviceOrdersRouter.patch('/:id', requireRole('admin', 'attendant'), async (req, res) => {
  try {
    const schema = z.object({
      finalValue: z.number().positive().optional(),
      notes: z.string().optional(),
      kmEntry: z.number().int().optional(),
      damageMap: z.string().optional(),
    });
    const data = schema.parse(req.body);

    const order = await prisma.serviceOrder.findFirst({
      where: { id: String(req.params.id), tenantId: req.user!.tenantId },
    });
    if (!order) {
      res.status(404).json({ error: 'Ordem de serviço não encontrada' });
      return;
    }

    const updated = await prisma.serviceOrder.update({
      where: { id: String(req.params.id) },
      data,
    });
    res.json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.errors[0].message });
      return;
    }
    res.status(500).json({ error: 'Erro ao atualizar OS' });
  }
});

// PATCH /api/service-orders/:id/status
serviceOrdersRouter.patch('/:id/status', async (req, res) => {
  const validStatuses = ['open', 'in_progress', 'completed', 'cancelled'];
  const { status } = req.body;

  if (!validStatuses.includes(status)) {
    res.status(400).json({ error: 'Status inválido' });
    return;
  }

  const order = await prisma.serviceOrder.findFirst({
    where: { id: String(req.params.id), tenantId: req.user!.tenantId },
  });
  if (!order) {
    res.status(404).json({ error: 'Ordem de serviço não encontrada' });
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: req.user!.userId }, select: { name: true } });

  const [updated] = await prisma.$transaction([
    prisma.serviceOrder.update({
      where: { id: String(req.params.id) },
      data: {
        status,
        completedAt: status === 'completed' ? new Date() : undefined,
      },
    }),
    prisma.serviceOrderStatusHistory.create({
      data: {
        serviceOrderId: req.params.id,
        fromStatus: order.status,
        toStatus: status,
        userId: req.user!.userId,
        userName: user?.name,
      },
    }),
  ]);

  await audit.log({
    tenantId: req.user!.tenantId,
    userId: req.user!.userId,
    userName: user?.name,
    action: 'STATUS_CHANGE',
    entity: 'service_order',
    entityId: order.id,
    details: { from: order.status, to: status, orderNumber: order.number },
  });

  res.json(updated);
});

// GET /api/service-orders/:id/history
serviceOrdersRouter.get('/:id/history', async (req, res) => {
  const order = await prisma.serviceOrder.findFirst({
    where: { id: String(req.params.id), tenantId: req.user!.tenantId },
  });
  if (!order) {
    res.status(404).json({ error: 'Ordem de serviço não encontrada' });
    return;
  }

  const history = await prisma.serviceOrderStatusHistory.findMany({
    where: { serviceOrderId: req.params.id },
    orderBy: { createdAt: 'asc' },
  });

  res.json(history);
});

// PATCH /api/service-orders/:id/checklist — todos os roles
serviceOrdersRouter.patch('/:id/checklist', async (req, res) => {
  try {
    const validated = checklistSchema.parse(req.body);

    const order = await prisma.serviceOrder.findFirst({
      where: { id: String(req.params.id), tenantId: req.user!.tenantId },
    });
    if (!order) {
      res.status(404).json({ error: 'Ordem de serviço não encontrada' });
      return;
    }
    const updated = await prisma.serviceOrder.update({
      where: { id: String(req.params.id) },
      data: { checklist: JSON.stringify(validated) },
    });
    res.json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.errors[0].message });
      return;
    }
    res.status(500).json({ error: 'Erro ao atualizar checklist' });
  }
});
