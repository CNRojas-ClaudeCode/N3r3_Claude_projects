import { prisma } from './prisma';

export const resetTokensRepo = {
  create: (data: { tokenHash: string; userId: string; expiresAt: Date }) => prisma.passwordResetToken.create({ data }),

  /** Invalida (marca como usados) los tokens pendientes del usuario. */
  invalidateForUser: (userId: string, now: Date) =>
    prisma.passwordResetToken.updateMany({ where: { userId, usedAt: null }, data: { usedAt: now } }),

  findValid: (tokenHash: string, now: Date) =>
    prisma.passwordResetToken.findFirst({
      where: { tokenHash, usedAt: null, expiresAt: { gt: now } },
      include: { user: true },
    }),

  /** Consume el token de forma atómica: devuelve true solo para el primer uso. */
  consume: async (id: string, now: Date) => {
    const result = await prisma.passwordResetToken.updateMany({ where: { id, usedAt: null }, data: { usedAt: now } });
    return result.count === 1;
  },

  deleteExpired: (now: Date) =>
    prisma.passwordResetToken.deleteMany({ where: { OR: [{ expiresAt: { lt: now } }, { usedAt: { not: null } }] } }),
};
