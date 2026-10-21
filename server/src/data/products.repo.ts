import type { Prisma, Product } from '@prisma/client';
import { prisma } from './prisma';

export type { Product };

const notDeleted = { deletedAt: null } satisfies Prisma.ProductWhereInput;

export const productsRepo = {
  findById: (id: string) => prisma.product.findFirst({ where: { id, ...notDeleted } }),

  findByCode: (code: string) => prisma.product.findUnique({ where: { code } }),

  create: (data: Prisma.ProductCreateInput) => prisma.product.create({ data }),

  update: (id: string, data: Prisma.ProductUpdateInput) => prisma.product.update({ where: { id }, data }),

  softDelete: (id: string, at: Date) => prisma.product.update({ where: { id }, data: { deletedAt: at, active: false } }),

  list: async (params: { search?: string; type?: string; active?: boolean; skip: number; take: number }) => {
    const where: Prisma.ProductWhereInput = {
      ...notDeleted,
      ...(params.type ? { type: params.type } : {}),
      ...(params.active !== undefined ? { active: params.active } : {}),
      ...(params.search
        ? { OR: [{ name: { contains: params.search } }, { code: { contains: params.search.toUpperCase() } }] }
        : {}),
    };
    const [items, total] = await Promise.all([
      prisma.product.findMany({ where, orderBy: { name: 'asc' }, skip: params.skip, take: params.take }),
      prisma.product.count({ where }),
    ]);
    return { items, total };
  },

  stats: async (lowStockThreshold: number) => {
    const lowStockWhere: Prisma.ProductWhereInput = {
      ...notDeleted,
      active: true,
      type: 'PRODUCTO',
      stock: { lte: lowStockThreshold },
    };
    const [products, services, inactive, lowStock, lowStockItems, recent] = await Promise.all([
      prisma.product.count({ where: { ...notDeleted, type: 'PRODUCTO' } }),
      prisma.product.count({ where: { ...notDeleted, type: 'SERVICIO' } }),
      prisma.product.count({ where: { ...notDeleted, active: false } }),
      prisma.product.count({ where: lowStockWhere }),
      prisma.product.findMany({ where: lowStockWhere, orderBy: { stock: 'asc' }, take: 5 }),
      prisma.product.findMany({ where: notDeleted, orderBy: { createdAt: 'desc' }, take: 5 }),
    ]);
    return { products, services, inactive, lowStock, lowStockItems, recent };
  },
};
