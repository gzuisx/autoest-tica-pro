import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { authenticate, requireRole } from '../middleware/auth';
import { waLinkConfirmSchedule, waLinkScheduleUpdate } from '../utils/whatsapp';
import * as audit from '../utils/auditLog';

export const schedulesRouter = Router();
schedulesRouter.use(authenticate);

const scheduleSchema = z.object({
  clientId: z.string().uuid(),
  vehicleId: z.string().uuid(),
  serviceIds: z.array(z.string().uuid()).min(1, 'Selecione ao menos um serviço'),
  dateTime: z.string(),
  userId: z.string().uuid().optional(),
  notes: z.string().optional(),
});

// GET /api/schedules — todos os roles
schedulesRouter.get('/', async (req, res) => {
  const { date, status, start, end } = req.query;
  const tenantId = req.user!.tenantId;
  const where: any = { tenantId };

  if (status) where.status = String(status);
  if (date) {
    const d = new Date(String(date));
    const nextDay = new Date(d);
    nextDay.setDate(nextDay.getDate() + 1);
    where.dateTime = { gte: d, lt: nextDay };
  } else if (start && end) {
    where.dateTime = { gte: new Date(String(start)), lte: new Date(String(end)) };
  }

  const schedules = await prisma.schedule.findMany({
    where,
    orderBy: { dateTime: 'asc' },
    include: {
      client: { select: { id: true, name: true, phone: true, whatsapp: true } },
      vehicle: { select: { id: true, brand: true, model: true, plate: true, color: true } },
      user: { select: { id: true, name: true } },
      services: { include: { service: true } },
    },
  });

  res.json(schedules);
});

// GET /api/schedules/today — todos os roles
schedulesRouter.get('/today', async (req, res) => {
  const tenantId = req.user!.tenantId;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const schedules = await prisma.schedule.findMany({
    where: { tenantId, dateTime: { gte: today, lt: tomorrow } },
    orderBy: { dateTime: 'asc' },
    include: {
      client: { select: { id: true, name: true, phone: true, whatsapp: true } },
      vehicle: { select: { id: true, brand: true, model: true, plate: true, color: true } },
      services: { include: { service: { select: { name: true, estimatedMinutes: true } } } },
    },
  });

  res.json(schedules);
});

// POST /api/schedules — admin e atendente
schedulesRouter.post('/', requireRole('admin', 'attendant'), async (req, res) => {
  try {
    const data = scheduleSchema.parse(req.body);
    const tenantId = req.user!.tenantId;

    const dateTime = new Date(data.dateTime);

    if (dateTime <= new Date()) {
      res.status(400).json({ error: 'O agendamento deve ser em uma data futura' });
      return;
    }

    const services = await prisma.service.findMany({
      where: { id: { in: data.serviceIds }, tenantId, active: true },
    });

    if (services.length !== data.serviceIds.length) {
      res.status(400).json({ error: 'Um ou mais serviços inválidos' });
      return;
    }

    const totalMinutes = services.reduce((acc, s) => acc + s.estimatedMinutes, 0);
    const endDateTime = new Date(dateTime.getTime() + totalMinutes * 60 * 1000);

    const conflict = await prisma.schedule.findFirst({
      where: {
        tenantId,
        status: { in: ['scheduled', 'confirmed', 'in_progress'] },
        AND: [
          { dateTime: { lt: endDateTime } },
          { endDateTime: { gt: dateTime } },
        ],
      },
    });

    const schedule = await prisma.schedule.create({
      data: {
        tenantId,
        clientId: data.clientId,
        vehicleId: data.vehicleId,
        userId: data.userId,
        dateTime,
        endDateTime,
        notes: data.notes,
        services: {
          create: services.map((s) => ({
            serviceId: s.id,
            price: s.basePrice,
          })),
        },
      },
      include: {
        client: true,
        vehicle: true,
        services: { include: { service: true } },
      },
    });

    await audit.log({
      tenantId,
      userId: req.user!.userId,
      action: 'CREATE',
      entity: 'schedule',
      entityId: schedule.id,
      details: { clientName: schedule.client.name, dateTime: schedule.dateTime },
    });

    const phone = schedule.client.whatsapp || schedule.client.phone || '';
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    const formattedDate = dateTime.toLocaleDateString('pt-BR');
    const formattedTime = dateTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const serviceNames = services.map((s) => s.name);
    const waLink = waLinkConfirmSchedule(phone, schedule.client.name, formattedDate, formattedTime, serviceNames, tenant?.name || 'Estética');

    res.status(201).json({
      ...schedule,
      waConfirmLink: waLink,
      warning: conflict ? 'Atenção: já existe outro veículo agendado nesse horário.' : undefined,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.errors[0].message });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'Erro ao criar agendamento' });
  }
});

