import { useState } from 'react';
import { DataTable, type Column } from '../components/DataTable';
import { Alert, Badge, Card, EmptyState, Loading, PageHeader, Pagination, Select, TextInput } from '../components/ui';
import { PAGE_SIZE } from '../config';
import { api, toQuery } from '../lib/api';
import { AUDIT_ACTION_LABELS, formatDateTime, ROLE_LABELS } from '../lib/format';
import type { AuditEntry, Paginated, RolesMatrix } from '../lib/types';
import { useQuery } from '../lib/useQuery';

type MatrixRow = RolesMatrix['permissions'][number];

/** Vista de solo lectura generada desde ROLES.md (vía API). */
export function RolesPage() {
  const { data, loading, error } = useQuery((signal) => api<RolesMatrix>('/roles', { signal }), []);

  const modules = data ? [...new Set(data.permissions.map((p) => p.module))] : [];
  const columns: Column<MatrixRow>[] = data
    ? [
        { key: 'desc', header: 'Permiso', render: (p) => p.description, hideOnCard: true },
        ...data.roles.map<Column<MatrixRow>>((role) => ({
          key: role,
          header: ROLE_LABELS[role] ?? role,
          render: (p) =>
            p.roles.includes(role) ? <Badge tone="success">Permitido</Badge> : <Badge tone="neutral">Denegado</Badge>,
        })),
      ]
    : [];

  return (
    <div className="page">
      <PageHeader
        title="Roles y permisos"
        subtitle="Matriz oficial (ROLES.md). Solo lectura: todo lo no permitido está denegado."
      />
      {error && <Alert tone="error">{error}</Alert>}
      {loading && !data ? (
        <Loading />
      ) : (
        data && (
          <Card>
            {modules.map((module) => (
              <section key={module} className="matrix-group">
                <h3>{module}</h3>
                <DataTable
                  caption={`Permisos de ${module}`}
                  rows={data.permissions.filter((p) => p.module === module)}
                  columns={columns}
                  rowKey={(p) => p.key}
                  cardTitle={(p) => p.description}
                />
              </section>
            ))}
          </Card>
        )
      )}
    </div>
  );
}

type AuditResponse = Paginated<AuditEntry> & { actions: string[] };

const describeDetails = (details: AuditEntry['details']) => {
  if (!details) return '—';
  return Object.entries(details)
    .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
    .join(' · ');
};

export function AuditPage() {
  const [action, setAction] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);

  const { data, loading, error } = useQuery(
    (signal) =>
      api<AuditResponse>(
        `/audit${toQuery({
          action,
          from: from ? new Date(`${from}T00:00:00`).toISOString() : undefined,
          to: to ? new Date(`${to}T23:59:59`).toISOString() : undefined,
          page,
          pageSize: PAGE_SIZE,
        })}`,
        { signal },
      ),
    [action, from, to, page],
  );

  const columns: Column<AuditEntry>[] = [
    { key: 'date', header: 'Fecha', render: (e) => formatDateTime(e.createdAt) },
    { key: 'action', header: 'Evento', render: (e) => AUDIT_ACTION_LABELS[e.action] ?? e.action, hideOnCard: true },
    { key: 'actor', header: 'Usuario', render: (e) => e.actorEmail ?? '—' },
    { key: 'ip', header: 'IP', render: (e) => e.ip ?? '—' },
    { key: 'details', header: 'Detalle', render: (e) => describeDetails(e.details) },
  ];

  const resetPage = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v);
    setPage(1);
  };

  return (
    <div className="page">
      <PageHeader title="Bitácora" subtitle="Registro inmutable de eventos de seguridad y eliminaciones. Retención: 90 días." />
      <div className="toolbar">
        <Select
          label="Evento"
          options={[
            { value: '', label: 'Todos' },
            ...(data?.actions ?? []).map((a) => ({ value: a, label: AUDIT_ACTION_LABELS[a] ?? a })),
          ]}
          value={action}
          onChange={(e) => resetPage(setAction)(e.target.value)}
        />
        <TextInput label="Desde" type="date" value={from} onChange={(e) => resetPage(setFrom)(e.target.value)} />
        <TextInput label="Hasta" type="date" value={to} onChange={(e) => resetPage(setTo)(e.target.value)} />
      </div>
      {error && <Alert tone="error">{error}</Alert>}
      {loading && !data ? (
        <Loading />
      ) : data && data.items.length === 0 ? (
        <EmptyState title="Sin eventos" description="No hay registros para los filtros seleccionados." />
      ) : (
        data && (
          <>
            <DataTable
              caption="Eventos de bitácora"
              rows={data.items}
              columns={columns}
              rowKey={(e) => e.id}
              cardTitle={(e) => AUDIT_ACTION_LABELS[e.action] ?? e.action}
            />
            <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onChange={setPage} />
          </>
        )
      )}
    </div>
  );
}
