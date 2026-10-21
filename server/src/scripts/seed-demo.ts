/**
 * Datos demo para visualizar la aplicación en local. Ejecución manual: npm run db:seed:demo
 * - Idempotente: crea solo lo que falta (productos por código, clientes por RFC o nombre,
 *   capacitación por título; facturas solo si no hay ninguna). Nunca modifica ni elimina.
 * - Bloqueado en producción.
 */
import { config } from '../config';
import { clientsRepo, disconnectDatabase, invoicesRepo, productsRepo, trainingRepo } from '../data';

type DemoProduct = {
  code: string;
  name: string;
  description?: string;
  type: 'PRODUCTO' | 'SERVICIO';
  priceCents: number;
  stock?: number;
  active?: boolean;
};

const DEMO_PRODUCTS: DemoProduct[] = [
  // Papelería
  { code: 'PAP-001', name: 'Cuaderno profesional raya 100 hojas', type: 'PRODUCTO', priceCents: 4500, stock: 48 },
  { code: 'PAP-002', name: 'Cuaderno forma francesa cuadro chico', type: 'PRODUCTO', priceCents: 3200, stock: 35 },
  { code: 'PAP-003', name: 'Lápiz de grafito No. 2', type: 'PRODUCTO', priceCents: 800, stock: 120 },
  { code: 'PAP-004', name: 'Bolígrafo tinta azul punto mediano', type: 'PRODUCTO', priceCents: 900, stock: 4 },
  { code: 'PAP-005', name: 'Goma de borrar blanca', type: 'PRODUCTO', priceCents: 600, stock: 60 },
  { code: 'PAP-006', name: 'Juego de geometría escolar', type: 'PRODUCTO', priceCents: 3500, stock: 12 },
  { code: 'PAP-007', name: 'Pegamento en barra 20 g', type: 'PRODUCTO', priceCents: 2200, stock: 2 },
  { code: 'PAP-008', name: 'Cartulina blanca', type: 'PRODUCTO', priceCents: 700, stock: 0 },
  { code: 'PAP-009', name: 'Colores de madera caja con 12', type: 'PRODUCTO', priceCents: 6500, stock: 18 },
  { code: 'PAP-010', name: 'Hojas blancas tamaño carta paquete 100', type: 'PRODUCTO', priceCents: 5500, stock: 25 },
  // Abarrotes y bebidas
  { code: 'ABA-001', name: 'Refresco de cola 600 ml', type: 'PRODUCTO', priceCents: 1800, stock: 40 },
  { code: 'ABA-002', name: 'Agua natural 1 L', type: 'PRODUCTO', priceCents: 1300, stock: 3 },
  { code: 'ABA-003', name: 'Galletas surtidas paquete', type: 'PRODUCTO', priceCents: 2100, stock: 22 },
  { code: 'ABA-004', name: 'Papas fritas 45 g', type: 'PRODUCTO', priceCents: 1700, stock: 30 },
  { code: 'ABA-005', name: 'Café soluble 50 g', type: 'PRODUCTO', priceCents: 4800, stock: 5 },
  { code: 'ABA-006', name: 'Dulce de tamarindo', type: 'PRODUCTO', priceCents: 300, stock: 150 },
  // Hogar y cuidado personal
  { code: 'HOG-001', name: 'Pilas AA paquete con 4', type: 'PRODUCTO', priceCents: 7500, stock: 9 },
  { code: 'HOG-002', name: 'Jabón de tocador 150 g', type: 'PRODUCTO', priceCents: 2400, stock: 16 },
  { code: 'HOG-003', name: 'Papel higiénico 4 rollos', type: 'PRODUCTO', priceCents: 3900, stock: 1 },
  {
    code: 'HOG-004',
    name: 'Veladora aromática',
    description: 'Producto descontinuado por el proveedor',
    type: 'PRODUCTO',
    priceCents: 3000,
    stock: 6,
    active: false,
  },
  // Servicios
  { code: 'SER-001', name: 'Copia blanco y negro', description: 'Tamaño carta u oficio', type: 'SERVICIO', priceCents: 100 },
  { code: 'SER-002', name: 'Impresión a color', description: 'Tamaño carta', type: 'SERVICIO', priceCents: 500 },
  { code: 'SER-003', name: 'Engargolado', description: 'Hasta 100 hojas', type: 'SERVICIO', priceCents: 3500 },
  { code: 'SER-004', name: 'Enmicado tamaño credencial', type: 'SERVICIO', priceCents: 1500 },
  { code: 'SER-005', name: 'Recarga de tiempo aire', description: 'Comisión por recarga', type: 'SERVICIO', priceCents: 500 },
  { code: 'SER-006', name: 'Escaneo de documento', description: 'Envío por correo', type: 'SERVICIO', priceCents: 1000 },
  {
    code: 'SER-007',
    name: 'Fax',
    description: 'Servicio suspendido',
    type: 'SERVICIO',
    priceCents: 1200,
    active: false,
  },
];

const DEMO_CLIENTS = [
  { name: 'Público en general', creditDays: 0 },
  { name: 'Papelería Escolar del Centro SA de CV', taxId: 'PEC1203158K2', phone: '55 1234 5678', creditDays: 30 },
  { name: 'María Fernanda López Ruiz', taxId: 'LORM850412AB3', phone: '55 9876 5432', email: 'maria.lopez@example.com', creditDays: 15 },
  { name: 'Escuela Primaria Benito Juárez', phone: '55 2468 1357', address: 'Av. Hidalgo 120, Centro', creditDays: 45 },
  { name: 'Juan Carlos Pérez', phone: '55 1122 3344', creditDays: 15, active: false },
];

