import type { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from '../config';
import { HttpError } from '../lib/http';

const windowMs = config.RATE_LIMIT_WINDOW_MINUTES * 60 * 1000;
const tooManyRequests = { message: 'Demasiadas solicitudes. Intente de nuevo más tarde.' };

export const helmetMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
      imgSrc: ["'self'", 'data:'],
      fontSrc: ["'self'"],
      connectSrc: ["'self'"],
      manifestSrc: ["'self'"],
      workerSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    },
  },
});

const allowedOrigins = new Set([config.appOrigin, ...config.corsOrigins]);

export const corsMiddleware = cors({
  origin: (origin, callback) => callback(null, !origin || allowedOrigins.has(origin)),
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
});

/**
 * Defensa adicional CSRF (además de SameSite=strict): las peticiones que modifican estado
 * deben enviar JSON y, si traen Origin, debe ser un origen permitido.
 */
export const csrfGuard = (req: Request, _res: Response, next: NextFunction) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.get('origin');
  if (origin && !allowedOrigins.has(origin) && origin !== `${req.protocol}://${req.get('host')}`) {
    return next(new HttpError(403, 'Origen no permitido', 'ORIGIN_NOT_ALLOWED'));
  }
  if (req.method !== 'DELETE' && !req.is('application/json')) {
    return next(new HttpError(415, 'Se requiere Content-Type application/json', 'UNSUPPORTED_MEDIA_TYPE'));
  }
  next();
};

export const globalRateLimit = rateLimit({
  windowMs,
  limit: config.RATE_LIMIT_MAX,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: tooManyRequests,
});

export const authRateLimit = rateLimit({
  windowMs,
  limit: config.AUTH_RATE_LIMIT_MAX,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: tooManyRequests,
});
