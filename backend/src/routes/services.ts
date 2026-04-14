import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { authenticate, requireRole } from '../middleware/auth';

export const servicesRouter = Router();
servicesRouter.use(authenticate);

const serviceSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  basePrice: z.number().positive(),
  estimatedMinutes: z.number().int().positive().default(60),
  category: z.string().optional(),
  recurrenceDays: z.number().int().positive().optional(),
});

// GET /api/services
servicesRouter.get('/', async (req, res) => {
  const { category, active } = req.query;
  const where: any = { tenantId: req.user!.tenantId };
  if (category) where.category = String(category);
  if (active !== undefined) where.active = active === 'true';

  const services = await prisma.service.findMany({
    where,
    orderBy: { name: 'asc' },
  });
  res.json(services);
});

// GET /api/services/categories
servicesRouter.get('/categories', async (req, res) => {
  const services = await prisma.service.findMany({
    where: { tenantId: req.user!.tenantId, active: true },
    select: { category: true },
    distinct: ['category'],
  });
  const categories = services.map((s) => s.category).filter(Boolean);
  res.json(categories);
});

// POST /api/services
servicesRouter.post('/', requireRole('admin', 'attendant'), async (req, res) => {
  try {
    const data = serviceSchema.parse(req.body);
    const service = await prisma.service.create({
      data: { ...data, tenantId: req.user!.tenantId },
    });
    res.status(201).json(service);
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.errors[0].message });
      return;
    }
    res.status(500).json({ error: 'Erro ao criar serviço' });
  }
});

// PUT /api/services/:id
servicesRouter.put('/:id', requireRole('admin', 'attendant'), async (req, res) => {
  try {
    const data = serviceSchema.partial().parse(req.body);
    const id = String(req.params.id);
    const service = await prisma.service.findFirst({
      where: { id, tenantId: req.user!.tenantId },
    });
    if (!service) {
      res.status(404).json({ error: 'Serviço não encontrado' });
      return;
    }
    const updated = await prisma.service.update({ where: { id }, data });
    res.json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.errors[0].message });
      return;
    }
    res.status(500).json({ error: 'Erro ao atualizar serviço' });
  }
});

// PATCH /api/services/:id/toggle
servicesRouter.patch('/:id/toggle', requireRole('admin'), async (req, res) => {
  const id = String(req.params.id);
  const service = await prisma.service.findFirst({
    where: { id, tenantId: req.user!.tenantId },
  });
  if (!service) {
    res.status(404).json({ error: 'Serviço não encontrado' });
    return;
  }
  const updated = await prisma.service.update({
    where: { id },
    data: { active: !service.active },
  });
  res.json(updated);
});
