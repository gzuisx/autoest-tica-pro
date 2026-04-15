import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../utils/prisma';

export const adminRouter = Router();

// ─── Middleware de autenticação do super admin ────────────────────────────────

function adminAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Token não fornecido' });
    return;
  }
  const token = authHeader.split(' ')[1];
  try {
    jwt.verify(token, process.env.SUPER_ADMIN_SECRET!);
    next();
  } catch {
    res.status(401).json({ error: 'Token de admin inválido' });
  }
}

// ─── POST /api/admin/login ────────────────────────────────────────────────────

adminRouter.post('/login', (req, res) => {
  const { secret } = req.body;
  if (!secret || secret !== process.env.SUPER_ADMIN_SECRET) {
    res.status(401).json({ error: 'Senha incorreta' });
    return;
  }
  const token = jwt.sign({ role: 'superadmin' }, process.env.SUPER_ADMIN_SECRET!, { expiresIn: '12h' });
  res.json({ token });
});

// ─── GET /api/admin/stats ─────────────────────────────────────────────────────

adminRouter.get('/stats', adminAuth, async (_req, res) => {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

  const [
    totalTenants,
    premiumTenants,
    basicTenants,
    totalUsers,
    newTenantsThisMonth,
    newTenantsPrevMonth,
    recentTenants,
  ] = await Promise.all([
    prisma.tenant.count({ where: { active: true } }),
    prisma.tenant.count({ where: { active: true, plan: 'pro' } }),
    prisma.tenant.count({ where: { active: true, plan: 'basic' } }),
    prisma.user.count({ where: { active: true } }),
    prisma.tenant.count({ where: { createdAt: { gte: monthStart } } }),
    prisma.tenant.count({ where: { createdAt: { gte: prevMonthStart, lte: prevMonthEnd } } }),
    prisma.tenant.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, name: true, slug: true, plan: true, createdAt: true, email: true },
    }),
  ]);

  const conversionRate = totalTenants > 0 ? ((premiumTenants / totalTenants) * 100).toFixed(1) : '0';
  const growthRate = newTenantsPrevMonth > 0
    ? (((newTenantsThisMonth - newTenantsPrevMonth) / newTenantsPrevMonth) * 100).toFixed(1)
    : null;

  res.json({
    totalTenants,
    premiumTenants,
    basicTenants,
    totalUsers,
    newTenantsThisMonth,
    conversionRate: `${conversionRate}%`,
    growthRate: growthRate ? `${Number(growthRate) >= 0 ? '+' : ''}${growthRate}%` : null,
    recentTenants,
  });
});

// ─── GET /api/admin/activity ──────────────────────────────────────────────────

adminRouter.get('/activity', adminAuth, async (req, res) => {
  const { limit = '30' } = req.query;
  const limitNum = Math.min(Number(limit), 100);

  // Atividade recente: novos tenants + logins/eventos de audit log relevantes
  const [recentTenants, recentAuditLogs] = await Promise.all([
    prisma.tenant.findMany({
      orderBy: { createdAt: 'desc' },
      take: limitNum,
      select: { id: true, name: true, email: true, plan: true, createdAt: true },
    }),
    prisma.auditLog.findMany({
      where: {
        action: { in: ['LOGIN', 'LOGOUT'] },
      },
      orderBy: { createdAt: 'desc' },
      take: limitNum,
      include: {
        tenant: { select: { name: true } },
        user: { select: { email: true } },
      },
    }),
  ]);

  // Montar feed de atividade unificado
  const feed: Array<{
    type: string;
    label: string;
    email: string;
    tenantName: string;
    plan?: string;
    createdAt: Date;
  }> = [];

  for (const t of recentTenants) {
    feed.push({
      type: 'new_registration',
      label: 'Novo cadastro',
      email: maskEmail(t.email || ''),
      tenantName: t.name,
      plan: t.plan,
      createdAt: t.createdAt,
    });
  }

  for (const log of recentAuditLogs) {
    if (log.action === 'LOGIN' && log.user?.email) {
      feed.push({
        type: 'login',
        label: 'Login no sistema',
        email: maskEmail(log.user.email),
        tenantName: log.tenant?.name || '',
        createdAt: log.createdAt,
      });
    }
  }

  // Ordenar por data mais recente
  feed.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  res.json(feed.slice(0, limitNum));
});

// ─── GET /api/admin/tenants ───────────────────────────────────────────────────

adminRouter.get('/tenants', adminAuth, async (req, res) => {
  const { page = '1', limit = '20', search } = req.query;
  const limitNum = Math.min(Number(limit), 100);
  const skip = (Number(page) - 1) * limitNum;

  const where: any = {};
  if (search) {
    const s = String(search);
    where.OR = [
      { name: { contains: s } },
      { slug: { contains: s } },
      { email: { contains: s } },
    ];
  }

  const [tenants, total] = await Promise.all([
    prisma.tenant.findMany({
      where,
      skip,
      take: limitNum,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, name: true, slug: true, email: true, phone: true,
        plan: true, active: true, createdAt: true,
        _count: { select: { users: true, clients: true, serviceOrders: true } },
      },
    }),
    prisma.tenant.count({ where }),
  ]);

  res.json({ tenants, total, page: Number(page), totalPages: Math.ceil(total / limitNum) });
});

// ─── PATCH /api/admin/tenants/:id/plan ───────────────────────────────────────

adminRouter.patch('/tenants/:id/plan', adminAuth, async (req, res) => {
  const { plan } = req.body;
  if (!['basic', 'pro'].includes(plan)) {
    res.status(400).json({ error: 'Plano inválido (basic ou pro)' });
    return;
  }
  const tenant = await prisma.tenant.update({
    where: { id: String(req.params.id) },
    data: { plan },
    select: { id: true, name: true, plan: true },
  });
  res.json(tenant);
});

// ─── PATCH /api/admin/tenants/:id/active ─────────────────────────────────────

adminRouter.patch('/tenants/:id/active', adminAuth, async (req, res) => {
  const { active } = req.body;
  if (typeof active !== 'boolean') {
    res.status(400).json({ error: 'active deve ser boolean' });
    return;
  }
  const tenant = await prisma.tenant.update({
    where: { id: String(req.params.id) },
    data: { active },
    select: { id: true, name: true, active: true },
  });
  res.json(tenant);
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return email;
  const [local, domain] = email.split('@');
  const visible = local.slice(0, Math.min(4, local.length));
  return `${visible}***@${domain}`;
}
