import { Router } from 'express';
import { z } from 'zod';
import { can } from '../auth/permissions';
import { trainingRepo } from '../data';
import { idParamSchema, optionalSearch, paginationSchema } from '../lib/validation';
import { notFound } from '../lib/http';
import { currentUser, requirePermission } from '../middleware/auth';
import { toTrainingDto } from '../services/serializers';

export const trainingRouter = Router();

const trainingSchema = z
  .object({
    title: z
      .string({ message: 'El título es obligatorio' })
      .trim()
      .min(3, { message: 'El título debe tener al menos 3 caracteres' })
      .max(120, { message: 'El título es demasiado largo' }),
    category: z
      .string({ message: 'La categoría es obligatoria' })
      .trim()
      .min(2, { message: 'La categoría es obligatoria' })
      .max(60, { message: 'La categoría es demasiado larga' }),
    description: z
      .string()
      .trim()
      .max(300, { message: 'La descripción es demasiado larga' })
      .nullish()
      .transform((v) => (v ? v : null)),
    content: z
      .string({ message: 'El contenido es obligatorio' })
      .trim()
      .min(1, { message: 'El contenido es obligatorio' })
      .max(10_000, { message: 'El contenido es demasiado largo' }),
    // Solo enlaces https: evita esquemas como javascript: o data:
    url: z
      .union([
        z.literal(''),
        z
          .string()
          .trim()
          .max(500, { message: 'El enlace es demasiado largo' })
          .url({ message: 'Enlace inválido' })
          .refine((v) => v.startsWith('https://'), { message: 'El enlace debe iniciar con https://' }),
      ])
      .nullish()
      .transform((v) => (v ? v : null)),
    active: z.boolean().optional(),
  })
  .strict();

/** Quien solo puede ver capacitación recibe únicamente el material activo. */
const onlyActiveFor = (role: string) => !can(role, 'training.manage');

trainingRouter.get('/', requirePermission('training.view'), async (req, res) => {
  const q = paginationSchema.extend({ search: optionalSearch, category: z.string().trim().max(60).optional() }).parse(req.query);
  const onlyActive = onlyActiveFor(currentUser(req).role);
  const [{ items, total }, categories] = await Promise.all([
    trainingRepo.list({
      search: q.search,
      category: q.category || undefined,
      active: onlyActive ? true : undefined,
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
    }),
    trainingRepo.categories(onlyActive),
  ]);
  res.json({ items: items.map(toTrainingDto), total, page: q.page, pageSize: q.pageSize, categories });
});

trainingRouter.get('/:id', requirePermission('training.view'), async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const material = await trainingRepo.findById(id);
  if (!material || (!material.active && onlyActiveFor(currentUser(req).role))) {
    throw notFound('Material no encontrado');
  }
  res.json(toTrainingDto(material));
});

trainingRouter.post('/', requirePermission('training.manage'), async (req, res) => {
  const input = trainingSchema.parse(req.body);
  const material = await trainingRepo.create({ ...input, active: input.active ?? true });
  res.status(201).json(toTrainingDto(material));
});

trainingRouter.patch('/:id', requirePermission('training.manage'), async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const input = trainingSchema.partial().parse(req.body);
  if (!(await trainingRepo.findById(id))) throw notFound('Material no encontrado');
  res.json(toTrainingDto(await trainingRepo.update(id, input)));
});
