import { Router } from 'express';
import { z } from 'zod';
import { usersRepo } from '../data';
import { nameSchema, passwordSchema } from '../lib/validation';
import { clientInfo, currentUser, requirePermission, setSessionCookie } from '../middleware/auth';
import * as authService from '../services/auth.service';
import { toSessionUserDto } from '../services/serializers';
import { audit, AuditAction } from '../services/audit.service';

export const profileRouter = Router();

profileRouter.use(requirePermission('profile.self'));

profileRouter.get('/', (req, res) => {
  res.json(toSessionUserDto(currentUser(req)));
});

profileRouter.patch('/', async (req, res) => {
  const { name } = z.object({ name: nameSchema }).strict().parse(req.body);
  const user = currentUser(req);
  const updated = await usersRepo.update(user.id, { name });
  if (updated.name !== user.name) {
    await audit(AuditAction.USER_UPDATED, {
      actor: user,
      ip: clientInfo(req).ip,
      targetType: 'User',
      targetId: user.id,
      details: { name: { from: user.name, to: updated.name }, self: true },
    });
  }
  res.json(toSessionUserDto(updated));
});

profileRouter.post('/password', async (req, res) => {
  const { currentPassword, newPassword } = z
    .object({ currentPassword: z.string().min(1).max(1024), newPassword: passwordSchema })
    .parse(req.body);
  const session = await authService.changePassword(currentUser(req), currentPassword, newPassword, clientInfo(req));
  setSessionCookie(res, session.token, session.expiresAt);
  const refreshed = await usersRepo.findById(currentUser(req).id);
  res.json(toSessionUserDto(refreshed!));
});
