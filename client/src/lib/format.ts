import { CURRENCY, LOCALE } from '../config';

const money = new Intl.NumberFormat(LOCALE, { style: 'currency', currency: CURRENCY });
const dateTime = new Intl.DateTimeFormat(LOCALE, { dateStyle: 'medium', timeStyle: 'short' });
const dateOnly = new Intl.DateTimeFormat(LOCALE, { dateStyle: 'medium' });
const integer = new Intl.NumberFormat(LOCALE);

export const formatMoney = (cents: number) => money.format(cents / 100);
export const formatDateTime = (iso: string | null | undefined) => (iso ? dateTime.format(new Date(iso)) : '—');
export const formatDate = (iso: string | null | undefined) => (iso ? dateOnly.format(new Date(iso)) : '—');
export const formatNumber = (n: number) => integer.format(n);
export const formatFolio = (folio: number) => `F-${String(folio).padStart(6, '0')}`;

/** Convierte un texto de precio ("1,234.50") a centavos; null si es inválido. */
export const parseMoneyToCents = (value: string): number | null => {
  const normalized = value.replace(/[\s,$]/g, '');
  if (!/^\d+(\.\d{0,2})?$/.test(normalized)) return null;
  return Math.round(Number(normalized) * 100);
};

export const centsToInput = (cents: number) => (cents / 100).toFixed(2);

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');

export const ROLE_LABELS: Record<string, string> = {
  ADMINISTRADOR: 'Administrador',
  EMPLEADO: 'Empleado',
};

export const PRODUCT_TYPE_LABELS: Record<string, string> = {
  PRODUCTO: 'Producto',
  SERVICIO: 'Servicio',
};

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  LOGIN_SUCCESS: 'Inicio de sesión correcto',
  LOGIN_FAILED: 'Inicio de sesión fallido',
  ACCOUNT_LOCKED: 'Cuenta bloqueada',
  IP_LOCKED: 'IP bloqueada',
  ACCOUNT_UNLOCKED: 'Cuenta desbloqueada',
  PASSWORD_RESET_REQUESTED: 'Recuperación solicitada',
  PASSWORD_RESET_COMPLETED: 'Contraseña restablecida',
  PASSWORD_CHANGED: 'Contraseña cambiada',
  USER_CREATED: 'Usuario creado',
  USER_UPDATED: 'Usuario editado',
  USER_ROLE_CHANGED: 'Cambio de rol',
  USER_DEACTIVATED: 'Usuario desactivado',
  USER_ACTIVATED: 'Usuario activado',
  PRODUCT_DELETED: 'Producto eliminado',
  INVOICE_VOIDED: 'Factura anulada',
};

export const PAYMENT_TYPE_LABELS: Record<string, string> = {
  CONTADO: 'Contado',
  CREDITO: 'Crédito',
};

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  EFECTIVO: 'Efectivo',
  TARJETA: 'Tarjeta',
  TRANSFERENCIA: 'Transferencia',
};

export const PAYMENT_KIND_LABELS: Record<string, string> = {
  PAGO: 'Pago',
  ABONO: 'Abono',
};

export const INVOICE_STATUS: Record<string, { label: string; tone: 'success' | 'warning' | 'error' | 'neutral' | 'primary' }> = {
  PAGADA: { label: 'Pagada', tone: 'success' },
  PENDIENTE: { label: 'Pendiente', tone: 'primary' },
  VENCIDA: { label: 'Vencida', tone: 'error' },
  ANULADA: { label: 'Anulada', tone: 'neutral' },
};
