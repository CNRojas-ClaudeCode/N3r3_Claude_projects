import { Router } from 'express';
import { z } from 'zod';
import { emailSchema, passwordSchema } from '../lib/validation';
import {
  clearSessionCookie,
  clientInfo,
  currentUser,
  getSessionToken,
  requireAuth,
  setSessionCookie,
} from '../middleware/auth';
import { authRateLimit } from '../middleware/security';
import * as authService from '../services/auth.service';
import { toSessionUserDto } from '../services/serializers';

export const authRouter = Router();

// En el login no se valida la política de contraseña: cualquier fallo devuelve el mensaje genérico
const loginSchema = z.object({
  email: z.string().trim().toLowerCase().max(254),
  password: z.string().max(1024),
});

authRouter.post('/login', authRateLimit, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(401).json({ message: authService.INVALID_CREDENTIALS_MESSAGE, code: 'INVALID_CREDENTIALS' });
  }
  const { user, session } = await authService.login(parsed.data.email, parsed.data.password, clientInfo(req));
  setSessionCookie(res, session.token, session.expiresAt);
  res.json(toSessionUserDto(user));
});

authRouter.post('/logout', async (req, res) => {
  await authService.logout(getSessionToken(req));
  clearSessionCookie(res);
  res.status(204).end();
});

authRouter.get('/me', requireAuth, (req, res) => {
  res.json(toSessionUserDto(currentUser(req)));
});

authRouter.post('/forgot-password', authRateLimit, (req, res) => {
  const parsed = z.object({ email: emailSchema }).safeParse(req.body);
  // Respuesta idéntica exista o no el email, sea válido o no; el trabajo se hace en segundo plano
  if (parsed.success) {
    authService.requestPasswordReset(parsed.data.email, clientInfo(req)).catch((err: unknown) => {
      console.error('[auth] Error al procesar recuperación:', err instanceof Error ? err.message : 'desconocido');
    });
  }
  res.status(202).json({ message: authService.RESET_REQUEST_MESSAGE });
});

const resetSchema = z.object({
  token: z.string().min(20).max(200),
  password: passwordSchema,
});

authRouter.post('/reset-password', authRateLimit, async (req, res) => {
  const { token, password } = resetSchema.parse(req.body);
  await authService.resetPassword(token, password, clientInfo(req));
  clearSessionCookie(res);
  res.json({ message: 'Contraseña actualizada. Inicie sesión con su nueva contraseña.' });
});
