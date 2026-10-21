# SPA Nereyda

Aplicación web (PWA) para centralizar la gestión de una miscelánea que hoy trabaja con hojas de cálculo:
usuarios, productos y servicios, clientes, facturación, cartera y capacitación.

- **Frontend:** React + Vite + TypeScript (`client/`)
- **Backend:** Node.js + Express + TypeScript (`server/`)
- **Base de datos:** SQLite con Prisma (migraciones versionadas en `server/prisma/migrations`)
- **Despliegue:** Railway (un solo servicio: la API sirve también el frontend compilado)

> Estado: Bloque 1 y Bloque 2 completos (MVP / demo).

## Módulos

| Módulo | Qué hace | ADMINISTRADOR | EMPLEADO |
|---|---|---|---|
| Dashboard | Ventas de hoy, cartera por cobrar y vencida, stock bajo, últimas facturas | ✅ | ✅ |
| Productos y servicios | Catálogo con precios y existencias; eliminación lógica | Ver, crear, editar, eliminar | Ver |
| Clientes | Directorio con RFC y días de crédito; se desactivan, no se eliminan | Ver, crear, editar | Ver, crear, editar |
| Facturación | Notas de venta de contado o a crédito con folio consecutivo; descuentan existencias | Consultar, crear, anular | Consultar, crear |
| Cartera | Saldos pendientes, facturas vencidas, pagos (liquidan) y abonos (parciales) | ✅ | ✅ |
| Capacitación | Guías de texto con enlace opcional; se publican u ocultan | Ver y administrar | Ver publicadas |
| Usuarios, Roles, Bitácora | Administración del sistema | ✅ | ❌ |
| Mi perfil | Datos propios y cambio de contraseña | ✅ | ✅ |

La matriz completa de permisos está en [ROLES.md](ROLES.md); todo lo no permitido está denegado.

## Requisitos

- Node.js 20.12 o superior (recomendado 22 LTS)

## Puesta en marcha local

```bash
npm install
```

```bash
cp server/.env.example server/.env
```

```bash
npm run db:deploy
```

Seed manual e idempotente (nunca se ejecuta solo). Crea el Super Admin y un usuario de prueba por rol:

```bash
npm run db:seed
```

Opcional, solo en local: datos demo (27 productos y servicios, 5 clientes, 4 facturas y 4 materiales de capacitación). Es idempotente y se bloquea en producción:

```bash
npm run db:seed:demo
```

En dos terminales:

```bash
npm run dev:server
```

```bash
npm run dev:client
```

Abrir http://localhost:5173.

| Usuario | Rol | Contraseña |
|---|---|---|
| `admin@datly.local` | ADMINISTRADOR (Super Admin) | `Admin123*` (pide cambiarla en el primer acceso) |
| `administrador.prueba@datly.local` | ADMINISTRADOR | `SEED_TEST_PASSWORD` de `server/.env` |
| `empleado.prueba@datly.local` | EMPLEADO | `SEED_TEST_PASSWORD` de `server/.env` |

En desarrollo, los correos de recuperación de contraseña se guardan en `server/.mail-outbox/`.

## Scripts

| Comando | Descripción |
|---|---|
| `npm run build` | Genera permisos desde ROLES.md y Prisma Client, y compila backend y frontend (PWA) |
| `npm start` | Aplica migraciones y arranca el servidor (producción) |
| `npm run typecheck` | Verificación de tipos de backend y frontend |
| `npm test` | Pruebas de autenticación, roles, autorización y bloqueo de login |
| `npm run audit:security` | Auditoría de seguridad automatizada (requiere `npm run build` antes) |
| `npm run db:migrate` | Crea una nueva migración en desarrollo |
| `npm run db:deploy` | Aplica las migraciones pendientes |
| `npm run db:seed` / `db:seed:demo` | Seed obligatorio / datos demo (solo local) |
| `npm run roles:generate` | Regenera la matriz de permisos desde `ROLES.md` |
| `npm run icons:generate` | Regenera los iconos PWA |

## Auditoría de seguridad

```bash
npm run build
```

```bash
npm run audit:security
```

Levanta el servidor compilado contra una base temporal, con usuarios propios, y la elimina al terminar. Verifica:
endpoints sin sesión (401), endpoints con rol inferior (403), bloqueo al sexto intento, reinicio del contador tras
un acceso correcto, mensaje idéntico para credenciales inválidas, recuperación con la misma respuesta exista o no
el email, búsqueda de secretos en `client/dist` y `npm audit`. Sale con código 1 si alguna verificación falla.

La verificación manual completa está en [CHECKLIST-QA.md](CHECKLIST-QA.md).

## Railway

1. Crear el servicio desde el repositorio de GitHub (`railway.json` define build, start y healthcheck `/api/health`).
2. Montar un **volumen** en `/data`. Sin volumen, la base SQLite se pierde en cada despliegue.
3. Variables: `NODE_ENV=production`, `DATABASE_URL=file:/data/app.db`, `APP_URL=https://<dominio>`, `TRUST_PROXY=1`.
4. Tras el primer despliegue, ejecutar el seed manualmente: `npm run db:seed:prod -w server`.

`npm start` aplica las migraciones pendientes antes de arrancar. Los datos demo nunca se cargan en producción.

## Arquitectura

- **Capa única de datos:** solo `server/src/data/*` importa Prisma. Para migrar a PostgreSQL hay que cambiar el
  `provider`, agregar `mode: 'insensitive'` a las búsquedas y reescribir los triggers de bitácora y pagos (SUPUESTOS S-14, S-18, S-33).
- **Permisos:** `ROLES.md` → `scripts/generate-roles.mjs` → `server/src/auth/roles.generated.ts`. Cada ruta exige su permiso con `requirePermission`.
- **Importes:** siempre en centavos (enteros).
- **Sesión:** token opaco en cookie httpOnly, `sameSite=strict`, `secure` en producción; ningún token en el navegador.

## Documentos

- [ROLES.md](ROLES.md): matriz oficial de permisos
- [SUPUESTOS.md](SUPUESTOS.md): decisiones tomadas ante ambigüedades
- [CHECKLIST-QA.md](CHECKLIST-QA.md): casos de prueba manuales
