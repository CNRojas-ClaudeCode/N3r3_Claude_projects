import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Icon, type IconName } from '../components/Icon';
import { Alert, Badge, Card, EmptyState, Loading, PageHeader } from '../components/ui';
import { api } from '../lib/api';
import { InvoiceStatusBadge } from '../components/InvoiceDialogs';
import { formatFolio, formatMoney, formatNumber, PRODUCT_TYPE_LABELS } from '../lib/format';
import type { DashboardData } from '../lib/types';
import { useQuery } from '../lib/useQuery';

function StatCard({
  icon,
  label,
  value,
  warning,
  money,
  detail,
}: {
  icon: IconName;
  label: string;
  value: number;
  warning?: boolean;
  /** El valor está en centavos */
  money?: boolean;
  detail?: string;
}) {
  return (
    <div className="card stat-card">
      <span className={`stat-card__icon ${warning ? 'stat-card__icon--warning' : ''}`}>
        <Icon name={icon} />
      </span>
      <span className="text-secondary">{label}</span>
      <span className="stat-card__value">{money ? formatMoney(value) : formatNumber(value)}</span>
      {detail && <span className="text-small text-secondary">{detail}</span>}
    </div>
  );
}

export function DashboardPage() {
  const { user } = useAuth();
  const { data, loading, error } = useQuery((signal) => api<DashboardData>('/dashboard', { signal }), []);

  return (
    <div className="page">
      <PageHeader title={`Hola, ${user?.name.split(' ')[0] ?? ''}`} subtitle="Resumen general de la miscelánea" />
      {error && <Alert tone="error">{error}</Alert>}
      {loading && !data ? (
        <Loading />
      ) : (
        data && (
          <>
            {(data.sales || data.portfolio) && (
              <div className="stats-grid">
                {data.sales && (
                  <StatCard
                    icon="invoice"
                    label="Ventas de hoy"
                    value={data.sales.today.totalCents}
                    money
                    detail={`${formatNumber(data.sales.today.invoices)} factura(s)`}
                  />
                )}
                {data.portfolio && (
                  <>
                    <StatCard
                      icon="wallet"
                      label="Cartera por cobrar"
                      value={data.portfolio.totalCents}
                      money
                      detail={`${formatNumber(data.portfolio.invoices)} factura(s)`}
                    />
                    <StatCard
                      icon="alert"
                      label="Cartera vencida"
                      value={data.portfolio.overdueCents}
                      money
                      warning
                      detail={`${formatNumber(data.portfolio.overdueInvoices)} factura(s)`}
                    />
                  </>
                )}
              </div>
            )}

            <div className="stats-grid">
              <StatCard icon="box" label="Productos" value={data.products.products} />
              <StatCard icon="tool" label="Servicios" value={data.products.services} />
              <StatCard icon="alert" label="Stock bajo" value={data.products.lowStock} warning />
              {data.users ? (
                <StatCard icon="users" label="Usuarios activos" value={data.users.active} />
              ) : (
                <StatCard icon="tag" label="Inactivos" value={data.products.inactive} />
              )}
            </div>

            <div className="dashboard-grid">
              <Card title="Stock bajo" actions={<Badge tone="warning">≤ {data.products.lowStockThreshold} uds.</Badge>}>
                {data.lowStockItems.length === 0 ? (
                  <EmptyState title="Sin alertas" description="Todos los productos tienen existencias suficientes." />
                ) : (
                  <ul className="list">
                    {data.lowStockItems.map((p) => (
                      <li key={p.id} className="list__item">
                        <span className="list__main">
                          <strong className="truncate">{p.name}</strong>
                          <span className="text-small text-secondary">{p.code}</span>
                        </span>
                        <Badge tone={p.stock === 0 ? 'error' : 'warning'}>{p.stock} uds.</Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              <Card title="Agregados recientemente" actions={<Link to="/productos">Ver todos</Link>}>
                {data.recentProducts.length === 0 ? (
                  <EmptyState title="Sin productos" description="Aún no hay productos ni servicios registrados." />
                ) : (
                  <ul className="list">
                    {data.recentProducts.map((p) => (
                      <li key={p.id} className="list__item">
                        <span className="list__main">
                          <strong className="truncate">{p.name}</strong>
                          <span className="text-small text-secondary">{PRODUCT_TYPE_LABELS[p.type]}</span>
                        </span>
                        <span>{formatMoney(p.priceCents)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              {data.sales && (
                <Card title="Últimas facturas" actions={<Link to="/facturas">Ver todas</Link>}>
                  {data.sales.recent.length === 0 ? (
                    <EmptyState title="Sin facturas" description="Aún no hay facturas registradas." />
                  ) : (
                    <ul className="list">
                      {data.sales.recent.map((i) => (
                        <li key={i.id} className="list__item">
                          <span className="list__main">
                            <strong className="truncate">
                              {formatFolio(i.folio)} · {i.client.name}
                            </strong>
                            <span className="text-small text-secondary">{formatMoney(i.totalCents)}</span>
                          </span>
                          <InvoiceStatusBadge status={i.paymentStatus} />
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              )}
            </div>

            {data.users && data.users.locked > 0 && (
              <Alert tone="warning">
                Hay {data.users.locked} usuario(s) bloqueado(s) por intentos fallidos.{' '}
                <Link to="/usuarios">Revisar usuarios</Link>
              </Alert>
            )}
          </>
        )
      )}
    </div>
  );
}
