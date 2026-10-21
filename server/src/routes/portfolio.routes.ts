import { Router } from 'express';
import { z } from 'zod';
import { invoicesRepo } from '../data';
import { paginationSchema } from '../lib/validation';
import { requirePermission } from '../middleware/auth';
import { toInvoiceSummaryDto } from '../services/serializers';

export const portfolioRouter = Router();

/** Cartera: resumen de saldos y facturas pendientes de cobro. */
portfolioRouter.get('/', requirePermission('portfolio.view'), async (req, res) => {
  const q = paginationSchema
    .extend({
      clientId: z.string().min(1).max(64).optional(),
      overdue: z.enum(['true', 'false']).optional(),
    })
    .parse(req.query);
  const now = new Date();
  const [summary, { items, total }] = await Promise.all([
    invoicesRepo.receivablesSummary(now),
    invoicesRepo.receivables({
      clientId: q.clientId,
      overdueBefore: q.overdue === 'true' ? now : undefined,
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
    }),
  ]);
  res.json({
    summary,
    items: items.map((i) => toInvoiceSummaryDto(i, now)),
    total,
    page: q.page,
    pageSize: q.pageSize,
  });
});
