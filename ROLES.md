# Matriz de roles oficial — SPA Nereyda

Este archivo es la **fuente oficial** de permisos del proyecto.

- El backend autoriza con `server/src/auth/roles.generated.ts`, que se genera **desde esta tabla** con `npm run roles:generate` (también se ejecuta en cada `build`).
- La vista **Roles** de la aplicación (solo lectura) muestra este mismo contenido generado.
- Una prueba automatizada falla si el archivo generado no coincide con esta tabla.

## Reglas

1. **Denegación por defecto:** todo lo que no esté marcado con ✅ está denegado.
2. Cualquier valor distinto de ✅ (vacío, ❌, texto) se interpreta como **denegado**.
3. Un permiso o rol que no aparezca en la tabla se interpreta como **denegado**.
4. Para cambiar un permiso: edite la tabla, ejecute `npm run roles:generate` y `npm test`.

## Roles

| Rol | Descripción |
|---|---|
| ADMINISTRADOR | Administración total del negocio y del sistema. El usuario "Super Admin" del seed tiene este rol. |
| EMPLEADO | Operación diaria: clientes, facturación, cartera y consulta. |

## Matriz

<!-- roles:matrix:start -->
| Permiso | Módulo | Descripción | ADMINISTRADOR | EMPLEADO |
|---|---|---|---|---|
| `dashboard.view` | Dashboard | Ver dashboard | ✅ | ✅ |
| `products.view` | Productos y Servicios | Ver productos y servicios | ✅ | ✅ |
| `products.create` | Productos y Servicios | Crear productos y servicios | ✅ | ❌ |
| `products.update` | Productos y Servicios | Editar productos y servicios | ✅ | ❌ |
| `products.delete` | Productos y Servicios | Eliminar productos y servicios | ✅ | ❌ |
| `clients.view` | Clientes | Ver clientes | ✅ | ✅ |
| `clients.create` | Clientes | Crear clientes | ✅ | ✅ |
| `clients.update` | Clientes | Editar clientes | ✅ | ✅ |
| `invoices.view` | Facturación | Consultar facturas | ✅ | ✅ |
| `invoices.create` | Facturación | Crear facturas | ✅ | ✅ |
| `invoices.void` | Facturación | Anular facturas | ✅ | ❌ |
| `portfolio.view` | Cartera | Ver cartera | ✅ | ✅ |
| `payments.create` | Cartera | Registrar pagos | ✅ | ✅ |
| `installments.create` | Cartera | Registrar abonos | ✅ | ✅ |
| `users.manage` | Usuarios | Gestionar usuarios (crear, editar, desactivar, asignar roles, desbloquear) | ✅ | ❌ |
| `roles.view` | Roles | Ver roles y permisos | ✅ | ❌ |
| `audit.view` | Bitácora | Ver bitácora | ✅ | ❌ |
| `training.view` | Capacitación | Ver capacitación | ✅ | ✅ |
| `training.manage` | Capacitación | Administrar capacitación | ✅ | ❌ |
| `profile.self` | Perfil | Ver y editar perfil propio, cambiar contraseña | ✅ | ✅ |
<!-- roles:matrix:end -->

## Denegaciones explícitas del rol EMPLEADO

El rol EMPLEADO **no puede**: crear usuarios, editar usuarios, gestionar permisos, ver bitácora,
crear / editar / eliminar productos, anular facturas ni administrar capacitación.
Estas denegaciones se verifican en `server/tests/roles.test.ts`.
