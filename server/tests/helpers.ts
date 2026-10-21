import fs from 'node:fs';
import path from 'node:path';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/data/prisma';
import { hashPassword } from '../src/lib/crypto';
import type { Role } from '../src/auth/permissions';

export const app = createApp();
export { prisma };

export const PASSWORD = 'Correcta123*Spa';
export const WRONG_PASSWORD = 'Incorrecta123*';

let sharedHash: Promise<string> | undefined;
const passwordHash = () => (sharedHash ??= hashPassword(PASSWORD));

let seq = 0;
export const uniqueEmail = (prefix = 'user') => `${prefix}.${Date.now()}.${++seq}@test.local`;

let ipSeq = 0;
/** IP distinta por prueba para que el contador por IP no interfiera entre casos. */
export const uniqueIp = () => {
  ipSeq += 1;
  return `10.${Math.floor(ipSeq / 65025) % 255}.${Math.floor(ipSeq / 255) % 255}.${(ipSeq % 255) + 1}`;
};

export const createUser = async (opts: {
  role?: Role;
  email?: string;
  active?: boolean;
  mustChangePassword?: boolean;
} = {}) =>
  prisma.user.create({
    data: {
      email: opts.email ?? uniqueEmail(opts.role?.toLowerCase()),
      name: 'Usuario Prueba',
      role: opts.role ?? 'EMPLEADO',
      active: opts.active ?? true,
      mustChangePassword: opts.mustChangePassword ?? false,
      passwordHash: await passwordHash(),
    },
  });

export const login = (email: string, password: string, ip = uniqueIp(), agent = request(app)) =>
  agent.post('/api/auth/login').set('X-Forwarded-For', ip).send({ email, password });

/** Devuelve un agente con cookie de sesión válida. */
export const loggedAgent = async (role: Role = 'EMPLEADO') => {
  const user = await createUser({ role });
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/login').set('X-Forwarded-For', uniqueIp()).send({
    email: user.email,
    password: PASSWORD,
  });
  if (res.status !== 200) throw new Error(`Login de prueba falló: ${res.status}`);
  return { agent, user };
};

const outboxDir = path.resolve(process.cwd(), '.test-outbox');

export const readOutboxFor = (email: string): { to: string; text: string }[] => {
  if (!fs.existsSync(outboxDir)) return [];
  return fs
    .readdirSync(outboxDir)
    .map((f) => JSON.parse(fs.readFileSync(path.join(outboxDir, f), 'utf8')) as { to: string; text: string })
    .filter((m) => m.to === email);
};

export const extractResetToken = (text: string) => {
  const match = /token=([A-Za-z0-9_\-%]+)/.exec(text);
  if (!match?.[1]) throw new Error('Token no encontrado en el correo');
  return decodeURIComponent(match[1]);
};
