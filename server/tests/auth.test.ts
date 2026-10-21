import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import {
  PASSWORD,
  WRONG_PASSWORD,
  app,
  createUser,
  extractResetToken,
  login,
  loggedAgent,
  prisma,
  readOutboxFor,
  uniqueEmail,
  uniqueIp,
} from './helpers';
import { sha256 } from '../src/lib/crypto';

const GENERIC = 'Email o contraseña incorrectos';

describe('Login', () => {
  it('acceso correcto crea sesión en cookie httpOnly + SameSite y no expone datos sensibles', async () => {
    const user = await createUser();
    const res = await login(user.email, PASSWORD);
    expect(res.status).toBe(200);
    const cookie = String(res.headers['set-cookie']);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Strict/i);
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|failedLoginAttempts/);
    expect(res.body.user.email).toBe(user.email);
    expect(Array.isArray(res.body.permissions)).toBe(true);
  });

  it('el email no distingue mayúsculas', async () => {
    const user = await createUser();
    const res = await login(user.email.toUpperCase(), PASSWORD);
    expect(res.status).toBe(200);
  });

  it('mensaje idéntico para contraseña incorrecta, usuario inexistente, inactivo y bloqueado', async () => {
    const ok = await createUser();
    const inactive = await createUser({ active: false });
    const locked = await createUser();
    await prisma.user.update({ where: { id: locked.id }, data: { lockedUntil: new Date(Date.now() + 600_000) } });

    const responses = await Promise.all([
      login(ok.email, WRONG_PASSWORD),
      login(uniqueEmail('noexiste'), PASSWORD),
      login(inactive.email, PASSWORD),
      login(locked.email, PASSWORD),
      login('', ''),
    ]);
    for (const res of responses) {
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ message: GENERIC, code: 'INVALID_CREDENTIALS' });
      expect(res.headers['set-cookie']).toBeUndefined();
    }
  });
});

describe('Bloqueo de login', () => {
  it('bloquea al sexto intento aunque la contraseña sea correcta', async () => {
    const user = await createUser();
    for (let i = 0; i < 5; i++) {
      const res = await login(user.email, WRONG_PASSWORD, uniqueIp());
      expect(res.status).toBe(401);
    }
    const sixth = await login(user.email, PASSWORD, uniqueIp());
    expect(sixth.status).toBe(401);
    expect(sixth.body.message).toBe(GENERIC);

    const stored = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(stored.lockedUntil!.getTime()).toBeGreaterThan(Date.now() + 14 * 60_000);
    expect(stored.lockedUntil!.getTime()).toBeLessThanOrEqual(Date.now() + 15 * 60_000);
    const lockEvents = await prisma.auditLog.count({ where: { action: 'ACCOUNT_LOCKED', targetId: user.id } });
    expect(lockEvents).toBe(1);
  });

  it('el contador se reinicia tras un acceso correcto', async () => {
    const user = await createUser();
    for (let round = 0; round < 2; round++) {
      for (let i = 0; i < 4; i++) expect((await login(user.email, WRONG_PASSWORD)).status).toBe(401);
      expect((await login(user.email, PASSWORD)).status).toBe(200);
    }
    const stored = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(stored.failedLoginAttempts).toBe(0);
    expect(stored.lockedUntil).toBeNull();
  });

  it('el bloqueo expira a los 15 minutos', async () => {
    const user = await createUser();
    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 5, lockedUntil: new Date(Date.now() - 1000) },
    });
    expect((await login(user.email, PASSWORD)).status).toBe(200);
  });

  it('bloquea por IP tras 5 fallos aunque sean de distintos emails', async () => {
    const ip = uniqueIp();
    for (let i = 0; i < 5; i++) expect((await login(uniqueEmail('x'), WRONG_PASSWORD, ip)).status).toBe(401);
    const user = await createUser();
    const fromLockedIp = await login(user.email, PASSWORD, ip);
    expect(fromLockedIp.status).toBe(401);
    expect(fromLockedIp.body.message).toBe(GENERIC);
    expect((await login(user.email, PASSWORD, uniqueIp())).status).toBe(200);
  });

  it('un administrador puede desbloquear y queda en bitácora', async () => {
    const { agent: admin } = await loggedAgent('ADMINISTRADOR');
    const user = await createUser();
    for (let i = 0; i < 5; i++) await login(user.email, WRONG_PASSWORD);
    expect((await login(user.email, PASSWORD)).status).toBe(401);

    const unlock = await admin.post(`/api/users/${user.id}/unlock`).send({});
    expect(unlock.status).toBe(200);
    expect(unlock.body.locked).toBe(false);
    expect((await login(user.email, PASSWORD)).status).toBe(200);
    expect(await prisma.auditLog.count({ where: { action: 'ACCOUNT_UNLOCKED', targetId: user.id } })).toBe(1);
  });
});

