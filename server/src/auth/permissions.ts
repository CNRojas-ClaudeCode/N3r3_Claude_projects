import { PERMISSIONS, ROLES } from './roles.generated';

export type Role = (typeof ROLES)[number];
export type Permission = (typeof PERMISSIONS)[number]['key'];

const matrix = new Map<string, ReadonlySet<string>>(
  PERMISSIONS.map((p) => [p.key, new Set<string>(p.roles)]),
);

export const isRole = (value: unknown): value is Role =>
  typeof value === 'string' && (ROLES as readonly string[]).includes(value);

/** Denegación por defecto: rol o permiso desconocido => false. */
export const can = (role: string | null | undefined, permission: string): boolean => {
  if (!role || !isRole(role)) return false;
  return matrix.get(permission)?.has(role) ?? false;
};

export const permissionsFor = (role: string): Permission[] =>
  PERMISSIONS.filter((p) => can(role, p.key)).map((p) => p.key);

export const rolesMatrix = () => ({
  roles: [...ROLES],
  permissions: PERMISSIONS.map((p) => ({ ...p, roles: [...p.roles] })),
});
