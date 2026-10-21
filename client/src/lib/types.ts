export type Role = 'ADMINISTRADOR' | 'EMPLEADO';

export type Permission =
  | 'dashboard.view'
  | 'products.view'
  | 'products.create'
  | 'products.update'
  | 'products.delete'
  | 'clients.view'
  | 'clients.create'
  | 'clients.update'
  | 'invoices.view'
  | 'invoices.create'
  | 'invoices.void'
  | 'portfolio.view'
  | 'payments.create'
  | 'installments.create'
  | 'users.manage'
  | 'roles.view'
  | 'audit.view'
  | 'training.view'
  | 'training.manage'
  | 'profile.self';

export type User = {
  id: string;
  email: string;
  name: string;
  role: Role;
  active: boolean;
  locked: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SessionUser = { user: User; permissions: Permission[] };

export type Paginated<T> = { items: T[]; total: number; page: number; pageSize: number };

export type ProductType = 'PRODUCTO' | 'SERVICIO';

export type Product = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  type: ProductType;
  priceCents: number;
  stock: number | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Client = {
  id: string;
  name: string;
  taxId: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  creditDays: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PaymentType = 'CONTADO' | 'CREDITO';
export type PaymentMethod = 'EFECTIVO' | 'TARJETA' | 'TRANSFERENCIA';
export type InvoicePaymentStatus = 'ANULADA' | 'PAGADA' | 'VENCIDA' | 'PENDIENTE';

export type InvoiceSummary = {
  id: string;
  folio: number;
  client: { id: string; name: string; taxId: string | null };
  paymentType: PaymentType;
  status: 'VIGENTE' | 'ANULADA';
  paymentStatus: InvoicePaymentStatus;
  totalCents: number;
  balanceCents: number;
  dueDate: string | null;
  createdByName: string;
  createdAt: string;
};

export type Payment = {
  id: string;
  kind: 'PAGO' | 'ABONO';
  amountCents: number;
  method: PaymentMethod;
  reference: string | null;
  createdByName: string;
  createdAt: string;
};

export type Invoice = InvoiceSummary & {
  notes: string | null;
  voidedAt: string | null;
  voidReason: string | null;
  items: {
    id: string;
    productId: string;
    code: string;
    name: string;
    productType: ProductType;
    quantity: number;
    unitPriceCents: number;
    lineTotalCents: number;
  }[];
  payments: Payment[];
};

export type PortfolioSummary = {
  totalCents: number;
  invoices: number;
  overdueCents: number;
  overdueInvoices: number;
  topClients: { clientId: string; name: string; balanceCents: number; invoices: number }[];
};

export type PortfolioData = Paginated<InvoiceSummary> & { summary: PortfolioSummary };

export type TrainingMaterial = {
  id: string;
  title: string;
  category: string;
  description: string | null;
  content: string;
  url: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type DashboardData = {
  products: { products: number; services: number; inactive: number; lowStock: number; lowStockThreshold: number };
  lowStockItems: Product[];
  recentProducts: Product[];
  users?: { total: number; active: number; locked: number };
  sales?: { today: { totalCents: number; invoices: number }; recent: InvoiceSummary[] };
  portfolio?: Omit<PortfolioSummary, 'topClients'>;
};

export type RolesMatrix = {
  roles: Role[];
  permissions: { key: Permission; module: string; description: string; roles: Role[] }[];
};

export type AuditEntry = {
  id: string;
  createdAt: string;
  action: string;
  actorId: string | null;
  actorEmail: string | null;
  targetType: string | null;
  targetId: string | null;
  ip: string | null;
  details: Record<string, unknown> | null;
};
