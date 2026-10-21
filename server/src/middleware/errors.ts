import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { config } from '../config';
import { HttpError } from '../lib/http';

export const apiNotFound = (_req: Request, res: Response) =>
  res.status(404).json({ message: 'Recurso no encontrado', code: 'NOT_FOUND' });

// Express identifica los manejadores de error por sus 4 argumentos
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const errorHandler = (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof ZodError) {
    return res.status(400).json({
      message: 'Datos inválidos',
      code: 'VALIDATION_ERROR',
      issues: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    });
  }
  if (err instanceof HttpError) {
    return res.status(err.status).json({ message: err.message, code: err.code });
  }
  const bodyError = err as { type?: string; status?: number };
  if (bodyError?.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'JSON inválido', code: 'INVALID_JSON' });
  }
  if (bodyError?.type === 'entity.too.large') {
    return res.status(413).json({ message: 'La solicitud es demasiado grande', code: 'PAYLOAD_TOO_LARGE' });
  }

  // En producción nunca se expone ni se registra el stack trace completo
  if (config.isProd) console.error('[error]', err instanceof Error ? err.message : 'Error desconocido');
  else console.error(err);
  res.status(500).json({ message: 'Error interno del servidor', code: 'INTERNAL_ERROR' });
};
