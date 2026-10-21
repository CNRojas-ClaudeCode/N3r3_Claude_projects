import { config } from '../config';
import { resetTokensRepo, sessionsRepo, throttleRepo, usersRepo, type User } from '../data';
import { getDummyHash, hashPassword, randomToken, sha256, verifyPassword } from '../lib/crypto';
import { HttpError, badRequest } from '../lib/http';
import { audit, AuditAction } from './audit.service';
import { sendPasswordResetMail } from './mailer';

/** Mensaje único para cualquier fallo de login (usuario inexistente, contraseña, bloqueo, inactivo). */
export const INVALID_CREDENTIALS_MESSAGE = 'Email o contraseña incorrectos';
export const RESET_REQUEST_MESSAGE =
  'Si el email está registrado, recibirá un enlace para restablecer su contraseña.';
export const INVALID_RESET_TOKEN_MESSAGE = 'El enlace de recuperación no es válido o ya expiró';

const { maxFailedAttempts, lockMinutes } = config.security;
const lockDurationMs = lockMinutes * 60 * 1000;

type ClientInfo = { ip: string; userAgent?: string };

const invalidCredentials = () => new HttpError(401, INVALID_CREDENTIALS_MESSAGE, 'INVALID_CREDENTIALS');

const isLocked = (lockedUntil: Date | null | undefined, now: Date) => lockedUntil != null && lockedUntil > now;

export const createSession = async (userId: string, client: ClientInfo) => {
  const token = randomToken();
  const expiresAt = new Date(Date.now() + config.SESSION_TTL_HOURS * 60 * 60 * 1000);
  await sessionsRepo.create({
    tokenHash: sha256(token),
    userId,
    expiresAt,
    ip: client.ip,
    userAgent: client.userAgent?.slice(0, 255),
  });
  return { token, expiresAt };
};

const registerFailure = async (
  email: string,
  user: User | null,
  reason: string,
  flags: { ipLocked: boolean; userLocked: boolean },
  client: ClientInfo,
) => {
  const now = new Date();

  if (!flags.ipLocked) {
    const ipState = await throttleRepo.registerFailure(client.ip, now);
    if (ipState.failedAttempts >= maxFailedAttempts) {
      await throttleRepo.lock(client.ip, new Date(now.getTime() + lockDurationMs));
      await audit(AuditAction.IP_LOCKED, { ip: client.ip, details: { lockMinutes } });
    }
  }

  if (user && user.active && !flags.userLocked) {
    // Si el bloqueo anterior ya venció, el conteo se reinicia
    if (user.lockedUntil && user.lockedUntil <= now) await usersRepo.resetLoginState(user.id);
    const updated = await usersRepo.incrementFailedAttempts(user.id);
    if (updated.failedLoginAttempts >= maxFailedAttempts) {
      await usersRepo.update(user.id, { lockedUntil: new Date(now.getTime() + lockDurationMs) });
      await audit(AuditAction.ACCOUNT_LOCKED, {
        ip: client.ip,
        targetType: 'User',
        targetId: user.id,
        details: { email: user.email, lockMinutes },
      });
    }
  }

  await audit(AuditAction.LOGIN_FAILED, {
    ip: client.ip,
    targetType: user ? 'User' : undefined,
    targetId: user?.id,
    details: { email, reason },
  });
};

