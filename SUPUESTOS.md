# SUPUESTOS — SPA Nereyda

Registro de ambigüedades y decisiones tomadas de forma autónoma (criterio: la opción más conservadora).
Formato por entrada: ambigüedad · decisión · impacto · cómo cambiarla.

---

## Bloque 1

### S-01 · Contraseña del seed vs. política de 12 caracteres
- **Ambigüedad:** la credencial obligatoria `Admin123*` (9 caracteres) contradice la política mínima de 12.
- **Decisión (Opción A, confirmada por la usuaria):** el seed exceptúa solo esa cuenta de la política y la marca con `mustChangePassword`; en el primer acceso únicamente puede cambiar su contraseña (backend responde `403 PASSWORD_CHANGE_REQUIRED` en el resto de endpoints).
- **Impacto:** la credencial débil solo sirve para el primer ingreso.
- **Cómo cambiarla:** `server/src/scripts/seed.ts` (`SUPER_ADMIN`).

### S-02 · "Super Admin" no es un rol de la matriz
- **Ambigüedad:** la matriz oficial solo define ADMINISTRADOR y EMPLEADO.
- **Decisión:** "Super Admin" es el **nombre** del usuario seed; su rol es ADMINISTRADOR. No se crea un tercer rol.
- **Impacto:** ninguno sobre permisos.
- **Cómo cambiarla:** agregar una columna de rol en `ROLES.md` y ejecutar `npm run roles:generate`.

### S-03 · Usuarios de prueba por rol
- **Decisión:** `administrador.prueba@datly.local` (ADMINISTRADOR) y `empleado.prueba@datly.local` (EMPLEADO). Contraseña tomada de `SEED_TEST_PASSWORD` (`server/.env.example`); si no cumple la política, se omiten.
- **Impacto:** el seed nunca imprime contraseñas y nunca modifica usuarios existentes (idempotente).
- **Cómo cambiarla:** `TEST_USERS` en `server/src/scripts/seed.ts`.

### S-04 · Permisos implícitos del ADMINISTRADOR
- **Ambigüedad:** la lista del ADMINISTRADOR no menciona "ver productos", "ver clientes" ni "ver capacitación", pero sí crear/editar/administrar.
- **Decisión:** se le otorgan `products.view`, `clients.view` y `training.view` (necesarios para operar lo que sí puede editar). `profile.self` se otorga a ambos roles (núcleo estándar).
- **Impacto:** visible en `ROLES.md`.
- **Cómo cambiarla:** editar `ROLES.md` → `npm run roles:generate` → `npm test`.

### S-05 · Fuente oficial de permisos
- **Decisión:** `ROLES.md` contiene la matriz; `scripts/generate-roles.mjs` genera `server/src/auth/roles.generated.ts` (también en cada `build`). Una prueba falla si están desincronizados. Cualquier celda distinta de ✅ es denegación; rol o permiso desconocido = denegado.
- **Cómo cambiarla:** ver S-04.

### S-06 · Sesiones
- **Ambigüedad:** no se especifica JWT vs. sesión en servidor.
- **Decisión:** token opaco aleatorio (256 bits) en cookie `httpOnly`, `sameSite=strict`, `secure` en producción (prefijo `__Host-`). En BD solo se guarda su SHA-256. Duración 12 h (`SESSION_TTL_HOURS`). Permite invalidar sesiones al instante.
- **Impacto:** en desarrollo (http) la cookie no es `secure`, para que el login funcione en local.
- **Cómo cambiarla:** `server/src/middleware/auth.ts`, `server/src/config.ts`.

### S-07 · Invalidación de sesiones
- **Decisión:** el cambio o restablecimiento de contraseña elimina **todas** las sesiones del usuario; en el cambio desde el perfil se emite una sesión nueva solo para el dispositivo actual. El cambio de rol y la desactivación también cierran las sesiones del usuario afectado.
- **Cómo cambiarla:** `server/src/services/auth.service.ts`, `users.service.ts`.

