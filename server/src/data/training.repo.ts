import type { Prisma, TrainingMaterial } from '@prisma/client';
import { prisma } from './prisma';

export type { TrainingMaterial };

export const trainingRepo = {
  findById: (id: string) => prisma.trainingMaterial.findUnique({ where: { id } }),

  create: (data: Prisma.TrainingMaterialCreateInput) => prisma.trainingMaterial.create({ data }),

  update: (id: string, data: Prisma.TrainingMaterialUpdateInput) =>
    prisma.trainingMaterial.update({ where: { id }, data }),

  list: async (params: { search?: string; category?: string; active?: boolean; skip: number; take: number }) => {
    const where: Prisma.TrainingMaterialWhereInput = {
      ...(params.active !== undefined ? { active: params.active } : {}),
      ...(params.category ? { category: params.category } : {}),
      ...(params.search
        ? { OR: [{ title: { contains: params.search } }, { description: { contains: params.search } }] }
        : {}),
    };
    const [items, total] = await Promise.all([
      prisma.trainingMaterial.findMany({
        where,
        orderBy: [{ category: 'asc' }, { title: 'asc' }],
        skip: params.skip,
        take: params.take,
      }),
      prisma.trainingMaterial.count({ where }),
    ]);
    return { items, total };
  },

  categories: async (onlyActive: boolean) => {
    const rows = await prisma.trainingMaterial.findMany({
      where: onlyActive ? { active: true } : {},
      distinct: ['category'],
      select: { category: true },
      orderBy: { category: 'asc' },
    });
    return rows.map((r) => r.category);
  },
};
