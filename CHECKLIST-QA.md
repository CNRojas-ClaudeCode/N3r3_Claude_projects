# CHECKLIST QA — SPA Nereyda

Lista de verificación manual para validar el MVP antes de entregarlo o desplegarlo.
Las pruebas automatizadas (`npm test`) y la auditoría (`npm run audit:security`) cubren parte de estos casos; la columna **Auto** lo indica.

**Preparación:** base local con `npm run db:seed` y `npm run db:seed:demo`. Usuarios: `admin@datly.local`,
`administrador.prueba@datly.local` (ADMIN) y `empleado.prueba@datly.local` (EMPLEADO).

Marque cada caso: ☐ pendiente · ☑ aprobado · ☒ falló (anotar observación).

---

## 1. Casos exitosos

| # | Caso | Pasos | Resultado esperado | Auto | ☐ |
|---|---|---|---|---|---|
| 1.1 | Login correcto | Ingresar con un usuario activo y su contraseña | Entra al Dashboard; la cookie de sesión es httpOnly | ✅ | ☐ |
| 1.2 | Primer acceso del Super Admin | Ingresar con `admin@datly.local` / `Admin123*` | Solo permite ir a "Mi perfil" a cambiar la contraseña | ✅ | ☐ |
| 1.3 | Crear producto | ADMIN → Productos → Nuevo → guardar | Aparece en la lista con su precio en MXN | ✅ | ☐ |
| 1.4 | Crear cliente | Clientes → Nuevo → nombre, RFC válido, 30 días | Aparece en la lista como Activo | ✅ | ☐ |
| 1.5 | Factura de contado | Facturación → Nueva → cliente, Contado, Efectivo, 2 productos | Folio consecutivo, estado **Pagada**, saldo $0, existencias descontadas | — | ☐ |
| 1.6 | Factura a crédito | Nueva → Crédito | Estado **Pendiente**, vencimiento = hoy + días de crédito; aparece en Cartera | — | ☐ |
| 1.7 | Registrar abono | Cartera → Cobrar → Registrar abono por un monto menor al saldo | El saldo baja; el abono aparece en "Pagos y abonos" | ✅ | ☐ |
| 1.8 | Registrar pago | Cartera → Cobrar → Registrar pago | Saldo $0, estado **Pagada**, sale de Cartera | ✅ | ☐ |
| 1.9 | Anular factura | ADMIN → Detalle → Anular con motivo | Estado **Anulada**, existencias devueltas, evento en Bitácora | ✅ | ☐ |
| 1.10 | Capacitación | ADMIN → Capacitación → Nuevo con enlace `https://` | El EMPLEADO lo ve y el enlace abre en otra pestaña | ✅ | ☐ |
| 1.11 | Dashboard | Ingresar como ADMIN y como EMPLEADO | Ventas de hoy, cartera, stock bajo y últimas facturas; métricas de usuarios solo para ADMIN | — | ☐ |
| 1.12 | Editar perfil | Mi perfil → cambiar nombre | Se actualiza el nombre en el encabezado | — | ☐ |

## 2. Casos fallidos (validaciones)

| # | Caso | Pasos | Resultado esperado | Auto | ☐ |
|---|---|---|---|---|---|
| 2.1 | Contraseña corta | Cambiar contraseña a una de menos de 12 caracteres | Error de validación; no se guarda | ✅ | ☐ |
| 2.2 | Código de producto duplicado | Crear un producto con un código existente | Mensaje "Ya existe un producto con ese código" | — | ☐ |
| 2.3 | RFC inválido o duplicado | Capturar `ABC123` o un RFC ya registrado | Error de validación / "Ya existe un cliente con ese RFC" | — | ☐ |
| 2.4 | Existencias insuficientes | Facturar más unidades de las disponibles | La factura se rechaza; las existencias no cambian | — | ☐ |
| 2.5 | Producto o cliente inactivo | Intentar facturar a un cliente inactivo o un producto inactivo | Rechazo con mensaje claro | — | ☐ |
| 2.6 | Abono igual o mayor al saldo | Registrar un abono por el saldo completo | "El abono debe ser menor al saldo; para liquidar registre un pago" | — | ☐ |
| 2.7 | Anular dos veces | Anular una factura ya anulada (vía API) | `409` "La factura ya está anulada" | ✅ | ☐ |
| 2.8 | Enlace inseguro en capacitación | Guardar un enlace `javascript:alert(1)` o `http://` | Error "El enlace debe iniciar con https://" | ✅ | ☐ |
| 2.9 | Anular sin motivo | Anular con menos de 5 caracteres de motivo | Error de validación; la factura sigue vigente | — | ☐ |

## 3. Verificación de permisos

| # | Caso | Pasos | Resultado esperado | Auto | ☐ |
|---|---|---|---|---|---|
| 3.1 | Endpoints sin sesión | Llamar a cualquier `/api/*` protegido sin cookie | `401` en todos | ✅ | ☐ |
| 3.2 | Menú del EMPLEADO | Ingresar como EMPLEADO | Ve Dashboard, Productos, Clientes, Facturación, Cartera, Capacitación y Mi perfil; **no** ve Usuarios, Roles ni Bitácora | — | ☐ |
| 3.3 | Productos para EMPLEADO | Productos | Sin botones de crear, editar ni eliminar; la API responde `403` | ✅ | ☐ |
| 3.4 | Anular para EMPLEADO | Detalle de factura | Sin botón "Anular"; `POST /api/invoices/:id/void` responde `403` | ✅ | ☐ |
| 3.5 | Capacitación para EMPLEADO | Capacitación | Sin botones de crear o editar; no ve material oculto (`404` por API) | ✅ | ☐ |
| 3.6 | Rutas por URL | Como EMPLEADO abrir `/usuarios`, `/roles`, `/bitacora` | Pantalla "sin permisos" | — | ☐ |
| 3.7 | Escalamiento desde perfil | `PATCH /api/profile` con `role: ADMINISTRADOR` | `400`; el rol no cambia | ✅ | ☐ |
| 3.8 | Sesiones tras cambio de rol | ADMIN cambia el rol o desactiva a un usuario con sesión abierta | La sesión del usuario afectado se invalida | ✅ | ☐ |