### S-08 · Bloqueo por usuario y por IP
- **Decisión:** ambos contadores usan el mismo umbral (5 fallos → 15 min). El de IP cuenta fallos contra cualquier email, incluso inexistentes. Un acceso correcto reinicia ambos. Al vencer el bloqueo, el contador vuelve a cero. El bloqueo por IP vence solo (no hay desbloqueo manual de IP).
- **Impacto:** varios empleados detrás de la misma IP pública podrían bloquearse entre sí tras 5 fallos combinados.
- **Cómo cambiarla:** `config.security` en `server/src/config.ts`.

### S-09 · Mensaje genérico en login
- **Decisión:** cualquier fallo (inexistente, contraseña, bloqueado, inactivo, IP bloqueada, cuerpo inválido) responde `401 {"message":"Email o contraseña incorrectos"}`. Siempre se ejecuta bcrypt (hash ficticio si el usuario no existe) para igualar los tiempos. El motivo real solo queda en la bitácora (visible únicamente para administradores).

### S-10 · Recuperación de contraseña y proveedor de correo
- **Ambigüedad:** no se definió un proveedor de correo (SMTP o API).
- **Decisión:** token de 256 bits, guardado como SHA-256, de un solo uso, que expira a los 45 min (configurable entre 30 y 60). Una nueva solicitud invalida los tokens anteriores. La respuesta es idéntica (202 y el mismo texto) exista o no el email, y el proceso corre en segundo plano para no revelar nada por el tiempo de respuesta. **Sin proveedor**: en desarrollo y test el correo se escribe en `server/.mail-outbox/` (ignorado por git); en producción no se envía y queda una advertencia en el log, sin el token.
- **Impacto:** en producción la recuperación no entrega emails hasta configurar un proveedor.
- **Cómo cambiarla:** implementar el envío en `server/src/services/mailer.ts` (**pendiente de confirmación**).

### S-11 · Edición de datos propios
- **Decisión:** desde "Mi perfil" el usuario solo edita su **nombre**. El email (identidad de login) y el rol solo los cambia un administrador. Un esquema `strict` rechaza campos extra, así que nadie puede escalar privilegios desde el perfil.
- **Cómo cambiarla:** `server/src/routes/profile.routes.ts`.

### S-12 · Protección del último administrador
- **Decisión:** un administrador no puede desactivarse ni cambiarse el rol a sí mismo, y no se permite dejar el sistema sin administradores activos.
- **Cómo cambiarla:** `server/src/services/users.service.ts`.

### S-13 · Usuarios creados por un administrador
- **Decisión:** la contraseña inicial que define el administrador es temporal: el usuario debe cambiarla en su primer acceso.

### S-14 · Bitácora inmutable y retención
- **Decisión:** la capa de datos solo expone inserción y lectura. Además, triggers de SQLite (migración `init`) bloquean cualquier `UPDATE` y cualquier `DELETE` de registros con menos de 90 días. La purga de registros vencidos corre al iniciar el servidor y cada 24 h. No se registran lecturas ni ediciones de productos (solo eliminaciones de negocio).
- **Impacto:** al migrar a PostgreSQL hay que reescribir los triggers (están en SQL de SQLite).
- **Cómo cambiarla:** `server/prisma/migrations/*_init/migration.sql`, `server/src/index.ts`.

### S-15 · Eliminación de productos
- **Decisión:** la eliminación es lógica (`deletedAt`) para no romper facturas futuras. Queda registrada en la bitácora (`PRODUCT_DELETED`). El código de un producto eliminado sigue reservado.
- **Cómo cambiarla:** `server/src/services/products.service.ts`.