describe('Sesiones', () => {
  it('logout invalida la sesión', async () => {
    const { agent } = await loggedAgent();
    expect((await agent.get('/api/auth/me')).status).toBe(200);
    expect((await agent.post('/api/auth/logout').send({})).status).toBe(204);
    expect((await agent.get('/api/auth/me')).status).toBe(401);
  });

  it('cookie manipulada no autentica', async () => {
    const res = await request(app).get('/api/auth/me').set('Cookie', 'sid=token-falso-123');
    expect(res.status).toBe(401);
  });

  it('sesión expirada no autentica', async () => {
    const { agent, user } = await loggedAgent();
    await prisma.session.updateMany({ where: { userId: user.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await agent.get('/api/auth/me')).status).toBe(401);
  });

  it('el token de sesión se almacena hasheado', async () => {
    const user = await createUser();
    const res = await login(user.email, PASSWORD);
    const token = /sid=([^;]+)/.exec(String(res.headers['set-cookie']))![1]!;
    const session = await prisma.session.findFirstOrThrow({ where: { userId: user.id } });
    expect(session.tokenHash).toBe(sha256(token));
    expect(session.tokenHash).not.toBe(token);
  });

  it('cambiar la contraseña invalida las demás sesiones', async () => {
    const user = await createUser();
    const a = request.agent(app);
    const b = request.agent(app);
    await login(user.email, PASSWORD, uniqueIp(), a);
    await login(user.email, PASSWORD, uniqueIp(), b);

    const newPassword = 'NuevaClave123*Spa';
    const change = await a.post('/api/profile/password').send({ currentPassword: PASSWORD, newPassword });
    expect(change.status).toBe(200);
    expect((await a.get('/api/auth/me')).status).toBe(200);
    expect((await b.get('/api/auth/me')).status).toBe(401);
    expect((await login(user.email, PASSWORD)).status).toBe(401);
    expect((await login(user.email, newPassword)).status).toBe(200);
  });

  it('rechaza contraseñas de menos de 12 caracteres', async () => {
    const { agent } = await loggedAgent();
    const res = await agent.post('/api/profile/password').send({ currentPassword: PASSWORD, newPassword: 'Corta123*' });
    expect(res.status).toBe(400);
  });

  it('usuario con cambio obligatorio solo accede a perfil', async () => {
    const user = await createUser({ mustChangePassword: true, role: 'ADMINISTRADOR' });
    const agent = request.agent(app);
    await login(user.email, PASSWORD, uniqueIp(), agent);
    expect((await agent.get('/api/auth/me')).status).toBe(200);
    const blocked = await agent.get('/api/products');
    expect(blocked.status).toBe(403);
    expect(blocked.body.code).toBe('PASSWORD_CHANGE_REQUIRED');
    await agent.post('/api/profile/password').send({ currentPassword: PASSWORD, newPassword: 'OtraClave123*Spa' });
    expect((await agent.get('/api/products')).status).toBe(200);
  });
});

describe('Recuperación de contraseña', () => {
  const waitForMail = (email: string, count = 1) =>
    vi.waitFor(
      () => {
        const mails = readOutboxFor(email);
        if (mails.length < count) throw new Error('sin correo');
        return mails;
      },
      { timeout: 10_000, interval: 100 },
    );

  it('responde exactamente igual exista o no el email', async () => {
    const user = await createUser();
    const existing = await request(app).post('/api/auth/forgot-password').send({ email: user.email });
    const missing = await request(app).post('/api/auth/forgot-password').send({ email: uniqueEmail('nadie') });
    const invalid = await request(app).post('/api/auth/forgot-password').send({ email: 'no-es-email' });
    for (const res of [existing, missing, invalid]) {
      expect(res.status).toBe(existing.status);
      expect(res.body).toEqual(existing.body);
    }
    await waitForMail(user.email);
  });

  it('token aleatorio, almacenado hasheado, de un solo uso e invalida sesiones', async () => {
    const user = await createUser();
    const agent = request.agent(app);
    await login(user.email, PASSWORD, uniqueIp(), agent);

    await request(app).post('/api/auth/forgot-password').send({ email: user.email });
    const [mail] = await waitForMail(user.email);
    const token = extractResetToken(mail!.text);

    const stored = await prisma.passwordResetToken.findFirstOrThrow({ where: { userId: user.id } });
    expect(stored.tokenHash).toBe(sha256(token));
    const ttlMinutes = (stored.expiresAt.getTime() - stored.createdAt.getTime()) / 60_000;
    expect(ttlMinutes).toBeGreaterThanOrEqual(30);
    expect(ttlMinutes).toBeLessThanOrEqual(60);

    const newPassword = 'Recuperada123*Spa';
    const first = await request(app).post('/api/auth/reset-password').send({ token, password: newPassword });
    expect(first.status).toBe(200);
    const second = await request(app).post('/api/auth/reset-password').send({ token, password: 'OtraMas123*Spa' });
    expect(second.status).toBe(400);

    expect((await agent.get('/api/auth/me')).status).toBe(401);
    expect((await login(user.email, newPassword)).status).toBe(200);
  });

  it('rechaza tokens expirados', async () => {
    const user = await createUser();
    await request(app).post('/api/auth/forgot-password').send({ email: user.email });
    const [mail] = await waitForMail(user.email);
    const token = extractResetToken(mail!.text);
    await prisma.passwordResetToken.updateMany({
      where: { userId: user.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    const res = await request(app).post('/api/auth/reset-password').send({ token, password: 'Recuperada123*Spa' });
    expect(res.status).toBe(400);
  });

  it('una nueva solicitud invalida el token anterior', async () => {
    const user = await createUser();
    await request(app).post('/api/auth/forgot-password').send({ email: user.email });
    const [first] = await waitForMail(user.email, 1);
    await request(app).post('/api/auth/forgot-password').send({ email: user.email });
    await waitForMail(user.email, 2);
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: extractResetToken(first!.text), password: 'Recuperada123*Spa' });
    expect(res.status).toBe(400);
  });
});
