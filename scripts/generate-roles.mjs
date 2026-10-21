// Genera server/src/auth/roles.generated.ts a partir de la tabla oficial en ROLES.md.
// Uso: node scripts/generate-roles.mjs [--check]
//   --check  no escribe; termina con código 1 si el archivo generado está desactualizado.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rolesMdPath = path.join(root, 'ROLES.md');
const outPath = path.join(root, 'server', 'src', 'auth', 'roles.generated.ts');

const ALLOW = '✅';
const PERMISSION_KEY = /^[a-z]+(\.[a-z]+)+$/;
const ROLE_NAME = /^[A-Z_]+$/;

export function parseRolesMarkdown(markdown) {
  const start = markdown.indexOf('<!-- roles:matrix:start -->');
  const end = markdown.indexOf('<!-- roles:matrix:end -->');
  if (start === -1 || end === -1 || end < start) {
    throw new Error('ROLES.md: no se encontraron los marcadores de la matriz');
  }
  const lines = markdown
    .slice(start, end)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.startsWith('|'));

  const cells = (line) => line.replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
  const header = cells(lines[0]);
  const roles = header.slice(3);
  if (roles.length === 0 || !roles.every((r) => ROLE_NAME.test(r))) {
    throw new Error('ROLES.md: encabezado de roles inválido');
  }

  const permissions = [];
  const seen = new Set();
  for (const line of lines.slice(2)) {
    const row = cells(line);
    const key = row[0].replace(/`/g, '');
    if (!PERMISSION_KEY.test(key)) throw new Error(`ROLES.md: clave de permiso inválida "${row[0]}"`);
    if (seen.has(key)) throw new Error(`ROLES.md: permiso duplicado "${key}"`);
    seen.add(key);
    const allowed = roles.filter((_, i) => row[3 + i] === ALLOW);
    permissions.push({ key, module: row[1], description: row[2], roles: allowed });
  }
  return { roles, permissions };
}

export function renderGenerated({ roles, permissions }) {
  return `// ARCHIVO GENERADO desde ROLES.md — no editar manualmente.
// Regenerar con: npm run roles:generate
export const ROLES = ${JSON.stringify(roles)} as const;

export const PERMISSIONS = ${JSON.stringify(permissions, null, 2)} as const;
`;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const output = renderGenerated(parseRolesMarkdown(fs.readFileSync(rolesMdPath, 'utf8')));
  if (process.argv.includes('--check')) {
    const current = fs.existsSync(outPath) ? fs.readFileSync(outPath, 'utf8') : '';
    if (current !== output) {
      console.error('roles.generated.ts está desactualizado. Ejecute: npm run roles:generate');
      process.exit(1);
    }
    console.log('roles.generated.ts sincronizado con ROLES.md');
  } else {
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, output, 'utf8');
    console.log('roles.generated.ts generado desde ROLES.md');
  }
}
