import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type TestAgent from 'supertest/lib/agent';
import { app, createUser, loggedAgent, prisma, uniqueEmail } from './helpers';

type Endpoint = { method: 'get' | 'post' | 'patch' | 'delete'; path: string; body?: object };

const productBody = () => ({
  code: `P-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
  name: 'Cuaderno',
  type: 'PRODUCTO',
  priceCents: 2500,
  stock: 10,
});

let productId = '';
let targetUserId = '';
let clientId = '';
let invoiceId = '';
let trainingId = '';
let inactiveTrainingId = '';

const createCreditInvoice = (quantity = 1) =>
  prisma.invoice.create({
    data: {
      folio: 900_000 + Math.floor(Math.random() * 99_999),
      clientId,
      paymentType: 'CREDITO',
      totalCents: 2500 * quantity,
      balanceCents: 2500 * quantity,
      createdById: 'seed',
      createdByName: 'Prueba',
      items: {
        create: {
          productId,
          code: 'BASE',
          name: 'Cuaderno',
          productType: 'PRODUCTO',
          quantity,
          unitPriceCents: 2500,
          lineTotalCents: 2500 * quantity,
        },
      },
    },
  });

const call = (agent: TestAgent | ReturnType<typeof request>, e: Endpoint) => {
  const req = agent[e.method](e.path);
  return e.body ? req.send(e.body) : e.method === 'get' ? req : req.send({});
};

beforeAll(async () => {
  const product = await prisma.product.create({ data: { ...productBody(), code: `BASE-${Date.now()}` } });
  productId = product.id;
  targetUserId = (await createUser()).id;
  clientId = (await prisma.client.create({ data: { name: 'Cliente Base' } })).id;
  invoiceId = (await createCreditInvoice()).id;
  trainingId = (await prisma.trainingMaterial.create({ data: { title: 'Caja', category: 'Ventas', content: 'Paso 1' } })).id;
  inactiveTrainingId = (
    await prisma.trainingMaterial.create({
      data: { title: 'Borrador', category: 'Interno', content: 'No publicado', active: false },
    })
  ).id;
});

const protectedEndpoints = (): Endpoint[] => [
  { method: 'get', path: '/api/auth/me' },
  { method: 'get', path: '/api/dashboard' },
  { method: 'get', path: '/api/profile' },
  { method: 'get', path: '/api/products' },
  { method: 'post', path: '/api/products', body: productBody() },
  { method: 'patch', path: `/api/products/${productId}`, body: { name: 'Nuevo nombre' } },
  { method: 'delete', path: `/api/products/${productId}` },
  { method: 'get', path: '/api/users' },
  { method: 'post', path: '/api/users' },
  { method: 'patch', path: `/api/users/${targetUserId}`, body: { name: 'X Y' } },
  { method: 'post', path: `/api/users/${targetUserId}/unlock` },
  { method: 'get', path: '/api/roles' },
  { method: 'get', path: '/api/audit' },
  { method: 'get', path: '/api/clients' },
  { method: 'post', path: '/api/clients', body: { name: 'Cliente Nuevo' } },
  { method: 'patch', path: `/api/clients/${clientId}`, body: { name: 'Otro Nombre' } },
  { method: 'get', path: '/api/invoices' },
  { method: 'get', path: `/api/invoices/${invoiceId}` },
  { method: 'post', path: '/api/invoices' },
  { method: 'post', path: `/api/invoices/${invoiceId}/void`, body: { reason: 'Prueba sin sesión' } },
  { method: 'post', path: `/api/invoices/${invoiceId}/payments`, body: { method: 'EFECTIVO' } },
  { method: 'post', path: `/api/invoices/${invoiceId}/installments`, body: { method: 'EFECTIVO', amountCents: 100 } },
  { method: 'get', path: '/api/portfolio' },
  { method: 'get', path: '/api/training' },
  { method: 'post', path: '/api/training' },
  { method: 'patch', path: `/api/training/${trainingId}`, body: { title: 'Cambio' } },
];

describe('Endpoints sin sesión', () => {
  it('todos los endpoints protegidos responden 401', async () => {
    for (const e of protectedEndpoints()) {
      const res = await call(request(app), e);
      expect(res.status, `${e.method.toUpperCase()} ${e.path}`).toBe(401);
    }
  });

  it('el healthcheck es público', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});

describe('Rol EMPLEADO (rol inferior)', () => {
  let agent: TestAgent;
  beforeAll(async () => {
    ({ agent } = await loggedAgent('EMPLEADO'));
  });

  it.each<[string, () => Endpoint]>([
    ['crear productos', () => ({ method: 'post', path: '/api/products', body: productBody() })],
    ['editar productos', () => ({ method: 'patch', path: `/api/products/${productId}`, body: { name: 'Hack' } })],
    ['eliminar productos', () => ({ method: 'delete', path: `/api/products/${productId}` })],
    ['listar usuarios', () => ({ method: 'get', path: '/api/users' })],
    [
      'crear usuarios',
      () => ({
        method: 'post',
        path: '/api/users',
        body: { email: uniqueEmail(), name: 'Nuevo', role: 'ADMINISTRADOR', password: 'Clave123*Segura' },
      }),
    ],
    ['editar usuarios', () => ({ method: 'patch', path: `/api/users/${targetUserId}`, body: { role: 'ADMINISTRADOR' } })],
    ['desbloquear usuarios', () => ({ method: 'post', path: `/api/users/${targetUserId}/unlock` })],
    ['ver roles', () => ({ method: 'get', path: '/api/roles' })],
    ['ver bitácora', () => ({ method: 'get', path: '/api/audit' })],
    ['anular facturas', () => ({ method: 'post', path: `/api/invoices/${invoiceId}/void`, body: { reason: 'Intento' } })],
    [
      'crear capacitación',
      () => ({ method: 'post', path: '/api/training', body: { title: 'Nuevo', category: 'Ventas', content: 'X' } }),
    ],
    ['editar capacitación', () => ({ method: 'patch', path: `/api/training/${trainingId}`, body: { active: false } })],
  ])('no puede %s (403)', async (_label, endpoint) => {
    const res = await call(agent, endpoint());
    expect(res.status).toBe(403);
  });

  it('las acciones denegadas no modifican datos', async () => {
    const product = await prisma.product.findUniqueOrThrow({ where: { id: productId } });
    expect(product.deletedAt).toBeNull();
    expect(product.name).toBe('Cuaderno');
    const target = await prisma.user.findUniqueOrThrow({ where: { id: targetUserId } });
    expect(target.role).toBe('EMPLEADO');
    const invoice = await prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
    expect(invoice.status).toBe('VIGENTE');
    const training = await prisma.trainingMaterial.findUniqueOrThrow({ where: { id: trainingId } });
    expect(training.active).toBe(true);
  });

  it('puede ver, crear y editar clientes', async () => {
    expect((await agent.get('/api/clients')).status).toBe(200);
    const created = await agent.post('/api/clients').send({ name: 'Cliente Empleado' });
    expect(created.status).toBe(201);
    expect((await agent.patch(`/api/clients/${created.body.id}`).send({ phone: '555 123 4567' })).status).toBe(200);
  });

  it('puede crear y consultar facturas, ver cartera y registrar pagos y abonos', async () => {
    const created = await agent
      .post('/api/invoices')
      .send({ clientId, paymentType: 'CREDITO', items: [{ productId, quantity: 2 }] });
    expect(created.status).toBe(201);
    expect((await agent.get(`/api/invoices/${created.body.id}`)).status).toBe(200);
    expect((await agent.get('/api/portfolio')).status).toBe(200);
    const installment = await agent
      .post(`/api/invoices/${created.body.id}/installments`)
      .send({ method: 'EFECTIVO', amountCents: 1000 });
    expect(installment.status).toBe(201);
    const payment = await agent.post(`/api/invoices/${created.body.id}/payments`).send({ method: 'TARJETA' });
    expect(payment.status).toBe(201);
    expect(payment.body.balanceCents).toBe(0);
  });

  it('solo ve material de capacitación activo', async () => {
    const list = await agent.get('/api/training');
    expect(list.status).toBe(200);
    const ids = (list.body.items as { id: string }[]).map((t) => t.id);
    expect(ids).toContain(trainingId);
    expect(ids).not.toContain(inactiveTrainingId);
    expect((await agent.get(`/api/training/${inactiveTrainingId}`)).status).toBe(404);
  });

  it('puede ver dashboard, productos y su perfil', async () => {
    expect((await agent.get('/api/dashboard')).status).toBe(200);
    expect((await agent.get('/api/products')).status).toBe(200);
    expect((await agent.get(`/api/products/${productId}`)).status).toBe(200);
    expect((await agent.get('/api/profile')).status).toBe(200);
  });

  it('el dashboard no expone métricas de usuarios', async () => {
    const res = await agent.get('/api/dashboard');
    expect(res.body.users).toBeUndefined();
  });

  it('no puede escalar privilegios desde su perfil', async () => {
    const res = await agent.patch('/api/profile').send({ name: 'Empleado', role: 'ADMINISTRADOR' });
    expect(res.status).toBe(400);
    const me = await agent.get('/api/auth/me');
    expect(me.body.user.role).toBe('EMPLEADO');
    expect(me.body.permissions).not.toContain('users.manage');
  });
});

describe('Rol ADMINISTRADOR', () => {
  let agent: TestAgent;
  let adminId: string;
  beforeAll(async () => {
    const logged = await loggedAgent('ADMINISTRADOR');
    agent = logged.agent;
    adminId = logged.user.id;
  });

  it('gestiona productos (crear, editar, eliminar con bitácora)', async () => {
    const created = await agent.post('/api/products').send(productBody());
    expect(created.status).toBe(201);
    const updated = await agent.patch(`/api/products/${created.body.id}`).send({ priceCents: 3000 });
    expect(updated.status).toBe(200);
    expect((await agent.delete(`/api/products/${created.body.id}`)).status).toBe(204);
    expect(await prisma.auditLog.count({ where: { action: 'PRODUCT_DELETED', targetId: created.body.id } })).toBe(1);
  });

  it('anula facturas con motivo, devuelve existencias y registra en bitácora', async () => {
    const invoice = await createCreditInvoice(3);
    const before = await prisma.product.findUniqueOrThrow({ where: { id: productId } });
    const res = await agent.post(`/api/invoices/${invoice.id}/void`).send({ reason: 'Error de captura' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ANULADA');
    const after = await prisma.product.findUniqueOrThrow({ where: { id: productId } });
    expect(after.stock).toBe((before.stock ?? 0) + 3);
    expect(await prisma.auditLog.count({ where: { action: 'INVOICE_VOIDED', targetId: invoice.id } })).toBe(1);
    expect((await agent.post(`/api/invoices/${invoice.id}/void`).send({ reason: 'Otra vez' })).status).toBe(409);
  });

  it('administra capacitación y ve el material inactivo', async () => {
    const created = await agent
      .post('/api/training')
      .send({ title: 'Cierre de caja', category: 'Ventas', content: 'Contar efectivo', url: 'https://example.com/v' });
    expect(created.status).toBe(201);
    expect((await agent.patch(`/api/training/${created.body.id}`).send({ active: false })).status).toBe(200);
    expect((await agent.get(`/api/training/${inactiveTrainingId}`)).status).toBe(200);
    const unsafe = await agent
      .post('/api/training')
      .send({ title: 'Enlace', category: 'Ventas', content: 'X', url: 'javascript:alert(1)' });
    expect(unsafe.status).toBe(400);
  });

  it('accede a usuarios, roles y bitácora', async () => {
    expect((await agent.get('/api/users')).status).toBe(200);
    expect((await agent.get('/api/roles')).status).toBe(200);
    expect((await agent.get('/api/audit')).status).toBe(200);
  });

  it('crea usuarios con cambio de contraseña obligatorio', async () => {
    const res = await agent
      .post('/api/users')
      .send({ email: uniqueEmail(), name: 'Nuevo Empleado', role: 'EMPLEADO', password: 'Inicial123*Spa' });
    expect(res.status).toBe(201);
    expect(res.body.mustChangePassword).toBe(true);
  });

  it('cambiar rol o desactivar invalida las sesiones del usuario afectado', async () => {
    const { agent: employee, user } = await loggedAgent('EMPLEADO');
    expect((await agent.patch(`/api/users/${user.id}`).send({ active: false })).status).toBe(200);
    expect((await employee.get('/api/auth/me')).status).toBe(401);
    const actions = await prisma.auditLog.findMany({ where: { targetId: user.id }, select: { action: true } });
    expect(actions.map((a) => a.action)).toContain('USER_DEACTIVATED');
  });

  it('registra el cambio de rol en bitácora', async () => {
    const user = await createUser();
    expect((await agent.patch(`/api/users/${user.id}`).send({ role: 'ADMINISTRADOR' })).status).toBe(200);
    expect(await prisma.auditLog.count({ where: { action: 'USER_ROLE_CHANGED', targetId: user.id } })).toBe(1);
  });

  it('no puede desactivarse ni cambiarse el rol a sí mismo', async () => {
    expect((await agent.patch(`/api/users/${adminId}`).send({ active: false })).status).toBe(400);
    expect((await agent.patch(`/api/users/${adminId}`).send({ role: 'EMPLEADO' })).status).toBe(400);
  });
});
