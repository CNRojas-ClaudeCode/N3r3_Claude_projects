import { clientsRepo, invoicesRepo, type User } from '../data';
import { badRequest, conflict, notFound } from '../lib/http';
import { audit, AuditAction } from './audit.service';

const DAY_MS = 24 * 60 * 60 * 1000;

export type PaymentMethod = 'EFECTIVO' | 'TARJETA' | 'TRANSFERENCIA';

export type InvoiceInput = {
  clientId: string;
  paymentType: 'CONTADO' | 'CREDITO';
  paymentMethod?: PaymentMethod;
  notes?: string | null;
  items: { productId: string; quantity: number }[];
};

export type PaymentInput = {
  amountCents?: number;
  method: PaymentMethod;
  reference?: string | null;
};

const actorOf = (user: User) => ({ id: user.id, name: user.name });

export const createInvoice = async (input: InvoiceInput, actor: User, now = new Date()) => {
  const client = await clientsRepo.findById(input.clientId);
  if (!client) throw notFound('Cliente no encontrado');
  if (!client.active) throw conflict('El cliente está inactivo');
  if (input.paymentType === 'CONTADO' && !input.paymentMethod) {
    throw badRequest('Indique el método de pago', 'PAYMENT_METHOD_REQUIRED');
  }
  return invoicesRepo.create({
    clientId: client.id,
    paymentType: input.paymentType,
    // El vencimiento de una factura a crédito se calcula con los días de crédito del cliente
    dueDate: input.paymentType === 'CREDITO' ? new Date(now.getTime() + client.creditDays * DAY_MS) : null,
    notes: input.notes ?? null,
    createdBy: actorOf(actor),
    items: input.items,
    paymentMethod: input.paymentMethod ?? 'EFECTIVO',
  });
};

/** Anulación: la factura deja de contar en ventas y cartera, se devuelven existencias y queda en bitácora. */
export const voidInvoice = async (id: string, reason: string, ctx: { actor: User; ip: string }) => {
  const current = await invoicesRepo.findById(id);
  if (!current) throw notFound('Factura no encontrada');
  const invoice = await invoicesRepo.void(id, { voidedById: ctx.actor.id, reason, at: new Date() });
  await audit(AuditAction.INVOICE_VOIDED, {
    actor: ctx.actor,
    ip: ctx.ip,
    targetType: 'Invoice',
    targetId: id,
    details: {
      folio: current.folio,
      client: current.client.name,
      totalCents: current.totalCents,
      paidCents: current.totalCents - current.balanceCents,
      reason,
    },
  });
  return invoice;
};

export const registerPayment = (invoiceId: string, kind: 'PAGO' | 'ABONO', input: PaymentInput, actor: User) => {
  if (kind === 'ABONO' && !input.amountCents) throw badRequest('Indique el monto del abono');
  return invoicesRepo.addPayment({
    invoiceId,
    kind,
    amountCents: input.amountCents ?? 0,
    method: input.method,
    reference: input.reference ?? null,
    createdBy: actorOf(actor),
  });
};
