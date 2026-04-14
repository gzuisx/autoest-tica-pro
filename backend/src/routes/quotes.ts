import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { authenticate } from '../middleware/auth';
import { waLinkQuote } from '../utils/whatsapp';

export const quotesRouter = Router();
quotesRouter.use(authenticate);

const quoteItemSchema = z.object({
  serviceId: z.string().uuid().optional(),
  description: z.string().min(1),
  price: z.number().positive(),
  quantity: z.number().int().positive().default(1),
});

const quoteSchema = z.object({
  clientId: z.string().uuid(),
  vehicleId: z.string().uuid(),
  items: z.array(quoteItemSchema).min(1),
  discount: z.number().min(0).default(0),
  validDays: z.number().int().positive().default(7),
  notes: z.string().optional(),
});

async function getNextQuoteNumber(tenantId: string): Promise<number> {
  const last = await prisma.quote.findFirst({
    where: { tenantId },
    orderBy: { number: 'desc' },
    select: { number: true },
  });
  return (last?.number ?? 0) + 1;
}

async function getNextOSNumber(tenantId: string): Promise<number> {
  const last = await prisma.serviceOrder.findFirst({
    where: { tenantId },
    orderBy: { number: 'desc' },
    select: { number: true },
  });
  return (last?.number ?? 0) + 1;
}

// GET /api/quotes
quotesRouter.get('/', async (req, res) => {
  const { status, clientId, page = '1', limit = '20' } = req.query;
  const tenantId = req.user!.tenantId;
  const where: any = { tenantId };
  if (status) where.status = String(status);
  if (clientId) where.clientId = String(clientId);

  const skip = (Number(page) - 1) * Number(limit);
  const [quotes, total] = await Promise.all([
    prisma.quote.findMany({
      where,
      skip,
      take: Number(limit),
      orderBy: { createdAt: 'desc' },
      include: {
        client: { select: { id: true, name: true, phone: true, whatsapp: true, registrationNumber: true } },
        vehicle: { select: { id: true, brand: true, model: true, plate: true } },
        items: { include: { service: { select: { name: true } } } },
      },
    }),
    prisma.quote.count({ where }),
  ]);

  res.json({ quotes, total, page: Number(page), totalPages: Math.ceil(total / Number(limit)) });
});

// GET /api/quotes/:id
quotesRouter.get('/:id', async (req, res) => {
  const quote = await prisma.quote.findFirst({
    where: { id: req.params.id, tenantId: req.user!.tenantId },
    include: {
      client: true,
      vehicle: true,
      items: { include: { service: true } },
    },
  });
  if (!quote) {
    res.status(404).json({ error: 'Orçamento não encontrado' });
    return;
  }

  const tenant = await prisma.tenant.findUnique({ where: { id: req.user!.tenantId } });
  const phone = quote.client.whatsapp || quote.client.phone || '';
  const vehicleLabel = `${quote.vehicle.brand} ${quote.vehicle.model} ${quote.vehicle.plate ?? ''}`.trim();
  const serviceNames = quote.items.map((i) => `${i.description} — R$${i.price.toFixed(2)}`);
  const waLink = waLinkQuote(phone, quote.client.name, vehicleLabel, serviceNames, quote.totalValue, tenant?.name ?? 'Estética');

  res.json({ ...quote, waLink });
});

// POST /api/quotes
quotesRouter.post('/', async (req, res) => {
  try {
    const data = quoteSchema.parse(req.body);
    const tenantId = req.user!.tenantId;

    const subtotal = data.items.reduce((acc, item) => acc + item.price * item.quantity, 0);
    const totalValue = Math.max(0, subtotal - data.discount);
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + data.validDays);
    const number = await getNextQuoteNumber(tenantId);

    const quote = await prisma.quote.create({
      data: {
        tenantId,
        clientId: data.clientId,
        vehicleId: data.vehicleId,
        number,
        totalValue,
        discount: data.discount,
        validUntil,
        notes: data.notes,
        items: {
          create: data.items.map((item) => ({
            serviceId: item.serviceId,
            description: item.description,
            price: item.price,
            quantity: item.quantity,
          })),
        },
      },
      include: {
        client: true,
        vehicle: true,
        items: { include: { service: true } },
      },
    });

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    const phone = quote.client.whatsapp || quote.client.phone || '';
    const vehicleLabel = `${quote.vehicle.brand} ${quote.vehicle.model}`.trim();
    const serviceNames = quote.items.map((i) => `${i.description} — R$${i.price.toFixed(2)}`);
    const waLink = waLinkQuote(phone, quote.client.name, vehicleLabel, serviceNames, quote.totalValue, tenant?.name ?? 'Estética');

    res.status(201).json({ ...quote, waLink });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.errors[0].message });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'Erro ao criar orçamento' });
  }
});

