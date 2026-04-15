import { prisma } from './prisma';

interface AuditLogParams {
  tenantId: string;
  userId?: string;
  userName?: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'STATUS_CHANGE' | 'LOGIN' | 'LOGOUT';
  entity: string;
  entityId?: string;
  details?: Record<string, unknown>;
}

export async function log(params: AuditLogParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        tenantId: params.tenantId,
        userId: params.userId,
        userName: params.userName,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId,
        details: params.details ? JSON.stringify(params.details) : null,
      },
    });
  } catch {
    // Audit log nunca deve quebrar a operação principal
    console.error('[AuditLog] Erro ao registrar:', params);
  }
}
