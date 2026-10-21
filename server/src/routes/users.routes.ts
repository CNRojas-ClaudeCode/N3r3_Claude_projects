import { Router } from 'express';
import { z } from 'zod';
import { usersRepo } from '../data';
import {
  emailSchema,
  idParamSchema,
  nameSchema,
  optionalSearch,
  paginationSchema,
  passwordSchema,
  roleSchema,
} from '../lib/validation';
import { clientInfo, currentUser, requirePermission } from '../middleware/auth';
import { toUserDto } from '../services/serializers';
import * as usersService from '../services/users.service';
import { notFound } from '../lib/http';

export const usersRouter = Router();

usersRouter.use(requirePermission('users.manage'));

const ctx = (req: Parameters<typeof currentUser>[0]) => ({ actor: currentUser(req), ip: clientInfo(req).ip });

usersRouter.get('/', async (req, res) => {
  const q = paginationSchema.extend({ search: optionalSearch, role: roleSchema.optional() }).parse(req.query);
  const { items, total } = await usersRepo.list({
    search: q.search,
    role: q.role,
    skip: (q.page - 1) * q.pageSize,
    take: q.pageSize,
  });
  const now = new Date();
  res.json({ items: items.map((u) => toUserDto(u, now)), total, page: q.page, pageSize: q.pageSize });
});

usersRouter.get('/:id', async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const user = await usersRepo.findById(id);
  if (!user) throw notFound('Usuario no encontrado');
  res.json(toUserDto(user));
});

usersRouter.post('/', async (req, res) => {
  const input = z
    .object({ email: emailSchema, name: nameSchema, role: roleSchema, password: passwordSchema })
    .strict()
    .parse(req.body);
  const user = await usersService.createUser(input, ctx(req));
  res.status(201).json(toUserDto(user));
});

usersRouter.patch('/:id', async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const input = z
    .object({
      email: emailSchema.optional(),
      name: nameSchema.optional(),
      role: roleSchema.optional(),
      active: z.boolean().optional(),
    })
    .strict()
    .parse(req.body);
  const user = await usersService.updateUser(id, input, ctx(req));
  res.json(toUserDto(user));
});

usersRouter.post('/:id/unlock', async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const user = await usersService.unlockUser(id, ctx(req));
  res.json(toUserDto(user));
});