### S-16 · Modelo de Producto
- **Decisión:** campos código (único, mayúsculas), nombre, descripción, tipo (PRODUCTO/SERVICIO), precio en **centavos** (entero, sin errores de redondeo), existencias (null para servicios) y activo. "Stock bajo" = 5 unidades o menos (`config.business.lowStockThreshold`).
- **Cómo cambiarla:** `server/prisma/schema.prisma` (requiere nueva migración).

### S-17 · Moneda y configuración regional
- **Ambigüedad:** no se indicó el país.
- **Decisión:** `es-MX` / `MXN`, por la razón social de la organización (S.A. de C.V.).
- **Cómo cambiarla:** `client/src/config.ts`.

### S-18 · Portabilidad a PostgreSQL
- **Decisión:** no se usan enums nativos (roles y tipos son `String` validados con Zod). Todo acceso a datos pasa por `server/src/data/*` (único lugar que importa Prisma). Las búsquedas usan `contains`, que en SQLite no distingue mayúsculas.
- **Impacto:** en PostgreSQL hay que agregar `mode: 'insensitive'` a las búsquedas y rehacer los triggers de la bitácora.

### S-19 · Defensa CSRF
- **Decisión:** además de `sameSite=strict`, las peticiones que modifican datos exigen `Content-Type: application/json` y un `Origin` permitido (`APP_URL` + `CORS_ORIGINS`).

### S-20 · Rate limiting
- **Decisión:** límite global de 300 solicitudes / 15 min por IP en `/api`, y de 30 / 15 min en login, recuperación y restablecimiento. Configurable por variables de entorno. El healthcheck queda fuera del límite.

### S-21 · PWA y auditoría Lighthouse
- **Ambigüedad:** Lighthouse 12+ eliminó la categoría "PWA", y en este proyecto está prohibido abrir el navegador.
- **Decisión:** se implementan todos los criterios de instalabilidad (manifest completo, iconos 192/512/maskable/apple 180, SW con `fetch`, página offline, HTTPS en Railway). El SW es propio, sin Workbox: precache del app shell, *cache first* para assets, *network first* para `GET /api/*` (excepto `auth`, `profile` y `health`, que no se cachean). La versión de caché es `v<versión>-<hash del build>` y las cachés antiguas se borran al activar el SW. El caché de datos se vacía al cerrar sesión. El SW se registra solo en producción.
- **Impacto:** la verificación con Lighthouse queda como paso manual en CHECKLIST-QA.md.

### S-22 · Fuente Inter
- **Decisión:** se sirve desde el propio dominio (`@fontsource-variable/inter`), no desde Google Fonts, para cumplir la CSP estricta y funcionar offline. Solo se precachea el subconjunto latino.

### S-23 · Breakpoints en CSS
- **Decisión:** las media queries no aceptan variables CSS. Los breakpoints (360/768/1024/1440) están documentados en `client/src/styles/tokens.css` y son los únicos valores que se usan en `@media`.

### S-24 · Despliegue Railway con SQLite
- **Decisión:** un solo servicio. Express sirve la API y el frontend compilado. `npm start` ejecuta `prisma migrate deploy` antes de arrancar (los volúmenes de Railway no están disponibles en el pre-deploy). Healthcheck en `/api/health` (verifica la BD).
- **Impacto:** **requiere un volumen** montado en `/data` y `DATABASE_URL=file:/data/app.db`; sin volumen, los datos se pierden en cada despliegue.

### S-25 · Restricciones del equipo local (Application Control de Windows)
- **Situación:** la política de Windows bloquea Git y binarios nativos sin firma en la carpeta del proyecto.
- **Decisiones:** `tsx` se fija en `4.20.6` (comparte el `esbuild` permitido). Rollup se sustituye por `@rollup/wasm-node` (versión WebAssembly oficial) mediante `overrides`. Funciona igual en Railway.
- **Impacto:** el build de Vite es algo más lento.
- **Cómo cambiarla:** quitar `devDependencies.rollup` y `overrides` del `package.json` raíz.

