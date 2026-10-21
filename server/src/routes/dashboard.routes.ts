import { Router } from 'express';
import { config } from '../config';
import { invoicesRepo, productsRepo, usersRepo } from '../data';
import { can } from '../auth/permissions';
import { startOfDayInTimeZone } from '../lib/dates';
import { currentUser, requirePermission } from '../middleware/auth';
import { toInvoiceSummaryDto, toProductDto } from '../services/serializers';

export const dashboardRouter = Router();

const RECENT_INVOICES = 5;

dashboardRouter.get('/', requirePermission('dashboard.view'), async (req, res) => {
  const user = currentUser(req);
  const now = new Date();
  const threshold = config.business.lowStockThreshold;
  const stats = await productsRepo.stats(threshold);
  // Cada bloque de métricas solo se incluye para quien tiene el permiso del módulo
  const users = can(user.role, 'users.manage') ? await usersRepo.stats(now) : undefined;
  const sales = can(user.role, 'invoices.view')
    ? {
        today: await invoicesRepo.salesSince(startOfDayInTimeZone(now, config.business.timeZone)),
        recent: (await invoicesRepo.recent(RECENT_INVOICES)).map((i) => toInvoiceSummaryDto(i, now)),
      }
    : undefined;
  const portfolio = can(user.role, 'portfolio.view') ? await invoicesRepo.receivablesSummary(now) : undefined;
  res.json({
    products: {
      products: stats.products,
      services: stats.services,
      inactive: stats.inactive,
      lowStock: stats.lowStock,
      lowStockThreshold: threshold,
    },
    lowStockItems: stats.lowStockItems.map(toProductDto),
    recentProducts: stats.recent.map(toProductDto),
    ...(users ? { users } : {}),
    ...(sales ? { sales } : {}),
    ...(portfolio
      ? {
          portfolio: {
            totalCents: portfolio.totalCents,
            invoices: portfolio.invoices,
            overdueCents: portfolio.overdueCents,
            overdueInvoices: portfolio.overdueInvoices,
          },
        }
      : {}),
  });
});
