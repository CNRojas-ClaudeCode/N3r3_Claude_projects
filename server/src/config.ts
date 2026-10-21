import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

const envFile = path.resolve(process.cwd(), '.env');
// Las variables ya definidas en el entorno (Railway, tests) tienen prioridad sobre .env
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1),
  APP_URL: z.string().url().default('http://localhost:5173'),
  CORS_ORIGINS: z.string().default(''),
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
  SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(168).default(12),
  RESET_TOKEN_TTL_MINUTES: z.coerce.number().int().min(30).max(60).default(45),
  RATE_LIMIT_WINDOW_MINUTES: z.coerce.number().int().min(1).default(15),
  RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(300),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(30),
  MAIL_OUTBOX_DIR: z.string().default('.mail-outbox'),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error(
    'Configuración inválida:',
    parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
  );
  process.exit(1);
}
const env = parsed.data;
const isProd = env.NODE_ENV === 'production';

export const config = {
  ...env,
  isProd,
  appOrigin: new URL(env.APP_URL).origin,
  corsOrigins: env.CORS_ORIGINS.split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  // El prefijo __Host- exige secure y path=/; solo aplica bajo HTTPS (producción)
  cookieName: isProd ? '__Host-sid' : 'sid',
  security: {
    bcryptCost: 12,
    passwordMinLength: 12,
    // bcrypt solo considera los primeros 72 bytes
    passwordMaxBytes: 72,
    maxFailedAttempts: 5,
    lockMinutes: 15,
    auditRetentionDays: 90,
    sessionTouchIntervalMs: 5 * 60 * 1000,
  },
  business: {
    lowStockThreshold: 5,
    // Zona horaria del negocio para "ventas de hoy" (ver SUPUESTOS.md)
    timeZone: 'America/Mexico_City',
    maxInvoiceItems: 50,
  },
} as const;