### S-27 · Resultado de `npm audit`
- **Decisión:** `react-router-dom` se actualizó a 7.18.4 (corrige un *open redirect*; mismo API en modo librería). Queda una alerta *high* en `deepmerge-ts`, que llega vía `@prisma/config`: la usa solo la CLI de Prisma para leer su propia configuración, no recibe datos de usuarios. Su corrección exige Prisma 7, un cambio mayor (archivo de configuración y adaptadores).
- **Impacto:** riesgo bajo; **pendiente de confirmación** la migración a Prisma 7.
- **Cómo cambiarla:** actualizar `prisma` y `@prisma/client` a 7.x y adaptar `server/src/data/prisma.ts`.

### S-28 · Datos demo
- **Decisión:** comando manual `npm run db:seed:demo`, separado del seed obligatorio. Carga 27 productos y servicios de miscelánea (incluye casos de stock bajo, agotado e inactivo). Es idempotente (no toca códigos existentes) y se niega a ejecutarse con `NODE_ENV=production`.
- **Cómo cambiarla:** `server/src/scripts/seed-demo.ts`.

### S-26 · bcrypt
- **Decisión:** se usa `bcryptjs` (implementación JS del mismo algoritmo, sin binario nativo; compatible con la política del equipo y con Railway), con cost 12. Se limita la contraseña a 72 bytes, el máximo que procesa bcrypt.

---

## Bloque 2

### S-29 · Clientes
- **Ambigüedad:** no se definieron los campos del cliente ni si se pueden eliminar.
- **Decisión:** nombre o razón social (obligatorio), RFC (opcional, único, validado con el formato del SAT), teléfono, email, dirección, días de crédito (0 a 365, 30 por defecto) y estado activo. La matriz no incluye "eliminar clientes", así que **no se eliminan**: se desactivan. Un cliente inactivo no se puede facturar.
- **Impacto:** el historial de facturas nunca pierde a su cliente.
- **Cómo cambiarla:** `server/prisma/schema.prisma` (modelo `Client`) y `server/src/routes/clients.routes.ts`.

### S-30 · Alcance fiscal de la factura
- **Ambigüedad:** "Facturación" puede significar CFDI (factura electrónica del SAT) o una nota de venta interna.
- **Decisión:** es una **nota de venta interna** con folio consecutivo (`F-000001`), no un CFDI timbrado. Los precios del catálogo **incluyen impuestos**, así que no se desglosa IVA.
- **Impacto:** para facturar electrónicamente hay que integrar un PAC (fuera del alcance del MVP).
- **Cómo cambiarla:** agregar el desglose en `server/src/data/invoices.repo.ts` y la integración con un PAC (**pendiente de confirmación**).

### S-31 · Partidas, precios y existencias
- **Decisión:** al facturar se copian el código, el nombre y el precio vigentes de cada producto, así los cambios posteriores del catálogo no alteran facturas emitidas. Las existencias se descuentan en la misma transacción y nunca quedan negativas (si no alcanzan, la factura se rechaza con `409`). Los servicios no descuentan existencias. No se facturan productos inactivos ni eliminados, y un producto no puede repetirse en dos partidas. Máximo 50 partidas por factura.
- **Cómo cambiarla:** `server/src/data/invoices.repo.ts`, `config.business.maxInvoiceItems`.

### S-32 · Contado y crédito
- **Decisión:** una factura de **contado** nace pagada: se registra automáticamente un pago por el total con el método elegido (efectivo, tarjeta o transferencia). Una factura a **crédito** nace con saldo igual al total y vence en la fecha de emisión más los días de crédito del cliente.
- **Cómo cambiarla:** `server/src/services/invoices.service.ts`.

