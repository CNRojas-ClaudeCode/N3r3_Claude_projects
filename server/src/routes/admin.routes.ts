import { Router } from 'express';
import { z } from 'zod';
import { auditRepo } from '../data';
import { rolesMatrix } from '../auth/permissions';
import { paginationSchema } from '../lib/validation';
import { requirePermission } from '../middleware/auth';
import { AuditAction } from '../services/audit.service';

export const rolesRouter = Router();

rolesRouter.get('/', requirePermission('roles.view'), (_req, res) => {
  res.json(rolesMatrix());
});

export const auditRouter = Router();

auditRouter.get('/', requirePermission('audit.view'), async (req, res) => {
  const q = paginationSchema
    .extend({
      action: z.enum(Object.values(AuditAction) as [string, ...string[]]).optional(),
      from: z.coerce.date().optional(),
      to: z.coerce.date().optional(),
    })
    .parse(req.query);
  const { items, total } = await auditRepo.list({
    action: q.action,
    from: q.from,
    to: q.to,
    skip: (q.page - 1) * q.pageSize,
    take: q.pageSize,
  });
  res.json({
    items: items.map((e) => ({ ...e, details: e.details ? (JSON.parse(e.details) as unknown) : null })),
    total,
    page: q.page,
    pageSize: q.pageSize,
    actions: Object.values(AuditAction),
  });
});
