/**
 * Seed idempotente. Ejecución manual únicamente: npm run db:seed
 * - Crea los usuarios solo si no existen; nunca modifica ni restablece usuarios existentes.
 * - No imprime contraseñas.
 */
import { config } from '../config';
import { disconnectDatabase, usersRepo } from '../data';
import { hashPassword } from '../lib/crypto';
import { passwordSchema } from '../lib/validation';
import type { Role } from '../auth/permissions';

// Credencial obligatoria del requerimiento. Tiene menos de 12 caracteres: se exceptúa de la política
// solo en el seed y se fuerza el cambio en el primer acceso (decisión "Opción A", ver SUPUESTOS.md).
const SUPER_ADMIN = { email: 'admin@datly.local', name: 'Super Admin', role: 'ADMINISTRADOR' as Role, password: 'Admin123*' };

const testPassword = process.env.SEED_TEST_PASSWORD ?? '';

const TEST_USERS: { email: string; name: string; role: Role }[] = [
  { email: 'administrador.prueba@datly.local', name: 'Administrador de Prueba', role: 'ADMINISTRADOR' },
  { email: 'empleado.prueba@datly.local', name: 'Empleado de Prueba', role: 'EMPLEADO' },
];

const ensureUser = async (u: { email: string; name: string; role: Role; password: string; mustChangePassword: boolean }) => {
  if (await usersRepo.findByEmail(u.email)) {
    console.log(`- ${u.email}: ya existe (sin cambios)`);
    return;
  }
  await usersRepo.create({
    email: u.email,
    name: u.name,
    role: u.role,
    active: true,
    mustChangePassword: u.mustChangePassword,
    passwordHash: await hashPassword(u.password),
  });
  console.log(`- ${u.email}: creado (${u.role})`);
};

const main = async () => {
  console.log(`Seed (${config.NODE_ENV})`);
  await ensureUser({ ...SUPER_ADMIN, mustChangePassword: true });

  if (!passwordSchema.safeParse(testPassword).success) {
    console.warn('SEED_TEST_PASSWORD ausente o no cumple la política (mín. 12 caracteres): usuarios de prueba omitidos');
    return;
  }
  for (const u of TEST_USERS) await ensureUser({ ...u, password: testPassword, mustChangePassword: false });
};

main()
  .catch((err) => {
    console.error('Seed fallido:', err instanceof Error ? err.message : 'desconocido');
    process.exitCode = 1;
  })
  .finally(() => void disconnectDatabase());