// PUT /api/quotes/:id — editar orçamento
quotesRouter.put('/:id', async (req, res) => {
  try {
    const data = quoteSchema.parse(req.body);
    const tenantId = req.user!.tenantId;

    const existing = await prisma.quote.findFirst({
      where: { id: req.params.id, tenantId },
    });
    if (!existing) {
      res.status(404).json({ error: 'Orçamento não encontrado' });
      return;
    }

    const subtotal = data.items.reduce((acc, item) => acc + item.price * item.quantity, 0);
    const totalValue = Math.max(0, subtotal - data.discount);
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + data.validDays);

    // Remove itens antigos e recria
    await prisma.quoteItem.deleteMany({ where: { quoteId: req.params.id } });

    const updated = await prisma.quote.update({
      where: { id: req.params.id },
      data: {
        clientId: data.clientId,
        vehicleId: data.vehicleId,
        totalValue,
        discount: data.discount,
        validUntil,
        notes: data.notes,
        items: {
          create: data.items.map((item) => ({
            serviceId: item.serviceId,
            description: item.description,
            price: item.price,
            quantity: item.quantity,
          })),
        },
      },
      include: {
        client: true,
        vehicle: true,
        items: { include: { service: true } },
      },
    });

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    const phone = updated.client.whatsapp || updated.client.phone || '';
    const vehicleLabel = `${updated.vehicle.brand} ${updated.vehicle.model}`.trim();
    const serviceNames = updated.items.map((i) => `${i.description} — R$${i.price.toFixed(2)}`);
    const waLink = waLinkQuote(phone, updated.client.name, vehicleLabel, serviceNames, updated.totalValue, tenant?.name ?? 'Estética');

    res.json({ ...updated, waLink });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.errors[0].message });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'Erro ao editar orçamento' });
  }
});

// PATCH /api/quotes/:id/status
quotesRouter.patch('/:id/status', async (req, res) => {
  const { status } = req.body;
  const validStatuses = ['pending', 'approved', 'rejected', 'expired'];
  if (!validStatuses.includes(status)) {
    res.status(400).json({ error: 'Status inválido' });
    return;
  }

  const quote = await prisma.quote.findFirst({
    where: { id: req.params.id, tenantId: req.user!.tenantId },
  });
  if (!quote) {
    res.status(404).json({ error: 'Orçamento não encontrado' });
    return;
  }

  const updated = await prisma.quote.update({ where: { id: req.params.id }, data: { status } });
  res.json(updated);
});

// POST /api/quotes/:id/convert-to-os — converte orçamento aprovado em OS
quotesRouter.post('/:id/convert-to-os', async (req, res) => {
  try {
    const tenantId = req.user!.tenantId;

    const quote = await prisma.quote.findFirst({
      where: { id: req.params.id, tenantId },
      include: { client: true, vehicle: true },
    });
    if (!quote) {
      res.status(404).json({ error: 'Orçamento não encontrado' });
      return;
    }

    // Marca como aprovado se ainda estava pendente
    if (quote.status === 'pending') {
      await prisma.quote.update({ where: { id: quote.id }, data: { status: 'approved' } });
    }

    const number = await getNextOSNumber(tenantId);

    const order = await prisma.serviceOrder.create({
      data: {
        tenantId,
        clientId: quote.clientId,
        vehicleId: quote.vehicleId,
        quoteId: quote.id,
        userId: req.user!.userId,
        number,
        finalValue: quote.totalValue,
        notes: quote.notes ?? undefined,
        status: 'open',
      },
      include: {
        client: { select: { id: true, name: true, registrationNumber: true } },
        vehicle: { select: { id: true, brand: true, model: true, plate: true } },
      },
    });

    res.status(201).json(order);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao converter orçamento em OS' });
  }
});
