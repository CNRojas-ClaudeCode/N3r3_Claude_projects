import { Router } from 'express';
import { z } from 'zod';
import { productsRepo } from '../data';
import { idParamSchema, optionalSearch, paginationSchema } from '../lib/validation';
import { notFound } from '../lib/http';
import { clientInfo, currentUser, requirePermission } from '../middleware/auth';
import * as productsService from '../services/products.service';
import { toProductDto } from '../services/serializers';

export const productsRouter = Router();

const MAX_PRICE_CENTS = 100_000_000_00;
const MAX_STOCK = 1_000_000;

const productTypeSchema = z.enum(['PRODUCTO', 'SERVICIO'], { message: 'Tipo inválido' });

const productSchema = z
  .object({
    code: z
      .string({ message: 'El código es obligatorio' })
      .trim()
      .toUpperCase()
      .min(1, { message: 'El código es obligatorio' })
      .max(30, { message: 'El código admite máximo 30 caracteres' })
      .regex(/^[A-Z0-9-]+$/, { message: 'El código solo admite letras, números y guiones' }),
    name: z
      .string({ message: 'El nombre es obligatorio' })
      .trim()
      .min(2, { message: 'El nombre debe tener al menos 2 caracteres' })
      .max(120, { message: 'El nombre es demasiado largo' }),
    description: z.string().trim().max(500, { message: 'La descripción es demasiado larga' }).nullish(),
    type: productTypeSchema,
    priceCents: z
      .number({ message: 'El precio es obligatorio' })
      .int({ message: 'Precio inválido' })
      .min(0, { message: 'El precio no puede ser negativo' })
      .max(MAX_PRICE_CENTS, { message: 'Precio fuera de rango' }),
    stock: z
      .number()
      .int({ message: 'Las existencias deben ser un número entero' })
      .min(0, { message: 'Las existencias no pueden ser negativas' })
      .max(MAX_STOCK, { message: 'Existencias fuera de rango' })
      .nullish(),
    active: z.boolean().optional(),
  })
  .strict();

productsRouter.get('/', requirePermission('products.view'), async (req, res) => {
  const q = paginationSchema
    .extend({
      search: optionalSearch,
      type: productTypeSchema.optional(),
      active: z.enum(['true', 'false']).optional(),
    })
    .parse(req.query);
  const { items, total } = await productsRepo.list({
    search: q.search,
    type: q.type,
    active: q.active === undefined ? undefined : q.active === 'true',
    skip: (q.page - 1) * q.pageSize,
    take: q.pageSize,
  });
  res.json({ items: items.map(toProductDto), total, page: q.page, pageSize: q.pageSize });
});

productsRouter.get('/:id', requirePermission('products.view'), async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const product = await productsRepo.findById(id);
  if (!product) throw notFound('Producto no encontrado');
  res.json(toProductDto(product));
});

productsRouter.post('/', requirePermission('products.create'), async (req, res) => {
  const product = await productsService.createProduct(productSchema.parse(req.body));
  res.status(201).json(toProductDto(product));
});

productsRouter.patch('/:id', requirePermission('products.update'), async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const product = await productsService.updateProduct(id, productSchema.partial().parse(req.body));
  res.json(toProductDto(product));
});

productsRouter.delete('/:id', requirePermission('products.delete'), async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  await productsService.deleteProduct(id, { actor: currentUser(req), ip: clientInfo(req).ip });
  res.status(204).end();
});
