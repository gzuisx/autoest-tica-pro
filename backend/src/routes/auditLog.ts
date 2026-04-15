import { Router } from 'express';
import { prisma } from '../utils/prisma';
import { authenticate, requireRole } from '../middleware/auth';

export const auditLogRouter = Router();
auditLogRouter.use(authenticate);

// GET /api/audit-log — somente admin (usado pelo painel administrativo)
auditLogRouter.get('/', requireRole('admin'), async (req, res) => {
  const { page = '1', limit = '50', action, entity } = req.query;
  const tenantId = req.user!.tenantId;
  const limitNum = Math.min(Number(limit), 200);
  const skip = (Number(page) - 1) * limitNum;

  const where: any = { tenantId };
  if (action) where.action = String(action);
  if (entity) where.entity = String(entity);

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      skip,
      take: limitNum,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { name: true, email: true } },
      },
    }),
    prisma.auditLog.count({ where }),
  ]);

  res.json({ logs, total, page: Number(page), totalPages: Math.ceil(total / limitNum) });
});
