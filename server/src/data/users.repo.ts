import type { Prisma, User } from '@prisma/client';
import { prisma } from './prisma';

export type { User };

export const usersRepo = {
  findById: (id: string) => prisma.user.findUnique({ where: { id } }),

  findByEmail: (email: string) => prisma.user.findUnique({ where: { email } }),

  create: (data: Prisma.UserCreateInput) => prisma.user.create({ data }),

  update: (id: string, data: Prisma.UserUpdateInput) => prisma.user.update({ where: { id }, data }),

  incrementFailedAttempts: (id: string) =>
    prisma.user.update({ where: { id }, data: { failedLoginAttempts: { increment: 1 } } }),

  resetLoginState: (id: string, data: Prisma.UserUpdateInput = {}) =>
    prisma.user.update({ where: { id }, data: { failedLoginAttempts: 0, lockedUntil: null, ...data } }),

  countActiveByRole: (role: string) => prisma.user.count({ where: { role, active: true } }),

  list: async (params: { search?: string; role?: string; skip: number; take: number }) => {
    const where: Prisma.UserWhereInput = {
      ...(params.role ? { role: params.role } : {}),
      ...(params.search
        ? { OR: [{ name: { contains: params.search } }, { email: { contains: params.search } }] }
        : {}),
    };
    const [items, total] = await Promise.all([
      prisma.user.findMany({ where, orderBy: { createdAt: 'desc' }, skip: params.skip, take: params.take }),
      prisma.user.count({ where }),
    ]);
    return { items, total };
  },

  stats: async (now: Date) => {
    const [total, active, locked] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { active: true } }),
      prisma.user.count({ where: { lockedUntil: { gt: now } } }),
    ]);
    return { total, active, locked };
  },
};
