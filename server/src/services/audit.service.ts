import { auditRepo, type AuditEntryInput } from '../data';
import { config } from '../config';

export const AuditAction = {
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGIN_FAILED: 'LOGIN_FAILED',
  ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
  IP_LOCKED: 'IP_LOCKED',
  ACCOUNT_UNLOCKED: 'ACCOUNT_UNLOCKED',
  PASSWORD_RESET_REQUESTED: 'PASSWORD_RESET_REQUESTED',
  PASSWORD_RESET_COMPLETED: 'PASSWORD_RESET_COMPLETED',
  PASSWORD_CHANGED: 'PASSWORD_CHANGED',
  USER_CREATED: 'USER_CREATED',
  USER_UPDATED: 'USER_UPDATED',
  USER_ROLE_CHANGED: 'USER_ROLE_CHANGED',
  USER_DEACTIVATED: 'USER_DEACTIVATED',
  USER_ACTIVATED: 'USER_ACTIVATED',
  PRODUCT_DELETED: 'PRODUCT_DELETED',
  INVOICE_VOIDED: 'INVOICE_VOIDED',
} as const;

export type AuditActionType = (typeof AuditAction)[keyof typeof AuditAction];

export type Actor = { id: string; email: string } | null | undefined;

export const audit = (
  action: AuditActionType,
  ctx: { actor?: Actor; ip?: string | null; targetType?: string; targetId?: string; details?: Record<string, unknown> },
) => {
  const entry: AuditEntryInput = {
    action,
    actorId: ctx.actor?.id ?? null,
    actorEmail: ctx.actor?.email ?? null,
    targetType: ctx.targetType ?? null,
    targetId: ctx.targetId ?? null,
    ip: ctx.ip ?? null,
    details: ctx.details ?? null,
  };
  return auditRepo.create(entry);
};

export const purgeExpiredAudit = (now = new Date()) => {
  const before = new Date(now.getTime() - config.security.auditRetentionDays * 24 * 60 * 60 * 1000);
  return auditRepo.purgeOlderThan(before);
};
