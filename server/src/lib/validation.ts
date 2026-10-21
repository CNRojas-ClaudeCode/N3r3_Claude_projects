import { z } from 'zod';
import { config } from '../config';
import { ROLES } from '../auth/roles.generated';

const { passwordMinLength, passwordMaxBytes } = config.security;

export const emailSchema = z
  .string({ message: 'El email es obligatorio' })
  .trim()
  .toLowerCase()
  .max(254, { message: 'El email es demasiado largo' })
  .email({ message: 'Email inválido' });

export const passwordSchema = z
  .string({ message: 'La contraseña es obligatoria' })
  .min(passwordMinLength, { message: `La contraseña debe tener al menos ${passwordMinLength} caracteres` })
  .refine((v) => Buffer.byteLength(v, 'utf8') <= passwordMaxBytes, {
    message: `La contraseña no puede superar ${passwordMaxBytes} bytes`,
  });

export const nameSchema = z
  .string({ message: 'El nombre es obligatorio' })
  .trim()
  .min(2, { message: 'El nombre debe tener al menos 2 caracteres' })
  .max(120, { message: 'El nombre es demasiado largo' });

export const roleSchema = z.enum(ROLES, { message: 'Rol inválido' });

export const idParamSchema = z.object({ id: z.string().min(1).max(64) });

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const optionalSearch = z.string().trim().max(100).optional();
