import { prisma } from './prisma';

export const sessionsRepo = {
  create: (data: { tokenHash: string; userId: string; expiresAt: Date; ip?: string; userAgent?: string }) =>
    prisma.session.create({ data }),

  findByTokenHash: (tokenHash: string) =>
    prisma.session.findUnique({ where: { tokenHash }, include: { user: true } }),

  touch: (id: string, at: Date) => prisma.session.update({ where: { id }, data: { lastUsedAt: at } }),

  deleteById: (id: string) => prisma.session.deleteMany({ where: { id } }),

  deleteByTokenHash: (tokenHash: string) => prisma.session.deleteMany({ where: { tokenHash } }),

  deleteAllForUser: (userId: string) => prisma.session.deleteMany({ where: { userId } }),

  deleteExpired: (now: Date) => prisma.session.deleteMany({ where: { expiresAt: { lt: now } } }),
};
