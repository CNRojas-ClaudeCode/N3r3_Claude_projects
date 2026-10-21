import { Router } from 'express';
import { z } from 'zod';
import { config } from '../config';
import { invoicesRepo } from '../data';
import { idParamSchema, paginationSchema } from '../lib/validation';
import { notFound } from '../lib/http';
import { clientInfo, currentUser, requirePermission } from '../middleware/auth';
import * as invoicesService from '../services/invoices.service';
import { toInvoiceDto, toInvoiceSummaryDto } from '../services/serializers';

export const invoicesRouter = Router();

const MAX_QUANTITY = 10_000;
const MAX_AMOUNT_CENTS = 100_000_000_00;

const paymentMethodSchema = z.enum(['EFECTIVO', 'TARJETA', 'TRANSFERENCIA'], { message: 'Método de pago inválido' });

const referenceSchema = z
  .string()
  .trim()
  .max(80, { message: 'La referencia es demasiado larga' })
  .nullish()
  .transform((v) => (v ? v : null));

const invoiceSchema = z
  .object({
    clientId: z.string({ message: 'Seleccione un cliente' }).min(1, { message: 'Seleccione un cliente' }).max(64),
    paymentType: z.enum(['CONTADO', 'CREDITO'], { message: 'Tipo de pago inválido' }),
    paymentMethod: paymentMethodSchema.optional(),
    notes: z
      .string()
      .trim()
      .max(300, { message: 'Las notas son demasiado largas' })
      .nullish()
      .transform((v) => (v ? v : null)),
    items: z
      .array(
        z
          .object({
            productId: z.string().min(1).max(64),
            quantity: z
              .number({ message: 'Cantidad inválida' })
              .int({ message: 'La cantidad debe ser un número entero' })
              .min(1, { message: 'La cantidad mínima es 1' })
              .max(MAX_QUANTITY, { message: 'Cantidad fuera de rango' }),
          })
          .strict(),
        { message: 'Agregue al menos un producto' },
      )
      .min(1, { message: 'Agregue al menos un producto' })
      .max(config.business.maxInvoiceItems, { message: `Máximo ${config.business.maxInvoiceItems} partidas` })
      .refine((items) => new Set(items.map((i) => i.productId)).size === items.length, {
        message: 'Hay productos repetidos; ajuste la cantidad en una sola partida',
      }),
  })
  .strict();

const voidSchema = z
  .object({
    reason: z
      .string({ message: 'Indique el motivo de la anulación' })
      .trim()
      .min(5, { message: 'El motivo debe tener al menos 5 caracteres' })
      .max(300, { message: 'El motivo es demasiado largo' }),
  })
  .strict();

const paymentSchema = z.object({ method: paymentMethodSchema, reference: referenceSchema }).strict();

const installmentSchema = paymentSchema
  .extend({
    amountCents: z
      .number({ message: 'Indique el monto del abono' })
      .int({ message: 'Monto inválido' })
      .min(1, { message: 'El abono debe ser mayor a cero' })
      .max(MAX_AMOUNT_CENTS, { message: 'Monto fuera de rango' }),
  })
  .strict();

invoicesRouter.get('/', requirePermission('invoices.view'), async (req, res) => {
  const q = paginationSchema
    .extend({
      folio: z.coerce.number().int().min(1).optional(),
      clientId: z.string().min(1).max(64).optional(),
      status: z.enum(['VIGENTE', 'ANULADA']).optional(),
      from: z.coerce.date().optional(),
      to: z.coerce.date().optional(),
    })
    .parse(req.query);
  const { items, total } = await invoicesRepo.list({
    folio: q.folio,
    clientId: q.clientId,
    status: q.status,
    from: q.from,
    to: q.to,
    skip: (q.page - 1) * q.pageSize,
    take: q.pageSize,
  });
  const now = new Date();
  res.json({ items: items.map((i) => toInvoiceSummaryDto(i, now)), total, page: q.page, pageSize: q.pageSize });
});

invoicesRouter.get('/:id', requirePermission('invoices.view'), async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const invoice = await invoicesRepo.findById(id);
  if (!invoice) throw notFound('Factura no encontrada');
  res.json(toInvoiceDto(invoice));
});

invoicesRouter.post('/', requirePermission('invoices.create'), async (req, res) => {
  const invoice = await invoicesService.createInvoice(invoiceSchema.parse(req.body), currentUser(req));
  res.status(201).json(toInvoiceDto(invoice));
});

invoicesRouter.post('/:id/void', requirePermission('invoices.void'), async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const { reason } = voidSchema.parse(req.body);
  const invoice = await invoicesService.voidInvoice(id, reason, { actor: currentUser(req), ip: clientInfo(req).ip });
  res.json(toInvoiceDto(invoice));
});

/** Pago: liquida el saldo completo. */
invoicesRouter.post('/:id/payments', requirePermission('payments.create'), async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const invoice = await invoicesService.registerPayment(id, 'PAGO', paymentSchema.parse(req.body), currentUser(req));
  res.status(201).json(toInvoiceDto(invoice));
});

/** Abono: pago parcial menor al saldo. */
invoicesRouter.post('/:id/installments', requirePermission('installments.create'), async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const invoice = await invoicesService.registerPayment(
    id,
    'ABONO',
    installmentSchema.parse(req.body),
    currentUser(req),
  );
  res.status(201).json(toInvoiceDto(invoice));
});
