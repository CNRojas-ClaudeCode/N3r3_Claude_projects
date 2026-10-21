import { prisma } from './prisma';

export const throttleRepo = {
  get: (ip: string) => prisma.ipLoginThrottle.findUnique({ where: { ip } }),

  /** Incrementa el contador; si el bloqueo anterior ya venció, reinicia a 1. */
  registerFailure: async (ip: string, now: Date) => {
    const current = await prisma.ipLoginThrottle.findUnique({ where: { ip } });
    const expired = current?.lockedUntil != null && current.lockedUntil <= now;
    if (!current) {
      return prisma.ipLoginThrottle.create({ data: { ip, failedAttempts: 1 } });
    }
    if (expired) {
      return prisma.ipLoginThrottle.update({ where: { ip }, data: { failedAttempts: 1, lockedUntil: null } });
    }
    return prisma.ipLoginThrottle.update({ where: { ip }, data: { failedAttempts: { increment: 1 } } });
  },

  lock: (ip: string, until: Date) => prisma.ipLoginThrottle.update({ where: { ip }, data: { lockedUntil: until } }),

  reset: (ip: string) => prisma.ipLoginThrottle.deleteMany({ where: { ip } }),
};
