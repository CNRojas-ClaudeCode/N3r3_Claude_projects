import { sessionsRepo, usersRepo, type User } from '../data';
import { hashPassword } from '../lib/crypto';
import { badRequest, conflict, notFound } from '../lib/http';
import type { Role } from '../auth/permissions';
import { audit, AuditAction } from './audit.service';

const ADMIN_ROLE: Role = 'ADMINISTRADOR';

type Ctx = { actor: User; ip: string };

export const createUser = async (
  input: { email: string; name: string; role: Role; password: string },
  ctx: Ctx,
) => {
  if (await usersRepo.findByEmail(input.email)) throw conflict('Ya existe un usuario con ese email');
  const user = await usersRepo.create({
    email: input.email,
    name: input.name,
    role: input.role,
    passwordHash: await hashPassword(input.password),
    // La contraseña inicial la define un administrador: se exige cambio en el primer acceso
    mustChangePassword: true,
  });
  await audit(AuditAction.USER_CREATED, {
    actor: ctx.actor,
    ip: ctx.ip,
    targetType: 'User',
    targetId: user.id,
    details: { email: user.email, role: user.role },
  });
  return user;
};

/** Evita dejar el sistema sin ningún administrador activo. */
const ensureAnotherActiveAdmin = async (target: User) => {
  if (target.role === ADMIN_ROLE && target.active && (await usersRepo.countActiveByRole(ADMIN_ROLE)) <= 1) {
    throw badRequest('Debe existir al menos un administrador activo', 'LAST_ADMIN');
  }
};

export const updateUser = async (
  id: string,
  input: { email?: string; name?: string; role?: Role; active?: boolean },
  ctx: Ctx,
) => {
  const target = await usersRepo.findById(id);
  if (!target) throw notFound('Usuario no encontrado');

  const isSelf = target.id === ctx.actor.id;
  const roleChanged = input.role !== undefined && input.role !== target.role;
  const activeChanged = input.active !== undefined && input.active !== target.active;
  const emailChanged = input.email !== undefined && input.email !== target.email;
  const nameChanged = input.name !== undefined && input.name !== target.name;

  if (isSelf && roleChanged) throw badRequest('No puede cambiar su propio rol', 'SELF_ROLE_CHANGE');
  if (isSelf && activeChanged && input.active === false) {
    throw badRequest('No puede desactivar su propia cuenta', 'SELF_DEACTIVATION');
  }
  if ((roleChanged && target.role === ADMIN_ROLE) || (activeChanged && input.active === false)) {
    await ensureAnotherActiveAdmin(target);
  }
  if (emailChanged && (await usersRepo.findByEmail(input.email!))) {
    throw conflict('Ya existe un usuario con ese email');
  }

  const updated = await usersRepo.update(id, {
    ...(nameChanged ? { name: input.name } : {}),
    ...(emailChanged ? { email: input.email } : {}),
    ...(roleChanged ? { role: input.role } : {}),
    ...(activeChanged ? { active: input.active } : {}),
  });

  const base = { actor: ctx.actor, ip: ctx.ip, targetType: 'User', targetId: id };
  if (nameChanged || emailChanged) {
    await audit(AuditAction.USER_UPDATED, {
      ...base,
      details: {
        ...(nameChanged ? { name: { from: target.name, to: updated.name } } : {}),
        ...(emailChanged ? { email: { from: target.email, to: updated.email } } : {}),
      },
    });
  }
  if (roleChanged) {
    await audit(AuditAction.USER_ROLE_CHANGED, { ...base, details: { from: target.role, to: updated.role } });
  }
  if (activeChanged) {
    await audit(updated.active ? AuditAction.USER_ACTIVATED : AuditAction.USER_DEACTIVATED, {
      ...base,
      details: { email: updated.email },
    });
  }
  // Cambio de rol o desactivación invalidan las sesiones del usuario afectado
  if (roleChanged || (activeChanged && !updated.active)) await sessionsRepo.deleteAllForUser(id);

  return updated;
};

export const unlockUser = async (id: string, ctx: Ctx) => {
  const target = await usersRepo.findById(id);
  if (!target) throw notFound('Usuario no encontrado');
  const updated = await usersRepo.resetLoginState(id);
  await audit(AuditAction.ACCOUNT_UNLOCKED, {
    actor: ctx.actor,
    ip: ctx.ip,
    targetType: 'User',
    targetId: id,
    details: { email: target.email },
  });
  return updated;
};
