#!/usr/bin/env node
/**
 * Auditoría de seguridad automatizada de SPA Nereyda.
 *
 * Uso (desde la raíz, después de `npm run build`):
 *   node scripts/audit-security.js
 *
 * Levanta el servidor compilado (server/dist) contra una base SQLite temporal (server/prisma/audit.db),
 * crea usuarios de prueba propios, ejecuta las verificaciones y elimina la base al terminar.
 * Nunca toca la base de desarrollo ni la de producción.
 *
 * Verificaciones:
 *  1. Endpoints protegidos sin token (sesión) → 401
 *  2. Endpoints con rol inferior (EMPLEADO) → 403
 *  3. Login bloqueado al sexto intento (aunque la contraseña sea correcta)
 *  4. Reinicio del contador tras un acceso correcto
 *  5. Mensaje idéntico para credenciales inválidas (inexistente, contraseña, inactivo, bloqueado)
 *  6. Recuperación con la misma respuesta exista o no el email
 *  7. Búsqueda de secretos en el frontend compilado (client/dist)
 *  8. npm audit (critical = falla, high = advertencia)
 *
 * Código de salida: 0 si no hay fallas, 1 si alguna verificación falla.
 */
'use strict';

const { execFileSync, spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const SERVER_DIR = path.join(ROOT, 'server');
const CLIENT_DIST = path.join(ROOT, 'client', 'dist');
const DB_NAME = 'audit.db';
const DB_URL = `file:./${DB_NAME}`;
const PORT = Number(process.env.AUDIT_PORT ?? 3999);
const BASE = `http://127.0.0.1:${PORT}`;
const PASSWORD = 'Auditoria123*Spa';
const WRONG = 'Incorrecta123*Spa';
const GENERIC_LOGIN_MESSAGE = 'Email o contraseña incorrectos';
const OUTBOX = '.audit-outbox';

const results = [];
const record = (status, name, detail = '') => {
  results.push({ status, name, detail });
  const icon = { OK: '✔', FALLA: '✖', ADVERTENCIA: '!' }[status];
  console.log(`${icon} [${status}] ${name}${detail ? ` — ${detail}` : ''}`);
};
const check = (condition, name, detail) => record(condition ? 'OK' : 'FALLA', name, condition ? '' : detail);

const requireFromServer = (mod) => require(require.resolve(mod, { paths: [SERVER_DIR] }));

let ipSeq = 0;
/** IP distinta por solicitud (TRUST_PROXY=1) para aislar el contador por IP del contador por usuario. */
const nextIp = () => {
  ipSeq += 1;
  return `10.99.${Math.floor(ipSeq / 250) % 250}.${(ipSeq % 250) + 1}`;
};

const request = async (method, url, { body, cookie, ip } = {}) => {
  const headers = { 'X-Forwarded-For': ip ?? nextIp() };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (cookie) headers.Cookie = cookie;
  const res = await fetch(`${BASE}${url}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { status: res.status, json, text, setCookie: res.headers.getSetCookie?.() ?? [] };
};

const login = (email, password, ip) => request('POST', '/api/auth/login', { body: { email, password }, ip });

const sessionCookie = (res) => {
  const raw = res.setCookie.find((c) => /^(__Host-)?sid=/.test(c));
  return raw ? raw.split(';')[0] : null;
};

const removeDb = () => {
  for (const suffix of ['', '-journal', '-wal', '-shm']) {
    fs.rmSync(path.join(SERVER_DIR, 'prisma', `${DB_NAME}${suffix}`), { force: true });
  }
  fs.rmSync(path.join(SERVER_DIR, OUTBOX), { recursive: true, force: true });
};

const waitForHealth = async (timeoutMs = 30_000) => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${BASE}/api/health`);
      if (res.ok) return;
    } catch {
      // el servidor aún no escucha
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error('El servidor no respondió al healthcheck');
};

const prepareDatabase = async () => {
  removeDb();
  const prismaCli = require.resolve('prisma/build/index.js', { paths: [SERVER_DIR] });
  execFileSync(process.execPath, [prismaCli, 'migrate', 'deploy'], {
    cwd: SERVER_DIR,
    env: { ...process.env, DATABASE_URL: DB_URL },
    stdio: 'pipe',
  });

  process.env.DATABASE_URL = DB_URL;
  const { PrismaClient } = requireFromServer('@prisma/client');
  const bcrypt = requireFromServer('bcryptjs');
  const prisma = new PrismaClient();
  const passwordHash = await bcrypt.hash(PASSWORD, 12);
  const mk = (email, role, extra = {}) =>
    prisma.user.create({ data: { email, name: `Auditoría ${role}`, role, passwordHash, ...extra } });
  const users = {
    admin: await mk('admin@audit.local', 'ADMINISTRADOR'),
    employee: await mk('empleado@audit.local', 'EMPLEADO'),
    inactive: await mk('inactivo@audit.local', 'EMPLEADO', { active: false }),
    lockA: await mk('bloqueo.a@audit.local', 'EMPLEADO'),
    lockB: await mk('bloqueo.b@audit.local', 'EMPLEADO'),
  };
  await prisma.$disconnect();
  return users;
};

const startServer = () => {
  const child = spawn(process.execPath, [path.join(SERVER_DIR, 'dist', 'index.js')], {
    cwd: SERVER_DIR,
    env: {
      ...process.env,
      NODE_ENV: 'test',
      PORT: String(PORT),
      DATABASE_URL: DB_URL,
      APP_URL: 'http://localhost:5173',
      TRUST_PROXY: '1',
      RATE_LIMIT_MAX: '100000',
      AUTH_RATE_LIMIT_MAX: '100000',
      MAIL_OUTBOX_DIR: OUTBOX,
    },
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  let stderr = '';
  child.stderr.on('data', (d) => (stderr += d.toString()));
  child.on('exit', (code) => {
    if (code && code !== 0) console.error(`El servidor terminó con código ${code}\n${stderr}`);
  });
  return child;
};

/* ---------------- Verificaciones ---------------- */

const FAKE_ID = 'cl0000000000000000000000';

const PROTECTED = [
  ['GET', '/api/auth/me'],
  ['GET', '/api/dashboard'],
  ['GET', '/api/profile'],
  ['GET', '/api/products'],
  ['POST', '/api/products'],
  ['PATCH', `/api/products/${FAKE_ID}`],
  ['DELETE', `/api/products/${FAKE_ID}`],
  ['GET', '/api/clients'],
  ['POST', '/api/clients'],
  ['PATCH', `/api/clients/${FAKE_ID}`],
  ['GET', '/api/invoices'],
  ['POST', '/api/invoices'],
  ['POST', `/api/invoices/${FAKE_ID}/void`],
  ['POST', `/api/invoices/${FAKE_ID}/payments`],
  ['POST', `/api/invoices/${FAKE_ID}/installments`],
  ['GET', '/api/portfolio'],
  ['GET', '/api/training'],
  ['POST', '/api/training'],
  ['GET', '/api/users'],
  ['POST', '/api/users'],
  ['GET', '/api/roles'],
  ['GET', '/api/audit'],
];

const ADMIN_ONLY = [
  ['GET', '/api/users'],
  ['POST', '/api/users'],
  ['PATCH', `/api/users/${FAKE_ID}`],
  ['POST', `/api/users/${FAKE_ID}/unlock`],
  ['GET', '/api/roles'],
  ['GET', '/api/audit'],
  ['POST', '/api/products'],
  ['PATCH', `/api/products/${FAKE_ID}`],
  ['DELETE', `/api/products/${FAKE_ID}`],
  ['POST', `/api/invoices/${FAKE_ID}/void`],
  ['POST', '/api/training'],
  ['PATCH', `/api/training/${FAKE_ID}`],
];

const bodyFor = (method) => (method === 'GET' || method === 'DELETE' ? undefined : {});

const checkWithoutToken = async () => {
  const failures = [];
  for (const [method, url] of PROTECTED) {
    const res = await request(method, url, { body: bodyFor(method) });
    if (res.status !== 401) failures.push(`${method} ${url} → ${res.status}`);
  }
  check(failures.length === 0, `1. ${PROTECTED.length} endpoints protegidos sin token responden 401`, failures.join('; '));
};

const checkLowerRole = async (users) => {
  const res = await login(users.employee.email, PASSWORD);
  const cookie = sessionCookie(res);
  if (res.status !== 200 || !cookie) return record('FALLA', '2. Endpoints con rol inferior', 'No se pudo iniciar sesión como EMPLEADO');
  const failures = [];
  for (const [method, url] of ADMIN_ONLY) {
    const r = await request(method, url, { body: bodyFor(method), cookie });
    if (r.status !== 403) failures.push(`${method} ${url} → ${r.status}`);
  }
  check(failures.length === 0, `2. ${ADMIN_ONLY.length} endpoints exclusivos de ADMINISTRADOR responden 403 al EMPLEADO`, failures.join('; '));
};

const checkLockout = async (users) => {
  for (let i = 0; i < 5; i++) await login(users.lockA.email, WRONG);
  const sixth = await login(users.lockA.email, PASSWORD);
  check(
    sixth.status === 401 && sixth.json?.message === GENERIC_LOGIN_MESSAGE,
    '3. Login bloqueado al sexto intento (con contraseña correcta)',
    `status ${sixth.status}`,
  );
};

const checkCounterReset = async (users) => {
  for (let i = 0; i < 4; i++) await login(users.lockB.email, WRONG);
  const ok1 = await login(users.lockB.email, PASSWORD);
  for (let i = 0; i < 4; i++) await login(users.lockB.email, WRONG);
  const ok2 = await login(users.lockB.email, PASSWORD);
  check(
    ok1.status === 200 && ok2.status === 200,
    '4. El contador se reinicia tras un acceso correcto (4 fallos + éxito + 4 fallos + éxito)',
    `accesos: ${ok1.status}, ${ok2.status}`,
  );
};

const checkIdenticalMessage = async (users) => {
  const cases = {
    'contraseña incorrecta': await login(users.employee.email, WRONG),
    'usuario inexistente': await login('no.existe@audit.local', WRONG),
    'usuario inactivo': await login(users.inactive.email, PASSWORD),
    'usuario bloqueado': await login(users.lockA.email, PASSWORD),
  };
  const bodies = new Set(Object.values(cases).map((r) => `${r.status}|${r.text}`));
  const first = Object.values(cases)[0];
  check(
    bodies.size === 1 && first.status === 401 && first.json?.message === GENERIC_LOGIN_MESSAGE,
    '5. Mensaje idéntico para credenciales inválidas (incorrecta, inexistente, inactivo, bloqueado)',
    Object.entries(cases)
      .map(([k, r]) => `${k}: ${r.status} ${r.text}`)
      .join(' | '),
  );
};

const checkRecovery = async (users) => {
  const existing = await request('POST', '/api/auth/forgot-password', { body: { email: users.employee.email } });
  const missing = await request('POST', '/api/auth/forgot-password', { body: { email: 'nadie@audit.local' } });
  check(
    existing.status === missing.status && existing.text === missing.text,
    '6. Recuperación: misma respuesta exista o no el email',
    `existente: ${existing.status} ${existing.text} | inexistente: ${missing.status} ${missing.text}`,
  );
};

const listFiles = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    return e.isDirectory() ? listFiles(full) : [full];
  });

const checkFrontendSecrets = () => {
  if (!fs.existsSync(CLIENT_DIST)) return record('FALLA', '7. Secretos en frontend compilado', 'No existe client/dist (ejecute npm run build)');
  const patterns = [
    [/DATABASE_URL/, 'DATABASE_URL'],
    [/SEED_TEST_PASSWORD/, 'SEED_TEST_PASSWORD'],
    [/Admin123\*/, 'contraseña del seed'],
    [/passwordHash/, 'campo passwordHash'],
    [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'llave privada'],
    [/AKIA[0-9A-Z]{16}/, 'llave de AWS'],
    [/sk_(live|test)_[0-9a-zA-Z]{10,}/, 'llave de Stripe'],
    [/sk-[A-Za-z0-9_-]{20,}/, 'llave de API'],
    [/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/, 'JWT'],
  ];
  // Valores reales de server/.env (si existe) que nunca deben aparecer en el cliente
  const envFile = path.join(SERVER_DIR, '.env');
  if (fs.existsSync(envFile)) {
    for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
      const m = /^\s*(SEED_TEST_PASSWORD|DATABASE_URL)\s*=\s*(.+?)\s*$/.exec(line);
      if (m && m[2].length >= 8) patterns.push([new RegExp(m[2].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `valor de ${m[1]}`]);
    }
  }
  const findings = [];
  const files = listFiles(CLIENT_DIST).filter((f) => /\.(js|css|html|json|webmanifest|map|txt)$/.test(f));
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    for (const [re, label] of patterns) {
      if (re.test(content)) findings.push(`${label} en ${path.relative(ROOT, file)}`);
    }
  }
  check(findings.length === 0, `7. Sin secretos en el frontend compilado (${files.length} archivos revisados)`, findings.join('; '));
};

