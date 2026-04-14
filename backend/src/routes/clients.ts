import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { authenticate } from '../middleware/auth';
import { waLinkReturnReminder, waLinkBirthday } from '../utils/whatsapp';

export const clientsRouter = Router();
clientsRouter.use(authenticate);

const clientSchema = z.object({
  name: z.string().min(2),
  phone: z.string().min(8).optional().or(z.literal('')),
  whatsapp: z.string().min(8),
  email: z.string().email().optional().or(z.literal('')),
  cpf: z.string().optional(),
  rg: z.string().optional(),
  birthDate: z.string().optional(),
  origin: z.string().optional(),
  notes: z.string().optional(),
  acceptsPromo: z.boolean().default(true),
  zipCode: z.string().optional(),
  street: z.string().optional(),
  addressNumber: z.string().optional(),
  neighborhood: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
});

async function getNextRegistrationNumber(tenantId: string): Promise<number> {
  const last = await prisma.client.findFirst({
    where: { tenantId },
    orderBy: { registrationNumber: 'desc' },
    select: { registrationNumber: true },
  });
  return (last?.registrationNumber ?? 0) + 1;
}

// GET /api/clients
clientsRouter.get('/', async (req, res) => {
  const { search, page = '1', limit = '20' } = req.query;
  const tenantId = req.user!.tenantId;
  const limitNum = Math.min(Number(limit), 100);
  const skip = (Number(page) - 1) * limitNum;

  const where: any = { tenantId };
  if (search) {
    const searchStr = String(search);
    const searchNum = parseInt(searchStr);
    where.OR = [
      { name: { contains: searchStr, mode: 'insensitive' } },
      { phone: { contains: searchStr } },
      { vehicles: { some: { plate: { contains: searchStr } } } },
      ...(!isNaN(searchNum) ? [{ registrationNumber: searchNum }] : []),
    ];
  }

  const [clients, total] = await Promise.all([
    prisma.client.findMany({
      where,
      skip,
      take: limitNum,
      orderBy: { name: 'asc' },
      include: {
        vehicles: { select: { id: true, brand: true, model: true, plate: true, color: true } },
        _count: { select: { serviceOrders: true } },
      },
    }),
    prisma.client.count({ where }),
  ]);

  res.json({ clients, total, page: Number(page), totalPages: Math.ceil(total / limitNum) });
});

// GET /api/clients/:id
clientsRouter.get('/:id', async (req, res) => {
  const client = await prisma.client.findFirst({
    where: { id: req.params.id, tenantId: req.user!.tenantId },
    include: {
      vehicles: true,
      serviceOrders: {
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { payments: true },
      },
      quotes: { orderBy: { createdAt: 'desc' }, take: 5 },
    },
  });

  if (!client) {
    res.status(404).json({ error: 'Cliente não encontrado' });
    return;
  }

  const totalSpent = client.serviceOrders.reduce((acc, so) => {
    return acc + so.payments.reduce((a, p) => a + p.amount, 0);
  }, 0);

  const whatsappNumber = client.whatsapp || client.phone || '';
  const lastOrder = client.serviceOrders[0];
  const daysSinceLastVisit = lastOrder
    ? Math.floor((Date.now() - new Date(lastOrder.createdAt).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  const waLinks: Record<string, string> = {};
  const tenantName = 'sua estética';
  if (daysSinceLastVisit && daysSinceLastVisit > 30) {
    waLinks.returnReminder = waLinkReturnReminder(whatsappNumber, client.name, daysSinceLastVisit, tenantName);
  }
  if (client.birthDate) {
    waLinks.birthday = waLinkBirthday(whatsappNumber, client.name, tenantName);
  }

  res.json({ ...client, totalSpent, daysSinceLastVisit, waLinks });
});

// POST /api/clients
clientsRouter.post('/', async (req, res) => {
  try {
    const data = clientSchema.parse(req.body);
    const tenantId = req.user!.tenantId;
    const registrationNumber = await getNextRegistrationNumber(tenantId);

    const client = await prisma.client.create({
      data: {
        ...data,
        tenantId,
        registrationNumber,
        phone: data.phone || '',
        birthDate: data.birthDate ? new Date(data.birthDate) : undefined,
        email: data.email || undefined,
      },
    });
    res.status(201).json(client);
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.errors[0].message });
      return;
    }
    res.status(500).json({ error: 'Erro ao criar cliente' });
  }
});

// PUT /api/clients/:id
clientsRouter.put('/:id', async (req, res) => {
  try {
    const data = clientSchema.partial().parse(req.body);
    const client = await prisma.client.findFirst({
      where: { id: req.params.id, tenantId: req.user!.tenantId },
    });
    if (!client) {
      res.status(404).json({ error: 'Cliente não encontrado' });
      return;
    }
    const updated = await prisma.client.update({
      where: { id: req.params.id },
      data: {
        ...data,
        birthDate: data.birthDate ? new Date(data.birthDate) : undefined,
      },
    });
    res.json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.errors[0].message });
      return;
    }
    res.status(500).json({ error: 'Erro ao atualizar cliente' });
  }
});

// DELETE /api/clients/:id
clientsRouter.delete('/:id', async (req, res) => {
  const client = await prisma.client.findFirst({
    where: { id: req.params.id, tenantId: req.user!.tenantId },
  });
  if (!client) {
    res.status(404).json({ error: 'Cliente não encontrado' });
    return;
  }
  await prisma.client.delete({ where: { id: req.params.id } });
  res.json({ message: 'Cliente removido' });
});