## 4. Verificación de intentos bloqueados

| # | Caso | Pasos | Resultado esperado | Auto | ☐ |
|---|---|---|---|---|---|
| 4.1 | Bloqueo al sexto intento | 5 contraseñas incorrectas y luego la correcta | El sexto intento falla con "Email o contraseña incorrectos" | ✅ | ☐ |
| 4.2 | Reinicio del contador | 4 fallos, acceso correcto, 4 fallos, acceso correcto | Ambos accesos correctos entran | ✅ | ☐ |
| 4.3 | Expiración del bloqueo | Esperar 15 minutos tras el bloqueo | Vuelve a permitir el acceso | ✅ | ☐ |
| 4.4 | Bloqueo por IP | 5 fallos desde la misma IP con emails distintos | La IP queda bloqueada 15 minutos | ✅ | ☐ |
| 4.5 | Desbloqueo manual | ADMIN → Usuarios → Desbloquear | El usuario entra; evento "Cuenta desbloqueada" en Bitácora | ✅ | ☐ |
| 4.6 | Mensaje único | Probar usuario inexistente, contraseña incorrecta, usuario inactivo y bloqueado | Siempre "Email o contraseña incorrectos", mismo código `401` | ✅ | ☐ |
| 4.7 | Bitácora de bloqueos | ADMIN → Bitácora | Eventos de login fallido, cuenta bloqueada e IP bloqueada | — | ☐ |

## 5. Verificación de recuperación

| # | Caso | Pasos | Resultado esperado | Auto | ☐ |
|---|---|---|---|---|---|
| 5.1 | Misma respuesta | "¿Olvidó su contraseña?" con un email existente y con uno inexistente | Mismo mensaje en ambos casos | ✅ | ☐ |
| 5.2 | Enlace válido | Abrir el enlace guardado en `server/.mail-outbox/` y fijar una contraseña nueva | Permite entrar con la nueva contraseña | ✅ | ☐ |
| 5.3 | Un solo uso | Reusar el mismo enlace | "El enlace de recuperación no es válido o ya expiró" | ✅ | ☐ |
| 5.4 | Expiración | Usar un enlace con más de 45 minutos | Rechazado | ✅ | ☐ |
| 5.5 | Sesiones invalidadas | Restablecer con una sesión abierta en otro navegador | La otra sesión se cierra | ✅ | ☐ |
| 5.6 | Token hasheado | Revisar la tabla `PasswordResetToken` | Solo hay hashes SHA-256, nunca el token en claro | ✅ | ☐ |

## 6. Verificación de roles

| # | Caso | Pasos | Resultado esperado | Auto | ☐ |
|---|---|---|---|---|---|
| 6.1 | Vista de roles | ADMIN → Roles | Matriz de solo lectura idéntica a `ROLES.md` | ✅ | ☐ |
| 6.2 | Sincronía con ROLES.md | `npm test` | La prueba de sincronía de `roles.generated.ts` pasa | ✅ | ☐ |
| 6.3 | Denegación por defecto | Rol o permiso desconocido | Denegado | ✅ | ☐ |
| 6.4 | Último administrador | Intentar desactivarse o quitarse el rol de ADMIN a sí mismo | Rechazado | ✅ | ☐ |
| 6.5 | Asignar rol | ADMIN cambia el rol de un usuario | Evento "Cambio de rol" en Bitácora | ✅ | ☐ |

## 7. PWA, responsive y despliegue (manual)

| # | Caso | Resultado esperado | ☐ |
|---|---|---|---|
| 7.1 | Lighthouse (build de producción servido por HTTPS) | Criterios de instalabilidad aprobados: manifest, iconos, Service Worker, offline (ver SUPUESTOS S-21) | ☐ |
| 7.2 | Instalar la app desde Chrome o Safari (iOS) | Abre en modo standalone, con el icono correcto y respetando el notch (safe-area) | ☐ |
| 7.3 | Sin conexión | Navegar sin red muestra los últimos datos o la página offline | ☐ |
| 7.4 | Anchos 360, 768, 1024 y 1440 px | Sin scroll horizontal; en móvil las tablas se ven como tarjetas | ☐ |
| 7.5 | Objetivos táctiles | Botones y enlaces de al menos 44 px | ☐ |
| 7.6 | Railway | `/api/health` responde `{"status":"ok"}`; los datos persisten entre despliegues (volumen en `/data`) | ☐ |
| 7.7 | Producción sin stack traces | Provocar un error 500 | Respuesta genérica "Error interno del servidor" | ☐ |

## 8. Auditoría automatizada

```bash
npm run build
```

```bash
npm run audit:security
```

| # | Verificación | Resultado esperado | ☐ |
|---|---|---|---|
| 8.1 | Script completo | 0 fallas. La advertencia de `npm audit` *high* (CLI de Prisma, S-27) es conocida | ☐ |
| 8.2 | `npm test` | Todas las pruebas pasan | ☐ |
