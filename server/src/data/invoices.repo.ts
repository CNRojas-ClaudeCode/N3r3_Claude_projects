import { Prisma, type Invoice, type InvoiceItem, type Payment } from '@prisma/client';
import { conflict, notFound } from '../lib/http';
import { prisma } from './prisma';

export type { Invoice, InvoiceItem, Payment };

export type InvoiceWithRelations = Invoice & {
  client: { id: string; name: string; taxId: string | null };
  items: InvoiceItem[];
  payments: Payment[];
};

export type NewInvoice = {
  clientId: string;
  paymentType: 'CONTADO' | 'CREDITO';
  dueDate: Date | null;
  notes: string | null;
  createdBy: { id: string; name: string };
  items: { productId: string; quantity: number }[];
  /** Método del pago automático de una factura de contado */
  paymentMethod: string;
};

export type NewPayment = {
  invoiceId: string;
  kind: 'PAGO' | 'ABONO';
  /** Para PAGO se ignora: siempre liquida el saldo */
  amountCents: number;
  method: string;
  reference: string | null;
  createdBy: { id: string; name: string };
};

const withRelations = {
  client: { select: { id: true, name: true, taxId: true } },
  items: true,
  payments: { orderBy: { createdAt: 'asc' } },
} satisfies Prisma.InvoiceInclude;

const MAX_FOLIO_RETRIES = 3;

const isUniqueViolation = (err: unknown) =>
  err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';

/** Pendientes de cobro: vigentes con saldo. */
const receivableWhere = { status: 'VIGENTE', balanceCents: { gt: 0 } } satisfies Prisma.InvoiceWhereInput;

