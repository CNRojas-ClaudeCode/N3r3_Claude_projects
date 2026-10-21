import { Router } from 'express';
import { z } from 'zod';
import { clientsRepo } from '../data';
import { emailSchema, idParamSchema, nameSchema, optionalSearch, paginationSchema } from '../lib/validation';
import { notFound } from '../lib/http';
import { requirePermission } from '../middleware/auth';
import * as clientsService from '../services/clients.service';
import { toClientDto } from '../services/serializers';

export const clientsRouter = Router();

const MAX_CREDIT_DAYS = 365;

/** Cadena opcional: vacía se guarda como null. */
const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, { message })
    .nullish()
    .transform((v) => (v ? v : null));

const clientSchema = z
  .object({
    name: nameSchema,
    taxId: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^([A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3})?$/, { message: 'RFC inválido (12 o 13 caracteres)' })
      .nullish()
      .transform((v) => (v ? v : null)),
    phone: z
      .string()
      .trim()
      .regex(/^[0-9+()\s-]{0,20}$/, { message: 'Teléfono inválido' })
      .nullish()
      .transform((v) => (v ? v : null)),
    email: z
      .union([z.literal(''), emailSchema])
      .nullish()
      .transform((v) => (v ? v : null)),
    address: optionalText(250, 'La dirección es demasiado larga'),
    creditDays: z
      .number({ message: 'Días de crédito inválidos' })
      .int({ message: 'Días de crédito inválidos' })
      .min(0, { message: 'Los días de crédito no pueden ser negativos' })
      .max(MAX_CREDIT_DAYS, { message: `Máximo ${MAX_CREDIT_DAYS} días de crédito` })
      .optional(),
    active: z.boolean().optional(),
  })
  .strict();

clientsRouter.get('/', requirePermission('clients.view'), async (req, res) => {
  const q = paginationSchema
    .extend({ search: optionalSearch, active: z.enum(['true', 'false']).optional() })
    .parse(req.query);
  const { items, total } = await clientsRepo.list({
    search: q.search,
    active: q.active === undefined ? undefined : q.active === 'true',
    skip: (q.page - 1) * q.pageSize,
    take: q.pageSize,
  });
  res.json({ items: items.map(toClientDto), total, page: q.page, pageSize: q.pageSize });
});

clientsRouter.get('/:id', requirePermission('clients.view'), async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const client = await clientsRepo.findById(id);
  if (!client) throw notFound('Cliente no encontrado');
  res.json(toClientDto(client));
});

clientsRouter.post('/', requirePermission('clients.create'), async (req, res) => {
  const client = await clientsService.createClient(clientSchema.parse(req.body));
  res.status(201).json(toClientDto(client));
});

clientsRouter.patch('/:id', requirePermission('clients.update'), async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const client = await clientsService.updateClient(id, clientSchema.partial().parse(req.body));
  res.json(toClientDto(client));
});