const checkNpmAudit = () => {
  let output;
  try {
    output = execFileSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['audit', '--json'], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      shell: process.platform === 'win32',
    });
  } catch (err) {
    // npm audit sale con código distinto de 0 cuando encuentra vulnerabilidades
    output = err.stdout;
  }
  let report;
  try {
    report = JSON.parse(output);
  } catch {
    return record('ADVERTENCIA', '8. npm audit', 'No se pudo ejecutar (¿sin conexión a internet?)');
  }
  const v = report.metadata?.vulnerabilities ?? {};
  const summary = `critical ${v.critical ?? 0}, high ${v.high ?? 0}, moderate ${v.moderate ?? 0}, low ${v.low ?? 0}`;
  if ((v.critical ?? 0) > 0) return record('FALLA', '8. npm audit', summary);
  if ((v.high ?? 0) > 0) return record('ADVERTENCIA', '8. npm audit', `${summary} (ver SUPUESTOS.md S-27)`);
  record('OK', `8. npm audit sin vulnerabilidades altas ni críticas (${summary})`);
};

/* ---------------- Ejecución ---------------- */

const main = async () => {
  if (!fs.existsSync(path.join(SERVER_DIR, 'dist', 'index.js'))) {
    console.error('No existe server/dist. Ejecute primero: npm run build');
    process.exit(1);
  }
  console.log('Auditoría de seguridad — SPA Nereyda\n');
  const users = await prepareDatabase();
  const server = startServer();
  try {
    await waitForHealth();
    await checkWithoutToken();
    await checkLowerRole(users);
    await checkLockout(users);
    await checkCounterReset(users);
    await checkIdenticalMessage(users);
    await checkRecovery(users);
  } finally {
    server.kill();
    await new Promise((r) => setTimeout(r, 500));
    removeDb();
  }
  checkFrontendSecrets();
  checkNpmAudit();

  const failed = results.filter((r) => r.status === 'FALLA').length;
  const warnings = results.filter((r) => r.status === 'ADVERTENCIA').length;
  console.log(`\nResultado: ${results.length - failed - warnings} OK, ${warnings} advertencia(s), ${failed} falla(s)`);
  process.exit(failed > 0 ? 1 : 0);
};

main().catch((err) => {
  console.error('Auditoría interrumpida:', err instanceof Error ? err.message : err);
  removeDb();
  process.exit(1);
});
