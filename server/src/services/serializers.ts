import type { Client, Invoice, InvoiceWithRelations, Payment, Product, TrainingMaterial, User } from '../data';
import { permissionsFor } from '../auth/permissions';

/** Representación pública de un usuario: nunca incluye hash ni contadores internos. */
export const toUserDto = (user: User, now = new Date()) => ({
  id: user.id,
  email: user.email,
  name: user.name,
  role: user.role,
  active: user.active,
  locked: user.lockedUntil != null && user.lockedUntil > now,
  mustChangePassword: user.mustChangePassword,
  lastLoginAt: user.lastLoginAt,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

export const toSessionUserDto = (user: User) => ({
  user: toUserDto(user),
  permissions: permissionsFor(user.role),
});

export const toProductDto = (p: Product) => ({
  id: p.id,
  code: p.code,
  name: p.name,
  description: p.description,
  type: p.type,
  priceCents: p.priceCents,
  stock: p.stock,
  active: p.active,
  createdAt: p.createdAt,
  updatedAt: p.updatedAt,
});

export const toClientDto = (c: Client) => ({
  id: c.id,
  name: c.name,
  taxId: c.taxId,
  phone: c.phone,
  email: c.email,
  address: c.address,
  creditDays: c.creditDays,
  active: c.active,
  createdAt: c.createdAt,
  updatedAt: c.updatedAt,
});

/** Estado de cobro derivado: ANULADA, PAGADA, VENCIDA o PENDIENTE. */
export const paymentStatus = (inv: Pick<Invoice, 'status' | 'balanceCents' | 'dueDate'>, now = new Date()) => {
  if (inv.status === 'ANULADA') return 'ANULADA';
  if (inv.balanceCents <= 0) return 'PAGADA';
  if (inv.dueDate && inv.dueDate < now) return 'VENCIDA';
  return 'PENDIENTE';
};

type InvoiceSummary = Invoice & { client: { id: string; name: string; taxId: string | null } };

export const toInvoiceSummaryDto = (inv: InvoiceSummary, now = new Date()) => ({
  id: inv.id,
  folio: inv.folio,
  client: inv.client,
  paymentType: inv.paymentType,
  status: inv.status,
  paymentStatus: paymentStatus(inv, now),
  totalCents: inv.totalCents,
  balanceCents: inv.balanceCents,
  dueDate: inv.dueDate,
  createdByName: inv.createdByName,
  createdAt: inv.createdAt,
});

export const toPaymentDto = (p: Payment) => ({
  id: p.id,
  kind: p.kind,
  amountCents: p.amountCents,
  method: p.method,
  reference: p.reference,
  createdByName: p.createdByName,
  createdAt: p.createdAt,
});

export const toInvoiceDto = (inv: InvoiceWithRelations, now = new Date()) => ({
  ...toInvoiceSummaryDto(inv, now),
  notes: inv.notes,
  voidedAt: inv.voidedAt,
  voidReason: inv.voidReason,
  items: inv.items.map((i) => ({
    id: i.id,
    productId: i.productId,
    code: i.code,
    name: i.name,
    productType: i.productType,
    quantity: i.quantity,
    unitPriceCents: i.unitPriceCents,
    lineTotalCents: i.lineTotalCents,
  })),
  payments: inv.payments.map(toPaymentDto),
});

export const toTrainingDto = (t: TrainingMaterial) => ({
  id: t.id,
  title: t.title,
  category: t.category,
  description: t.description,
  content: t.content,
  url: t.url,
  active: t.active,
  createdAt: t.createdAt,
  updatedAt: t.updatedAt,
});
