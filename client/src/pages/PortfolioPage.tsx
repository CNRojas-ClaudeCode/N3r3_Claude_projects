import { useState } from 'react';
import { DataTable, type Column } from '../components/DataTable';
import { Icon, type IconName } from '../components/Icon';
import { InvoiceDetailModal, InvoiceStatusBadge } from '../components/InvoiceDialogs';
import { Alert, Button, Card, EmptyState, Loading, PageHeader, Pagination, Select } from '../components/ui';
import { PAGE_SIZE } from '../config';
import { api, toQuery } from '../lib/api';
import { formatDate, formatFolio, formatMoney, formatNumber } from '../lib/format';
import type { InvoiceSummary, PortfolioData } from '../lib/types';
import { useQuery } from '../lib/useQuery';

function MoneyStat({ icon, label, cents, detail, warning }: { icon: IconName; label: string; cents: number; detail: string; warning?: boolean }) {
  return (
    <div className="card stat-card">
      <span className={`stat-card__icon ${warning ? 'stat-card__icon--warning' : ''}`}>
        <Icon name={icon} />
      </span>
      <span className="text-secondary">{label}</span>
      <span className="stat-card__value">{formatMoney(cents)}</span>
      <span className="text-small text-secondary">{detail}</span>
    </div>
  );
}

export function PortfolioPage() {
  const [clientId, setClientId] = useState('');
  const [overdue, setOverdue] = useState('');
  const [page, setPage] = useState(1);
  const [detailId, setDetailId] = useState<string | null>(null);

  const { data, loading, error, reload } = useQuery(
    (signal) =>
      api<PortfolioData>(`/portfolio${toQuery({ clientId, overdue, page, pageSize: PAGE_SIZE })}`, { signal }),
    [clientId, overdue, page],
  );

  const columns: Column<InvoiceSummary>[] = [
    { key: 'folio', header: 'Folio', render: (i) => formatFolio(i.folio), hideOnCard: true },
    { key: 'client', header: 'Cliente', render: (i) => i.client.name },
    { key: 'due', header: 'Vence', render: (i) => formatDate(i.dueDate) },
    { key: 'total', header: 'Total', align: 'right', render: (i) => formatMoney(i.totalCents) },
    { key: 'balance', header: 'Saldo', align: 'right', render: (i) => formatMoney(i.balanceCents) },
    { key: 'status', header: 'Estado', render: (i) => <InvoiceStatusBadge status={i.paymentStatus} /> },
  ];

  const summary = data?.summary;

  return (
    <div className="page">
      <PageHeader title="Cartera" subtitle="Saldos pendientes de facturas a crédito" />

      {error && <Alert tone="error">{error}</Alert>}
      {loading && !data ? (
        <Loading />
      ) : (
        data &&
        summary && (
          <>
            <div className="stats-grid">
              <MoneyStat
                icon="wallet"
                label="Por cobrar"
                cents={summary.totalCents}
                detail={`${formatNumber(summary.invoices)} factura(s)`}
              />
              <MoneyStat
                icon="alert"
                label="Vencido"
                cents={summary.overdueCents}
                detail={`${formatNumber(summary.overdueInvoices)} factura(s)`}
                warning
              />
            </div>

            <div className="dashboard-grid">
              <Card title="Clientes con mayor saldo">
                {summary.topClients.length === 0 ? (
                  <EmptyState title="Sin saldos" description="No hay facturas pendientes de cobro." />
                ) : (
                  <ul className="list">
                    {summary.topClients.map((c) => (
                      <li key={c.clientId} className="list__item">
                        <span className="list__main">
                          <strong className="truncate">{c.name}</strong>
                          <span className="text-small text-secondary">{c.invoices} factura(s)</span>
                        </span>
                        <span className="list__end">
                          {formatMoney(c.balanceCents)}
                          <Button
                            variant="ghost"
                            icon="eye"
                            iconOnly
                            onClick={() => {
                              setClientId(c.clientId);
                              setPage(1);
                            }}
                          >
                            Ver facturas de {c.name}
                          </Button>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>

            <div className="toolbar">
              <Select
                label="Cliente"
                options={[
                  { value: '', label: 'Todos' },
                  ...summary.topClients.map((c) => ({ value: c.clientId, label: c.name })),
                  ...(clientId && !summary.topClients.some((c) => c.clientId === clientId)
                    ? [{ value: clientId, label: data.items[0]?.client.name ?? 'Cliente seleccionado' }]
                    : []),
                ]}
                value={clientId}
                onChange={(e) => {
                  setClientId(e.target.value);
                  setPage(1);
                }}
              />
              <Select
                label="Vencimiento"
                options={[
                  { value: '', label: 'Todas' },
                  { value: 'true', label: 'Solo vencidas' },
                ]}
                value={overdue}
                onChange={(e) => {
                  setOverdue(e.target.value);
                  setPage(1);
                }}
              />
            </div>

            {data.items.length === 0 ? (
              <EmptyState title="Sin pendientes" description="No hay facturas pendientes para los filtros seleccionados." />
            ) : (
              <>
                <DataTable
                  caption="Facturas pendientes de cobro"
                  rows={data.items}
                  columns={columns}
                  rowKey={(i) => i.id}
                  cardTitle={(i) => formatFolio(i.folio)}
                  actions={(i) => (
                    <Button variant="secondary" icon="cash" onClick={() => setDetailId(i.id)}>
                      Cobrar
                    </Button>
                  )}
                />
                <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onChange={setPage} />
              </>
            )}
          </>
        )
      )}

      <InvoiceDetailModal invoiceId={detailId} onClose={() => setDetailId(null)} onChanged={reload} />
    </div>
  );
}
