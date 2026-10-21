// Capa única de acceso a datos. Servicios y rutas solo consumen estos repositorios.
export { pingDatabase, disconnectDatabase } from './prisma';
export { usersRepo } from './users.repo';
export type { User } from './users.repo';
export { sessionsRepo } from './sessions.repo';
export { throttleRepo } from './throttle.repo';
export { resetTokensRepo } from './resetTokens.repo';
export { auditRepo } from './audit.repo';
export type { AuditEntryInput } from './audit.repo';
export { productsRepo } from './products.repo';
export type { Product } from './products.repo';
export { clientsRepo } from './clients.repo';
export type { Client } from './clients.repo';
export { invoicesRepo } from './invoices.repo';
export type { Invoice, InvoiceItem, InvoiceWithRelations, Payment } from './invoices.repo';
export { trainingRepo } from './training.repo';
export type { TrainingMaterial } from './training.repo';
