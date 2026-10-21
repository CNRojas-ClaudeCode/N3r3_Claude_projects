import type { CookieOptions, NextFunction, Request, Response } from 'express';
import { config } from '../config';
import { sessionsRepo, type User } from '../data';
import { sha256 } from '../lib/crypto';
import { HttpError, forbidden, unauthorized } from '../lib/http';
import { can, type Permission } from '../auth/permissions';

export type AuthContext = { user: User; sessionId: string; token: string };

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

const baseCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: config.isProd,
  sameSite: 'strict',
  path: '/',
};

export const setSessionCookie = (res: Response, token: string, expiresAt: Date) =>
  res.cookie(config.cookieName, token, { ...baseCookieOptions, expires: expiresAt });

export const clearSessionCookie = (res: Response) => res.clearCookie(config.cookieName, baseCookieOptions);

export const getSessionToken = (req: Request): string | undefined => {
  const value = req.cookies?.[config.cookieName];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
};

export const clientInfo = (req: Request) => ({ ip: req.ip ?? 'unknown', userAgent: req.get('user-agent') });

/** Carga la sesión desde la cookie si existe y es válida. No rechaza la petición. */
export const loadSession = async (req: Request, res: Response, next: NextFunction) => {
  const token = getSessionToken(req);
  if (!token) return next();

  const session = await sessionsRepo.findByTokenHash(sha256(token));
  const now = new Date();
  if (!session || session.expiresAt <= now || !session.user.active) {
    if (session) await sessionsRepo.deleteById(session.id);
    clearSessionCookie(res);
    return next();
  }
  if (now.getTime() - session.lastUsedAt.getTime() > config.security.sessionTouchIntervalMs) {
    await sessionsRepo.touch(session.id, now);
  }
  req.auth = { user: session.user, sessionId: session.id, token };
  next();
};

/** Rutas accesibles aunque el usuario deba cambiar su contraseña. */
const PASSWORD_CHANGE_ALLOWLIST = new Set(['/api/auth/me', '/api/auth/logout', '/api/profile', '/api/profile/password']);

export const requireAuth = (req: Request, _res: Response, next: NextFunction) => {
  if (!req.auth) return next(unauthorized());
  if (req.auth.user.mustChangePassword && !PASSWORD_CHANGE_ALLOWLIST.has(req.originalUrl.split('?')[0] ?? '')) {
    return next(new HttpError(403, 'Debe cambiar su contraseña antes de continuar', 'PASSWORD_CHANGE_REQUIRED'));
  }
  next();
};

export const requirePermission =
  (permission: Permission) => (req: Request, res: Response, next: NextFunction) =>
    requireAuth(req, res, (err?: unknown) => {
      if (err) return next(err);
      if (!can(req.auth!.user.role, permission)) return next(forbidden());
      next();
    });

/** Devuelve el usuario autenticado (solo usar detrás de requireAuth / requirePermission). */
export const currentUser = (req: Request): User => {
  if (!req.auth) throw unauthorized();
  return req.auth.user;
};
