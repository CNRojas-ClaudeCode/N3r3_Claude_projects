import { config } from './config';
import { createApp } from './app';
import { disconnectDatabase, resetTokensRepo, sessionsRepo } from './data';
import { purgeExpiredAudit } from './services/audit.service';

const MAINTENANCE_INTERVAL_MS = 24 * 60 * 60 * 1000;

/** Retención de bitácora (90 días) y limpieza de sesiones/tokens vencidos. */
const runMaintenance = async () => {
  const now = new Date();
  try {
    const [audit] = await Promise.all([
      purgeExpiredAudit(now),
      sessionsRepo.deleteExpired(now),
      resetTokensRepo.deleteExpired(now),
    ]);
    if (audit.count > 0) console.log(`[mantenimiento] Bitácora: ${audit.count} registros fuera de retención eliminados`);
  } catch (err) {
    console.error('[mantenimiento] Error:', err instanceof Error ? err.message : 'desconocido');
  }
};

const server = createApp().listen(config.PORT, () => {
  console.log(`Servidor escuchando en el puerto ${config.PORT} (${config.NODE_ENV})`);
  if (config.isProd) console.warn('[mailer] Sin proveedor de correo: la recuperación de contraseña no envía emails');
});

void runMaintenance();
const timer = setInterval(() => void runMaintenance(), MAINTENANCE_INTERVAL_MS);
timer.unref();

const shutdown = () => {
  server.close(() => {
    void disconnectDatabase().finally(() => process.exit(0));
  });
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