// PUT /api/schedules/:id — admin e atendente
schedulesRouter.put('/:id', requireRole('admin', 'attendant'), async (req, res) => {
  try {
    const updateSchema = z.object({
      dateTime: z.string(),
      serviceIds: z.array(z.string().uuid()).min(1),
      notes: z.string().optional(),
    });

    const data = updateSchema.parse(req.body);
    const tenantId = req.user!.tenantId;
    const id = String(req.params.id);

    const existing = await prisma.schedule.findFirst({
      where: { id, tenantId },
      include: { client: true },
    });
    if (!existing) {
      res.status(404).json({ error: 'Agendamento não encontrado' });
      return;
    }

    const dateTime = new Date(data.dateTime);

    const services = await prisma.service.findMany({
      where: { id: { in: data.serviceIds }, tenantId, active: true },
    });

    if (services.length !== data.serviceIds.length) {
      res.status(400).json({ error: 'Um ou mais serviços inválidos' });
      return;
    }

    const totalMinutes = services.reduce((acc, s) => acc + s.estimatedMinutes, 0);
    const endDateTime = new Date(dateTime.getTime() + totalMinutes * 60 * 1000);

    await prisma.scheduleService.deleteMany({ where: { scheduleId: id } });

    const updated = await prisma.schedule.update({
      where: { id },
      data: {
        dateTime,
        endDateTime,
        notes: data.notes,
        services: {
          create: services.map((s) => ({ serviceId: s.id, price: s.basePrice })),
        },
      },
      include: {
        client: true,
        vehicle: true,
        services: { include: { service: true } },
      },
    });

    await audit.log({
      tenantId,
      userId: req.user!.userId,
      action: 'UPDATE',
      entity: 'schedule',
      entityId: updated.id,
      details: { clientName: updated.client.name, newDateTime: updated.dateTime },
    });

    const phone = updated.client.whatsapp || updated.client.phone || '';
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    const formattedDate = dateTime.toLocaleDateString('pt-BR');
    const formattedTime = dateTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const serviceNames = services.map((s) => s.name);
    const waLink = waLinkScheduleUpdate(phone, updated.client.name, formattedDate, formattedTime, serviceNames, tenant?.name || 'Estética');

    res.json({ ...updated, waUpdateLink: waLink });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.errors[0].message });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'Erro ao atualizar agendamento' });
  }
});

// PATCH /api/schedules/:id/status — todos os roles
schedulesRouter.patch('/:id/status', async (req, res) => {
  const validStatuses = ['scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'];
  const { status } = req.body;

  if (!validStatuses.includes(status)) {
    res.status(400).json({ error: 'Status inválido' });
    return;
  }

  const schedule = await prisma.schedule.findFirst({
    where: { id: String(req.params.id), tenantId: req.user!.tenantId },
  });
  if (!schedule) {
    res.status(404).json({ error: 'Agendamento não encontrado' });
    return;
  }

  const updated = await prisma.schedule.update({
    where: { id: String(req.params.id) },
    data: { status },
    include: { client: true, vehicle: true, services: { include: { service: true } } },
  });

  await audit.log({
    tenantId: req.user!.tenantId,
    userId: req.user!.userId,
    action: 'STATUS_CHANGE',
    entity: 'schedule',
    entityId: updated.id,
    details: { from: schedule.status, to: status },
  });

  res.json(updated);
});

// POST /api/schedules/:id/to-service-order — admin e atendente
schedulesRouter.post('/:id/to-service-order', requireRole('admin', 'attendant'), async (req, res) => {
  const tenantId = req.user!.tenantId;

  const schedule = await prisma.schedule.findFirst({
    where: { id: String(req.params.id), tenantId },
    include: {
      client: true,
      vehicle: true,
      services: { include: { service: true } },
    },
  });

  if (!schedule) {
    res.status(404).json({ error: 'Agendamento não encontrado' });
    return;
  }

  const last = await prisma.serviceOrder.findFirst({
    where: { tenantId },
    orderBy: { number: 'desc' },
    select: { number: true },
  });
  const number = (last?.number ?? 0) + 1;

  const finalValue = schedule.services.reduce((acc, sv) => acc + sv.price, 0);

  const order = await prisma.serviceOrder.create({
    data: {
      tenantId,
      clientId: schedule.clientId,
      vehicleId: schedule.vehicleId,
      userId: req.user!.userId,
      number,
      finalValue,
      notes: schedule.notes ?? undefined,
      status: 'open',
    },
    include: { client: true, vehicle: true },
  });

  await prisma.schedule.update({
    where: { id: schedule.id },
    data: { status: 'in_progress' },
  });

  await audit.log({
    tenantId,
    userId: req.user!.userId,
    action: 'CREATE',
    entity: 'service_order',
    entityId: order.id,
    details: { fromSchedule: schedule.id, number: order.number },
  });

  res.status(201).json(order);
});

// DELETE /api/schedules/:id — somente admin
schedulesRouter.delete('/:id', requireRole('admin'), async (req, res) => {
  const schedule = await prisma.schedule.findFirst({
    where: { id: String(req.params.id), tenantId: req.user!.tenantId },
  });
  if (!schedule) {
    res.status(404).json({ error: 'Agendamento não encontrado' });
    return;
  }

  await audit.log({
    tenantId: req.user!.tenantId,
    userId: req.user!.userId,
    action: 'DELETE',
    entity: 'schedule',
    entityId: schedule.id,
    details: { dateTime: schedule.dateTime, status: schedule.status },
  });

  await prisma.scheduleService.deleteMany({ where: { scheduleId: schedule.id } });
  await prisma.schedule.delete({ where: { id: String(req.params.id) } });
  res.json({ message: 'Agendamento removido' });
});
