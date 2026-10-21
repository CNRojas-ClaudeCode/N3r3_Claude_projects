import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config';
import { randomToken } from '../lib/crypto';

type Mail = { to: string; subject: string; text: string };

/**
 * Envío de correo. Sin proveedor configurado:
 * - desarrollo / test: el correo se escribe como JSON en MAIL_OUTBOX_DIR (carpeta ignorada por git).
 * - producción: no se envía y se registra una advertencia SIN el contenido (el token nunca va a logs).
 * Ver SUPUESTOS.md (proveedor de correo pendiente de confirmación).
 */
export const sendMail = async (mail: Mail) => {
  if (config.isProd) {
    console.warn('[mailer] Proveedor de correo no configurado: correo no enviado');
    return;
  }
  const dir = path.resolve(process.cwd(), config.MAIL_OUTBOX_DIR);
  await fs.mkdir(dir, { recursive: true });
  const file = path.join(dir, `${Date.now()}-${randomToken().slice(0, 8)}.json`);
  await fs.writeFile(file, JSON.stringify({ ...mail, createdAt: new Date().toISOString() }, null, 2), 'utf8');
};

export const sendPasswordResetMail = (to: string, link: string) =>
  sendMail({
    to,
    subject: 'Recuperación de contraseña - SPA Nereyda',
    text:
      `Recibimos una solicitud para restablecer su contraseña.\n\n` +
      `Abra este enlace (válido por ${config.RESET_TOKEN_TTL_MINUTES} minutos, un solo uso):\n${link}\n\n` +
      `Si usted no lo solicitó, ignore este mensaje.`,
  });
