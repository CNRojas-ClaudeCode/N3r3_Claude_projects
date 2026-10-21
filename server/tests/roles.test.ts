import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { can, permissionsFor } from '../src/auth/permissions';
import { PERMISSIONS, ROLES } from '../src/auth/roles.generated';

const root = path.resolve(__dirname, '..', '..');

describe('Matriz de roles (ROLES.md)', () => {
  it('roles.generated.ts está sincronizado con ROLES.md', async () => {
    const generator = (await import(path.join(root, 'scripts', 'generate-roles.mjs'))) as {
      parseRolesMarkdown: (md: string) => unknown;
      renderGenerated: (m: unknown) => string;
    };
    const md = fs.readFileSync(path.join(root, 'ROLES.md'), 'utf8');
    const expected = generator.renderGenerated(generator.parseRolesMarkdown(md));
    const actual = fs.readFileSync(path.join(root, 'server', 'src', 'auth', 'roles.generated.ts'), 'utf8');
    expect(actual).toBe(expected);
  });

  it('existen exactamente los roles oficiales', () => {
    expect([...ROLES].sort()).toEqual(['ADMINISTRADOR', 'EMPLEADO']);
  });

  it('ADMINISTRADOR tiene los permisos de la matriz oficial', () => {
    const expected = [
      'dashboard.view',
      'products.view',
      'products.create',
      'products.update',
      'products.delete',
      'clients.view',
      'clients.create',
      'clients.update',
      'invoices.view',
      'invoices.create',
      'invoices.void',
      'portfolio.view',
      'payments.create',
      'installments.create',
      'users.manage',
      'roles.view',
      'audit.view',
      'training.view',
      'training.manage',
      'profile.self',
    ];
    expect(permissionsFor('ADMINISTRADOR').sort()).toEqual([...expected].sort());
  });

  it('EMPLEADO tiene exactamente los permisos permitidos', () => {
    const expected = [
      'dashboard.view',
      'products.view',
      'clients.view',
      'clients.create',
      'clients.update',
      'invoices.view',
      'invoices.create',
      'portfolio.view',
      'payments.create',
      'installments.create',
      'training.view',
      'profile.self',
    ];
    expect(permissionsFor('EMPLEADO').sort()).toEqual([...expected].sort());
  });

  it.each([
    ['crear/editar usuarios y gestionar permisos', 'users.manage'],
    ['ver roles', 'roles.view'],
    ['ver bitácora', 'audit.view'],
    ['crear productos', 'products.create'],
    ['editar productos', 'products.update'],
    ['eliminar productos', 'products.delete'],
    ['anular facturas', 'invoices.void'],
    ['administrar capacitación', 'training.manage'],
  ])('EMPLEADO NO puede %s (%s)', (_label, permission) => {
    expect(can('EMPLEADO', permission)).toBe(false);
  });

  it('deniega por defecto roles y permisos desconocidos', () => {
    expect(can('SUPERADMIN', 'dashboard.view')).toBe(false);
    expect(can('administrador', 'dashboard.view')).toBe(false);
    expect(can(undefined, 'dashboard.view')).toBe(false);
    expect(can(null, 'dashboard.view')).toBe(false);
    expect(can('ADMINISTRADOR', 'permiso.inexistente')).toBe(false);
    expect(can('ADMINISTRADOR', '')).toBe(false);
  });

  it('cada permiso declara solo roles válidos', () => {
    for (const p of PERMISSIONS) {
      for (const r of p.roles) expect(ROLES as readonly string[]).toContain(r);
    }
  });
});
