import type { Prisma } from '@prisma/client';
import { prisma } from './prisma';

export type AuditEntryInput = {
  action: string;
  actorId?: string | null;
  actorEmail?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  ip?: string | null;
  details?: Record<string, unknown> | null;
};

/** La bitácora solo admite inserción y lectura. La base de datos bloquea UPDATE y DELETE dentro de la retención. */
export const auditRepo = {
  create: (entry: AuditEntryInput) =>
    prisma.auditLog.create({
      data: { ...entry, details: entry.details ? JSON.stringify(entry.details) : null },
    }),

  list: async (params: { action?: string; from?: Date; to?: Date; skip: number; take: number }) => {
    const where: Prisma.AuditLogWhereInput = {
      ...(params.action ? { action: params.action } : {}),
      ...(params.from || params.to
        ? { createdAt: { ...(params.from ? { gte: params.from } : {}), ...(params.to ? { lte: params.to } : {}) } }
        : {}),
    };
    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip: params.skip, take: params.take }),
      prisma.auditLog.count({ where }),
    ]);
    return { items, total };
  },

  /** Política de retención: elimina únicamente registros anteriores a `before`. */
  purgeOlderThan: (before: Date) => prisma.auditLog.deleteMany({ where: { createdAt: { lt: before } } }),
};
