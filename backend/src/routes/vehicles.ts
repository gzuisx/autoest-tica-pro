import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { authenticate } from '../middleware/auth';

export const vehiclesRouter = Router();
vehiclesRouter.use(authenticate);

const vehicleSchema = z.object({
  clientId: z.string().uuid(),
  brand: z.string().min(1),
  model: z.string().min(1),
  year: z.number().int().min(1950).max(new Date().getFullYear() + 2).optional(),
  color: z.string().optional(),
  plate: z.string().optional(),
  chassis: z.string().min(1, 'Chassi é obrigatório'),
  mileage: z.number().int().optional(),
  notes: z.string().optional(),
});

// GET /api/vehicles?clientId=xxx
vehiclesRouter.get('/', async (req, res) => {
  const { clientId, search } = req.query;
  const tenantId = req.user!.tenantId;

  const where: any = { tenantId };
  if (clientId) where.clientId = String(clientId);
  if (search) {
    const searchStr = String(search)
    const searchNum = parseInt(searchStr)
    where.OR = [
      { brand: { contains: searchStr, mode: 'insensitive' } },
      { model: { contains: searchStr, mode: 'insensitive' } },
      { plate: { contains: searchStr } },
      { client: { name: { contains: searchStr, mode: 'insensitive' } } },
      ...(!isNaN(searchNum) ? [{ client: { registrationNumber: searchNum } }] : []),
    ];
  }

  const vehicles = await prisma.vehicle.findMany({
    where,
    include: {
      client: { select: { id: true, name: true, phone: true } },
      _count: { select: { serviceOrders: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  res.json(vehicles);
});

// GET /api/vehicles/:id
vehiclesRouter.get('/:id', async (req, res) => {
  const vehicle = await prisma.vehicle.findFirst({
    where: { id: req.params.id, tenantId: req.user!.tenantId },
    include: {
      client: true,
      serviceOrders: {
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { payments: true },
      },
      photos: { orderBy: { createdAt: 'desc' } },
    },
  });

  if (!vehicle) {
    res.status(404).json({ error: 'Veículo não encontrado' });
    return;
  }
  res.json(vehicle);
});

// POST /api/vehicles
vehiclesRouter.post('/', async (req, res) => {
  try {
    const data = vehicleSchema.parse(req.body);
    const tenantId = req.user!.tenantId;

    const client = await prisma.client.findFirst({ where: { id: data.clientId, tenantId } });
    if (!client) {
      res.status(404).json({ error: 'Cliente não encontrado' });
      return;
    }

    const vehicle = await prisma.vehicle.create({ data: { ...data, tenantId } });
    res.status(201).json(vehicle);
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.errors[0].message });
      return;
    }
    res.status(500).json({ error: 'Erro ao criar veículo' });
  }
});

// PUT /api/vehicles/:id
vehiclesRouter.put('/:id', async (req, res) => {
  try {
    const data = vehicleSchema.partial().parse(req.body);
    const vehicle = await prisma.vehicle.findFirst({
      where: { id: req.params.id, tenantId: req.user!.tenantId },
    });
    if (!vehicle) {
      res.status(404).json({ error: 'Veículo não encontrado' });
      return;
    }
    const updated = await prisma.vehicle.update({ where: { id: req.params.id }, data });
    res.json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.errors[0].message });
      return;
    }
    res.status(500).json({ error: 'Erro ao atualizar veículo' });
  }
});

// DELETE /api/vehicles/:id
vehiclesRouter.delete('/:id', async (req, res) => {
  const vehicle = await prisma.vehicle.findFirst({
    where: { id: req.params.id, tenantId: req.user!.tenantId },
  });
  if (!vehicle) {
    res.status(404).json({ error: 'Veículo não encontrado' });
    return;
  }
  await prisma.vehicle.delete({ where: { id: req.params.id } });
  res.json({ message: 'Veículo removido' });
});