export const invoicesRepo = {
  findById: (id: string) => prisma.invoice.findUnique({ where: { id }, include: withRelations }),

  /**
   * Crea la factura en una sola transacción: asigna folio consecutivo, toma precio y nombre vigentes
   * de cada producto, descuenta existencias (sin permitir negativos) y, si es de contado, registra el pago.
   */
  create: async (input: NewInvoice): Promise<InvoiceWithRelations> => {
    for (let attempt = 1; ; attempt++) {
      try {
        return await prisma.$transaction(async (tx) => {
          const products = await tx.product.findMany({
            where: { id: { in: input.items.map((i) => i.productId) }, deletedAt: null },
          });
          const byId = new Map(products.map((p) => [p.id, p]));

          const lines = input.items.map((item) => {
            const product = byId.get(item.productId);
            if (!product) throw notFound('Producto no encontrado');
            if (!product.active) throw conflict(`El producto "${product.name}" está inactivo`);
            return {
              productId: product.id,
              code: product.code,
              name: product.name,
              productType: product.type,
              quantity: item.quantity,
              unitPriceCents: product.priceCents,
              lineTotalCents: product.priceCents * item.quantity,
            };
          });

          for (const line of lines) {
            if (line.productType !== 'PRODUCTO') continue;
            const { count } = await tx.product.updateMany({
              where: { id: line.productId, stock: { gte: line.quantity } },
              data: { stock: { decrement: line.quantity } },
            });
            if (count === 0) throw conflict(`Existencias insuficientes de "${line.name}"`);
          }

          const totalCents = lines.reduce((sum, l) => sum + l.lineTotalCents, 0);
          const last = await tx.invoice.findFirst({ orderBy: { folio: 'desc' }, select: { folio: true } });
          const isCash = input.paymentType === 'CONTADO';

          return tx.invoice.create({
            data: {
              folio: (last?.folio ?? 0) + 1,
              client: { connect: { id: input.clientId } },
              paymentType: input.paymentType,
              totalCents,
              balanceCents: isCash ? 0 : totalCents,
              dueDate: input.dueDate,
              notes: input.notes,
              createdById: input.createdBy.id,
              createdByName: input.createdBy.name,
              items: { create: lines },
              ...(isCash && totalCents > 0
                ? {
                    payments: {
                      create: {
                        kind: 'PAGO',
                        amountCents: totalCents,
                        method: input.paymentMethod,
                        createdById: input.createdBy.id,
                        createdByName: input.createdBy.name,
                      },
                    },
                  }
                : {}),
            },
            include: withRelations,
          });
        });
      } catch (err) {
        // Dos facturas simultáneas pueden calcular el mismo folio: se reintenta
        if (isUniqueViolation(err) && attempt < MAX_FOLIO_RETRIES) continue;
        throw err;
      }
    }
  },

  /** Anula la factura y devuelve las existencias. Solo procede si sigue vigente. */
  void: (id: string, data: { voidedById: string; reason: string; at: Date }) =>
    prisma.$transaction(async (tx) => {
      const { count } = await tx.invoice.updateMany({
        where: { id, status: 'VIGENTE' },
        data: { status: 'ANULADA', voidedAt: data.at, voidedById: data.voidedById, voidReason: data.reason },
      });
      if (count === 0) throw conflict('La factura ya está anulada');
      const items = await tx.invoiceItem.findMany({ where: { invoiceId: id, productType: 'PRODUCTO' } });
      for (const item of items) {
        await tx.product.update({ where: { id: item.productId }, data: { stock: { increment: item.quantity } } });
      }
      return tx.invoice.findUniqueOrThrow({ where: { id }, include: withRelations });
    }),

  /**
   * Registra un pago (liquida el saldo) o un abono (parcial, menor al saldo).
   * El saldo se descuenta con control de concurrencia: si cambió entre la lectura y la escritura, se rechaza.
   */
  addPayment: (input: NewPayment) =>
    prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findUnique({ where: { id: input.invoiceId } });
      if (!invoice) throw notFound('Factura no encontrada');
      if (invoice.status !== 'VIGENTE') throw conflict('La factura está anulada');
      if (invoice.balanceCents <= 0) throw conflict('La factura no tiene saldo pendiente');

      const amountCents = input.kind === 'PAGO' ? invoice.balanceCents : input.amountCents;
      if (input.kind === 'ABONO' && amountCents >= invoice.balanceCents) {
        throw conflict('El abono debe ser menor al saldo; para liquidar registre un pago');
      }

      const { count } = await tx.invoice.updateMany({
        where: { id: invoice.id, balanceCents: invoice.balanceCents, status: 'VIGENTE' },
        data: { balanceCents: { decrement: amountCents } },
      });
      if (count === 0) throw conflict('El saldo cambió; vuelva a intentarlo');

      await tx.payment.create({
        data: {
          invoiceId: invoice.id,
          kind: input.kind,
          amountCents,
          method: input.method,
          reference: input.reference,
          createdById: input.createdBy.id,
          createdByName: input.createdBy.name,
        },
      });
      return tx.invoice.findUniqueOrThrow({ where: { id: invoice.id }, include: withRelations });
    }),

  list: async (params: {
    folio?: number;
    clientId?: string;
    status?: string;
    from?: Date;
    to?: Date;
    skip: number;
    take: number;
  }) => {
    const where: Prisma.InvoiceWhereInput = {
      ...(params.folio ? { folio: params.folio } : {}),
      ...(params.clientId ? { clientId: params.clientId } : {}),
      ...(params.status ? { status: params.status } : {}),
      ...(params.from || params.to
        ? { createdAt: { ...(params.from ? { gte: params.from } : {}), ...(params.to ? { lte: params.to } : {}) } }
        : {}),
    };
    const [items, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        orderBy: { folio: 'desc' },
        skip: params.skip,
        take: params.take,
        include: { client: { select: { id: true, name: true, taxId: true } } },
      }),
      prisma.invoice.count({ where }),
    ]);
    return { items, total };
  },

  /** Cartera: facturas vigentes con saldo, de la más antigua a la más reciente. */
  receivables: async (params: { clientId?: string; overdueBefore?: Date; skip: number; take: number }) => {
    const where: Prisma.InvoiceWhereInput = {
      ...receivableWhere,
      ...(params.clientId ? { clientId: params.clientId } : {}),
      ...(params.overdueBefore ? { dueDate: { lt: params.overdueBefore } } : {}),
    };
    const [items, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        orderBy: [{ dueDate: 'asc' }, { folio: 'asc' }],
        skip: params.skip,
        take: params.take,
        include: { client: { select: { id: true, name: true, taxId: true } } },
      }),
      prisma.invoice.count({ where }),
    ]);
    return { items, total };
  },

  receivablesSummary: async (now: Date) => {
    const [all, overdue, byClient] = await Promise.all([
      prisma.invoice.aggregate({ where: receivableWhere, _sum: { balanceCents: true }, _count: true }),
      prisma.invoice.aggregate({
        where: { ...receivableWhere, dueDate: { lt: now } },
        _sum: { balanceCents: true },
        _count: true,
      }),
      prisma.invoice.groupBy({
        by: ['clientId'],
        where: receivableWhere,
        _sum: { balanceCents: true },
        _count: true,
        orderBy: { _sum: { balanceCents: 'desc' } },
        take: 10,
      }),
    ]);
    const clients = await prisma.client.findMany({
      where: { id: { in: byClient.map((c) => c.clientId) } },
      select: { id: true, name: true },
    });
    const names = new Map(clients.map((c) => [c.id, c.name]));
    return {
      totalCents: all._sum.balanceCents ?? 0,
      invoices: all._count,
      overdueCents: overdue._sum.balanceCents ?? 0,
      overdueInvoices: overdue._count,
      topClients: byClient.map((c) => ({
        clientId: c.clientId,
        name: names.get(c.clientId) ?? '—',
        balanceCents: c._sum.balanceCents ?? 0,
        invoices: c._count,
      })),
    };
  },

  salesSince: async (since: Date) => {
    const result = await prisma.invoice.aggregate({
      where: { status: 'VIGENTE', createdAt: { gte: since } },
      _sum: { totalCents: true },
      _count: true,
    });
    return { totalCents: result._sum.totalCents ?? 0, invoices: result._count };
  },

  recent: (take: number) =>
    prisma.invoice.findMany({
      orderBy: { folio: 'desc' },
      take,
      include: { client: { select: { id: true, name: true, taxId: true } } },
    }),
};