const DEMO_TRAINING = [
  {
    title: 'Cómo registrar una venta de contado',
    category: 'Ventas',
    description: 'Paso a paso para emitir una factura pagada en el momento',
    content:
      '1. Entra a Facturación y presiona "Nueva factura".\n2. Busca y selecciona al cliente (usa "Público en general" si no se identifica).\n3. Elige "Contado" y el método de pago.\n4. Agrega cada producto con su cantidad y revisa el total.\n5. Presiona "Crear factura" y entrega el folio al cliente.',
  },
  {
    title: 'Ventas a crédito y cobro de abonos',
    category: 'Cartera',
    description: 'Cuándo vender a crédito y cómo registrar pagos parciales',
    content:
      'Solo vende a crédito a clientes registrados con días de crédito.\n\nPara cobrar:\n- Abono: pago parcial, menor al saldo.\n- Pago: liquida el saldo completo.\n\nRevisa diariamente la sección Cartera y da prioridad a las facturas vencidas.',
  },
  {
    title: 'Cierre de caja',
    category: 'Caja',
    content:
      'Al cierre del turno cuenta el efectivo, compáralo contra las ventas de contado del día que aparecen en el Dashboard y reporta cualquier diferencia al administrador.',
    url: 'https://www.youtube.com/',
  },
  {
    title: 'Manual interno de inventario (borrador)',
    category: 'Inventario',
    content: 'Documento en revisión; no visible para empleados.',
    active: false,
  },
];

const DAY_MS = 24 * 60 * 60 * 1000;

const seedClients = async () => {
  let created = 0;
  const existing = (await clientsRepo.list({ skip: 0, take: 100 })).items;
  for (const c of DEMO_CLIENTS) {
    if (existing.some((e) => (c.taxId && e.taxId === c.taxId) || e.name === c.name)) continue;
    await clientsRepo.create({ ...c, taxId: c.taxId ?? null, active: c.active ?? true });
    created++;
  }
  return created;
};

const seedTraining = async () => {
  let created = 0;
  const existing = (await trainingRepo.list({ skip: 0, take: 100 })).items;
  for (const t of DEMO_TRAINING) {
    if (existing.some((e) => e.title === t.title)) continue;
    await trainingRepo.create({ ...t, active: t.active ?? true });
    created++;
  }
  return created;
};

/** Facturas de ejemplo (contado, crédito vigente, crédito vencido con abono). Solo si no existe ninguna. */
const seedInvoices = async () => {
  if ((await invoicesRepo.list({ skip: 0, take: 1 })).total > 0) return 0;
  const clients = (await clientsRepo.list({ skip: 0, take: 100 })).items;
  const clientId = (name: string) => clients.find((c) => c.name === name)?.id;
  const productId = async (code: string) => (await productsRepo.findByCode(code))?.id;
  const createdBy = { id: 'demo', name: 'Datos demo' };
  const now = Date.now();

  const plans = [
    { client: 'Público en general', type: 'CONTADO' as const, due: null, items: [['PAP-001', 2], ['SER-001', 20]] },
    { client: 'Escuela Primaria Benito Juárez', type: 'CREDITO' as const, due: 30, items: [['PAP-010', 5], ['PAP-009', 3]] },
    { client: 'Papelería Escolar del Centro SA de CV', type: 'CREDITO' as const, due: -10, items: [['PAP-003', 24], ['PAP-005', 12]] },
    { client: 'María Fernanda López Ruiz', type: 'CREDITO' as const, due: 5, items: [['SER-003', 2], ['ABA-001', 4]] },
  ];

  let created = 0;
  for (const plan of plans) {
    const id = clientId(plan.client);
    const items = [];
    for (const [code, quantity] of plan.items) {
      const pid = await productId(code as string);
      if (pid) items.push({ productId: pid, quantity: quantity as number });
    }
    if (!id || items.length === 0) continue;
    const invoice = await invoicesRepo.create({
      clientId: id,
      paymentType: plan.type,
      dueDate: plan.due === null ? null : new Date(now + plan.due * DAY_MS),
      notes: null,
      createdBy,
      items,
      paymentMethod: 'EFECTIVO',
    });
    created++;
    // La factura vencida recibe un abono para mostrar saldos parciales
    if (plan.due !== null && plan.due < 0) {
      await invoicesRepo.addPayment({
        invoiceId: invoice.id,
        kind: 'ABONO',
        amountCents: Math.floor(invoice.totalCents / 3),
        method: 'TRANSFERENCIA',
        reference: 'DEMO-001',
        createdBy,
      });
    }
  }
  return created;
};

const main = async () => {
  if (config.isProd) {
    console.error('Los datos demo no se cargan en producción');
    process.exitCode = 1;
    return;
  }
  let created = 0;
  for (const p of DEMO_PRODUCTS) {
    if (await productsRepo.findByCode(p.code)) continue;
    await productsRepo.create({
      code: p.code,
      name: p.name,
      description: p.description ?? null,
      type: p.type,
      priceCents: p.priceCents,
      stock: p.type === 'SERVICIO' ? null : (p.stock ?? 0),
      active: p.active ?? true,
    });
    created++;
  }
  console.log(`Datos demo: ${created} productos/servicios creados, ${DEMO_PRODUCTS.length - created} ya existían`);
  console.log(`Datos demo: ${await seedClients()} clientes creados`);
  console.log(`Datos demo: ${await seedTraining()} materiales de capacitación creados`);
  console.log(`Datos demo: ${await seedInvoices()} facturas creadas`);
};

main()
  .catch((err) => {
    console.error('Carga demo fallida:', err instanceof Error ? err.message : 'desconocido');
    process.exitCode = 1;
  })
  .finally(() => void disconnectDatabase());
