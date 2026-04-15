import { prisma } from './prisma';

// ─── Plan definitions ─────────────────────────────────────────────────────────

export type PlanType = 'free' | 'basic' | 'pro';

interface PlanLimit {
  clients: number;      // total (free) or per-month (basic)
  vehicles: number;
  serviceOrders: number;
  users: number;
  monthly: boolean;     // true = count only this calendar month
}

export const PLAN_LIMITS: Record<PlanType, PlanLimit> = {
  free: {
    clients: 15,
    vehicles: 15,
    serviceOrders: Infinity,
    users: 1,
    monthly: false,
  },
  basic: {
    clients: 60,
    vehicles: 70,
    serviceOrders: 50,
    users: 2,
    monthly: true,
  },
  pro: {
    clients: Infinity,
    vehicles: Infinity,
    serviceOrders: Infinity,
    users: Infinity,
    monthly: false,
  },
};

// ─── Date helpers ─────────────────────────────────────────────────────────────

export function monthStart(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

// ─── Usage counters ───────────────────────────────────────────────────────────

export type LimitedResource = 'clients' | 'vehicles' | 'serviceOrders';

async function countResource(tenantId: string, resource: LimitedResource, since?: Date): Promise<number> {
  const where: any = { tenantId };
  if (since) where.createdAt = { gte: since };

  if (resource === 'clients') return prisma.client.count({ where });
  if (resource === 'vehicles') return prisma.vehicle.count({ where });
  return prisma.serviceOrder.count({ where });
}

// ─── Full usage snapshot ──────────────────────────────────────────────────────

export interface UsageSnapshot {
  plan: PlanType;
  monthly: boolean;
  periodLabel: string; // e.g. "abril 2026" or "total"
  usage: {
    clients: { used: number; limit: number; pct: number };
    vehicles: { used: number; limit: number; pct: number };
    serviceOrders: { used: number; limit: number; pct: number };
    users: { used: number; limit: number; pct: number };
  };
}

export async function getUsageSnapshot(tenantId: string, plan: PlanType): Promise<UsageSnapshot> {
  const limits = PLAN_LIMITS[plan];
  const since = limits.monthly ? monthStart() : undefined;

  const [clients, vehicles, serviceOrders, users] = await Promise.all([
    countResource(tenantId, 'clients', since),
    countResource(tenantId, 'vehicles', since),
    countResource(tenantId, 'serviceOrders', since),
    prisma.user.count({ where: { tenantId, active: true } }),
  ]);

  function pct(used: number, limit: number) {
    if (!isFinite(limit)) return 0;
    return Math.round((used / limit) * 100);
  }

  const now = new Date();
  const periodLabel = limits.monthly
    ? now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    : 'total';

  return {
    plan,
    monthly: limits.monthly,
    periodLabel,
    usage: {
      clients: { used: clients, limit: limits.clients, pct: pct(clients, limits.clients) },
      vehicles: { used: vehicles, limit: limits.vehicles, pct: pct(vehicles, limits.vehicles) },
      serviceOrders: { used: serviceOrders, limit: limits.serviceOrders, pct: pct(serviceOrders, limits.serviceOrders) },
      users: { used: users, limit: limits.users, pct: pct(users, limits.users) },
    },
  };
}

// ─── Limit check (used in POST routes) ───────────────────────────────────────

export interface LimitCheckResult {
  allowed: boolean;
  used: number;
  limit: number;
  pct: number;
}

export async function checkLimit(
  tenantId: string,
  plan: PlanType,
  resource: LimitedResource
): Promise<LimitCheckResult> {
  const limits = PLAN_LIMITS[plan];
  const limit = limits[resource];

  if (!isFinite(limit)) {
    return { allowed: true, used: 0, limit: Infinity, pct: 0 };
  }

  const since = limits.monthly ? monthStart() : undefined;
  const used = await countResource(tenantId, resource, since);
  const pct = Math.round((used / limit) * 100);

  return { allowed: used < limit, used, limit, pct };
}
