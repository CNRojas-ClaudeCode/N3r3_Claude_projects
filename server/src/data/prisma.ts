import { PrismaClient } from '@prisma/client';

/**
 * Único punto de conexión a la base de datos. Ningún módulo fuera de `src/data`
 * debe importar Prisma directamente: así la migración a PostgreSQL queda acotada a esta capa.
 */
export const prisma = new PrismaClient({ log: ['error'] });

export const pingDatabase = async () => {
  await prisma.$queryRaw`SELECT 1`;
};

export const disconnectDatabase = () => prisma.$disconnect();
