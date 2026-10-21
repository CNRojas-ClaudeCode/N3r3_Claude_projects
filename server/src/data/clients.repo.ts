import type { Client, Prisma } from '@prisma/client';
import { prisma } from './prisma';

export type { Client };

export const clientsRepo = {
  findById: (id: string) => prisma.client.findUnique({ where: { id } }),

  findByTaxId: (taxId: string) => prisma.client.findUnique({ where: { taxId } }),

  create: (data: Prisma.ClientCreateInput) => prisma.client.create({ data }),

  update: (id: string, data: Prisma.ClientUpdateInput) => prisma.client.update({ where: { id }, data }),

  list: async (params: { search?: string; active?: boolean; skip: number; take: number }) => {
    const where: Prisma.ClientWhereInput = {
      ...(params.active !== undefined ? { active: params.active } : {}),
      ...(params.search
        ? {
            OR: [
              { name: { contains: params.search } },
              { taxId: { contains: params.search.toUpperCase() } },
              { phone: { contains: params.search } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      prisma.client.findMany({ where, orderBy: { name: 'asc' }, skip: params.skip, take: params.take }),
      prisma.client.count({ where }),
    ]);
    return { items, total };
  },
};
