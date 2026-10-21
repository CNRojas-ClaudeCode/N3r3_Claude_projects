// ARCHIVO GENERADO desde ROLES.md — no editar manualmente.
// Regenerar con: npm run roles:generate
export const ROLES = ["ADMINISTRADOR","EMPLEADO"] as const;

export const PERMISSIONS = [
  {
    "key": "dashboard.view",
    "module": "Dashboard",
    "description": "Ver dashboard",
    "roles": [
      "ADMINISTRADOR",
      "EMPLEADO"
    ]
  },
  {
    "key": "products.view",
    "module": "Productos y Servicios",
    "description": "Ver productos y servicios",
    "roles": [
      "ADMINISTRADOR",
      "EMPLEADO"
    ]
  },
  {
    "key": "products.create",
    "module": "Productos y Servicios",
    "description": "Crear productos y servicios",
    "roles": [
      "ADMINISTRADOR"
    ]
  },
  {
    "key": "products.update",
    "module": "Productos y Servicios",
    "description": "Editar productos y servicios",
    "roles": [
      "ADMINISTRADOR"
    ]
  },
  {
    "key": "products.delete",
    "module": "Productos y Servicios",
    "description": "Eliminar productos y servicios",
    "roles": [
      "ADMINISTRADOR"
    ]
  },
  {
    "key": "clients.view",
    "module": "Clientes",
    "description": "Ver clientes",
    "roles": [
      "ADMINISTRADOR",
      "EMPLEADO"
    ]
  },
  {
    "key": "clients.create",
    "module": "Clientes",
    "description": "Crear clientes",
    "roles": [
      "ADMINISTRADOR",
      "EMPLEADO"
    ]
  },
  {
    "key": "clients.update",
    "module": "Clientes",
    "description": "Editar clientes",
    "roles": [
      "ADMINISTRADOR",
      "EMPLEADO"
    ]
  },
  {
    "key": "invoices.view",
    "module": "Facturación",
    "description": "Consultar facturas",
    "roles": [
      "ADMINISTRADOR",
      "EMPLEADO"
    ]
  },
  {
    "key": "invoices.create",
    "module": "Facturación",
    "description": "Crear facturas",
    "roles": [
      "ADMINISTRADOR",
      "EMPLEADO"
    ]
  },
  {
    "key": "invoices.void",
    "module": "Facturación",
    "description": "Anular facturas",
    "roles": [
      "ADMINISTRADOR"
    ]
  },
  {
    "key": "portfolio.view",
    "module": "Cartera",
    "description": "Ver cartera",
    "roles": [
      "ADMINISTRADOR",
      "EMPLEADO"
    ]
  },
  {
    "key": "payments.create",
    "module": "Cartera",
    "description": "Registrar pagos",
    "roles": [
      "ADMINISTRADOR",
      "EMPLEADO"
    ]
  },
  {
    "key": "installments.create",
    "module": "Cartera",
    "description": "Registrar abonos",
    "roles": [
      "ADMINISTRADOR",
      "EMPLEADO"
    ]
  },
  {
    "key": "users.manage",
    "module": "Usuarios",
    "description": "Gestionar usuarios (crear, editar, desactivar, asignar roles, desbloquear)",
    "roles": [
      "ADMINISTRADOR"
    ]
  },
  {
    "key": "roles.view",
    "module": "Roles",
    "description": "Ver roles y permisos",
    "roles": [
      "ADMINISTRADOR"
    ]
  },
  {
    "key": "audit.view",
    "module": "Bitácora",
    "description": "Ver bitácora",
    "roles": [
      "ADMINISTRADOR"
    ]
  },
  {
    "key": "training.view",
    "module": "Capacitación",
    "description": "Ver capacitación",
    "roles": [
      "ADMINISTRADOR",
      "EMPLEADO"
    ]
  },
  {
    "key": "training.manage",
    "module": "Capacitación",
    "description": "Administrar capacitación",
    "roles": [
      "ADMINISTRADOR"
    ]
  },
  {
    "key": "profile.self",
    "module": "Perfil",
    "description": "Ver y editar perfil propio, cambiar contraseña",
    "roles": [
      "ADMINISTRADOR",
      "EMPLEADO"
    ]
  }
] as const;
