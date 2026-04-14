import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { authenticate, requireRole } from '../middleware/auth';

export const tenantRouter = Router();
tenantRouter.use(authenticate);

const updateTenantSchema = z.object({
  name: z.string().min(2).optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  address: z.string().optional(),
});

// GET /api/tenant
tenantRouter.get('/', async (req, res) => {
  const tenant = await prisma.tenant.findUnique({
    where: { id: req.user!.tenantId },
    select: { id: true, name: true, slug: true, phone: true, email: true, address: true, logoUrl: true, plan: true },
  });
  if (!tenant) {
    res.status(404).json({ error: 'Tenant não encontrado' });
    return;
  }
  res.json(tenant);
});

// PUT /api/tenant
tenantRouter.put('/', requireRole('admin'), async (req, res) => {
  try {
    const data = updateTenantSchema.parse(req.body);
    const updated = await prisma.tenant.update({
      where: { id: req.user!.tenantId },
      data,
      select: { id: true, name: true, slug: true, phone: true, email: true, address: true, logoUrl: true, plan: true },
    });
    res.json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.errors[0].message });
      return;
    }
    res.status(500).json({ error: 'Erro ao atualizar configurações' });
  }
});

// GET /api/tenant/users
tenantRouter.get('/users', requireRole('admin'), async (req, res) => {
  const users = await prisma.user.findMany({
    where: { tenantId: req.user!.tenantId },
    select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
    orderBy: { name: 'asc' },
  });
  res.json(users);
});

// POST /api/tenant/users
tenantRouter.post('/users', requireRole('admin'), async (req, res) => {
  const { name, email, password, role } = req.body;
  const bcrypt = await import('bcryptjs');
  const passwordHash = await bcrypt.hash(password, 12);

  try {
    const user = await prisma.user.create({
      data: { tenantId: req.user!.tenantId, name, email, passwordHash, role: role || 'attendant' },
      select: { id: true, name: true, email: true, role: true, active: true },
    });
    res.status(201).json(user);
  } catch {
    res.status(409).json({ error: 'E-mail já cadastrado nesta estética' });
  }
});