export const login = async (email: string, password: string, client: ClientInfo) => {
  const now = new Date();
  const [ipState, user] = await Promise.all([throttleRepo.get(client.ip), usersRepo.findByEmail(email)]);

  // Siempre se compara contra un hash (real o ficticio) para no revelar existencia por tiempo de respuesta
  const passwordOk = await verifyPassword(password, user?.passwordHash ?? (await getDummyHash()));

  const ipLocked = isLocked(ipState?.lockedUntil, now);
  const userLocked = isLocked(user?.lockedUntil, now);

  if (!user || !passwordOk || !user.active || userLocked || ipLocked) {
    const reason = !user
      ? 'unknown_user'
      : ipLocked
        ? 'ip_locked'
        : userLocked
          ? 'user_locked'
          : !user.active
            ? 'inactive'
            : 'bad_password';
    await registerFailure(email, user, reason, { ipLocked, userLocked }, client);
    throw invalidCredentials();
  }

  // Acceso correcto: se reinician los contadores por usuario y por IP
  const [updated] = await Promise.all([
    usersRepo.resetLoginState(user.id, { lastLoginAt: now }),
    throttleRepo.reset(client.ip),
  ]);
  const session = await createSession(user.id, client);
  await audit(AuditAction.LOGIN_SUCCESS, { actor: user, ip: client.ip, targetType: 'User', targetId: user.id });
  return { user: updated, session };
};

export const logout = (token: string | undefined) =>
  token ? sessionsRepo.deleteByTokenHash(sha256(token)) : Promise.resolve();

/**
 * Solicitud de recuperación. Se ejecuta en segundo plano desde la ruta para que la respuesta
 * sea idéntica (contenido y tiempo) exista o no el email.
 */
export const requestPasswordReset = async (email: string, client: ClientInfo) => {
  const now = new Date();
  const user = await usersRepo.findByEmail(email);
  if (!user || !user.active) {
    await audit(AuditAction.PASSWORD_RESET_REQUESTED, { ip: client.ip, details: { email, matched: false } });
    return;
  }
  await resetTokensRepo.invalidateForUser(user.id, now);
  const token = randomToken();
  await resetTokensRepo.create({
    tokenHash: sha256(token),
    userId: user.id,
    expiresAt: new Date(now.getTime() + config.RESET_TOKEN_TTL_MINUTES * 60 * 1000),
  });
  const link = `${config.appOrigin}/restablecer?token=${encodeURIComponent(token)}`;
  await sendPasswordResetMail(user.email, link);
  await audit(AuditAction.PASSWORD_RESET_REQUESTED, {
    ip: client.ip,
    targetType: 'User',
    targetId: user.id,
    details: { email, matched: true },
  });
};

const applyNewPassword = async (userId: string, newPassword: string) => {
  const passwordHash = await hashPassword(newPassword);
  await usersRepo.update(userId, {
    passwordHash,
    passwordChangedAt: new Date(),
    mustChangePassword: false,
    failedLoginAttempts: 0,
    lockedUntil: null,
  });
  // Invalida todas las sesiones existentes
  await sessionsRepo.deleteAllForUser(userId);
};

export const resetPassword = async (token: string, newPassword: string, client: ClientInfo) => {
  const now = new Date();
  const record = await resetTokensRepo.findValid(sha256(token), now);
  if (!record || !record.user.active) throw badRequest(INVALID_RESET_TOKEN_MESSAGE, 'INVALID_RESET_TOKEN');
  if (!(await resetTokensRepo.consume(record.id, now))) {
    throw badRequest(INVALID_RESET_TOKEN_MESSAGE, 'INVALID_RESET_TOKEN');
  }
  await applyNewPassword(record.userId, newPassword);
  await audit(AuditAction.PASSWORD_RESET_COMPLETED, {
    actor: record.user,
    ip: client.ip,
    targetType: 'User',
    targetId: record.userId,
  });
};

export const changePassword = async (
  user: User,
  currentPassword: string,
  newPassword: string,
  client: ClientInfo,
) => {
  if (!(await verifyPassword(currentPassword, user.passwordHash))) {
    throw badRequest('La contraseña actual no es correcta', 'INVALID_CURRENT_PASSWORD');
  }
  if (await verifyPassword(newPassword, user.passwordHash)) {
    throw badRequest('La nueva contraseña debe ser diferente a la actual', 'PASSWORD_REUSED');
  }
  await applyNewPassword(user.id, newPassword);
  await audit(AuditAction.PASSWORD_CHANGED, { actor: user, ip: client.ip, targetType: 'User', targetId: user.id });
  // Nueva sesión para el dispositivo actual; las demás quedaron invalidadas
  return createSession(user.id, client);
};