### S-33 · Pagos y abonos
- **Ambigüedad:** la matriz distingue "registrar pagos" de "registrar abonos" sin definir la diferencia.
- **Decisión:** un **pago** liquida el saldo completo (permiso `payments.create`); un **abono** es un pago parcial, mayor a cero y **menor** al saldo (permiso `installments.create`). Ambos son inmutables: triggers de SQLite bloquean `UPDATE` y `DELETE` en la tabla de pagos. El saldo se descuenta con control de concurrencia (si cambió mientras se registraba, se rechaza con `409`). No se registran en la bitácora, porque no son eventos de seguridad ni eliminaciones.
- **Impacto:** un pago mal capturado no se corrige editándolo; hay que anular la factura y emitirla de nuevo.
- **Cómo cambiarla:** `server/src/data/invoices.repo.ts`, migración `*_bloque2_*`.

### S-34 · Anulación de facturas
- **Decisión:** solo el ADMINISTRADOR puede anular, con un motivo obligatorio (5 a 300 caracteres). La anulación es irreversible, devuelve las existencias, saca la factura de ventas y cartera, y queda en la bitácora (`INVOICE_VOIDED`, como eliminación de negocio). Los pagos ya registrados se conservan como historial; la devolución de dinero al cliente se gestiona fuera del sistema.
- **Cómo cambiarla:** `server/src/services/invoices.service.ts`.

### S-35 · Cartera
- **Decisión:** la cartera muestra las facturas vigentes con saldo mayor a cero, ordenadas por vencimiento. Una factura está **vencida** si su fecha de vencimiento ya pasó y aún tiene saldo. El resumen incluye el total por cobrar, el total vencido y los 10 clientes con mayor saldo.
- **Cómo cambiarla:** `invoicesRepo.receivables` y `receivablesSummary`.

### S-36 · Capacitación
- **Ambigüedad:** no se definió el formato del material ni si se mide el avance.
- **Decisión:** cada material tiene título, categoría, descripción, contenido en **texto plano** (React lo escapa; nunca se interpreta como HTML) y un enlace externo opcional, solo `https://` (se rechazan `javascript:`, `data:`, etc.). No se elimina: se oculta (publicado / oculto). El EMPLEADO solo ve el material publicado; si pide uno oculto recibe `404`. No hay seguimiento de avance, porque no se solicitó.
- **Cómo cambiarla:** `server/src/routes/training.routes.ts`.

### S-37 · Dashboard del Bloque 2
- **Decisión:** se agregan "Ventas de hoy" (facturas vigentes desde las 00:00 en `America/Mexico_City`), "Cartera por cobrar", "Cartera vencida" y "Últimas facturas". Cada bloque solo se envía a quien tiene el permiso del módulo (`invoices.view`, `portfolio.view`).
- **Cómo cambiarla:** `config.business.timeZone`, `server/src/routes/dashboard.routes.ts`.

### S-38 · Vitest 5
- **Situación:** `npm audit` reportó 2 vulnerabilidades **críticas** en Vitest 3 (`tinypool`, ejecución remota de código por *prototype pollution*) y una moderada (`@vitest/mocker`).
- **Decisión:** se actualizó Vitest a 5.0.5. Es una dependencia de desarrollo (no llega a producción); las 62 pruebas pasan sin cambios.
- **Impacto:** quedan solo las 3 alertas *high* de S-27 (CLI de Prisma).

### S-39 · Auditoría de seguridad automatizada
- **Decisión:** `scripts/audit-security.js` levanta el servidor compilado contra una base SQLite temporal (`server/prisma/audit.db`) con usuarios propios, y la elimina al terminar: nunca toca la base de desarrollo ni la de producción. En `npm audit`, una vulnerabilidad *critical* es falla y una *high* es advertencia (por la alerta conocida de S-27).
- **Cómo cambiarla:** `checkNpmAudit` en el script.

### S-40 · Caché offline de datos de negocio
- **Decisión:** las consultas de clientes, facturas, cartera y capacitación siguen la regla general del Service Worker (*network first*): sin conexión se muestra la última respuesta guardada. Esa caché se borra al cerrar sesión (S-21). Las acciones que modifican datos (crear factura, cobrar) requieren conexión.
