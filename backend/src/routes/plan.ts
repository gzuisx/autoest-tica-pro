import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { prisma } from '../utils/prisma';
import { getUsageSnapshot, PlanType } from '../utils/planLimits';

export const planRouter = Router();
planRouter.use(authenticate);

// GET /api/plan/usage — retorna uso atual vs limites do plano
planRouter.get('/usage', async (req, res) => {
  try {
    const tenantId = req.user!.tenantId;

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { plan: true, name: true },
    });

    if (!tenant) {
      res.status(404).json({ error: 'Tenant não encontrado' });
      return;
    }

    const plan = (tenant.plan || 'basic') as PlanType;
    const snapshot = await getUsageSnapshot(tenantId, plan);

    res.json(snapshot);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar uso do plano' });
  }
});
