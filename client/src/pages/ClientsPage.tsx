import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../auth/AuthContext';
import { DataTable, type Column } from '../components/DataTable';
import {
  Alert,
  Badge,
  Button,
  Checkbox,
  EmptyState,
  Loading,
  Modal,
  PageHeader,
  Pagination,
  Select,
  TextArea,
  TextInput,
  useToast,
} from '../components/ui';
import { PAGE_SIZE } from '../config';
import { api, ApiError, errorMessage, toQuery } from '../lib/api';
import type { Client, Paginated } from '../lib/types';
import { useQuery } from '../lib/useQuery';

type FormState = {
  name: string;
  taxId: string;
  phone: string;
  email: string;
  address: string;
  creditDays: string;
  active: boolean;
};

const emptyForm: FormState = { name: '', taxId: '', phone: '', email: '', address: '', creditDays: '30', active: true };

const toForm = (c: Client): FormState => ({
  name: c.name,
  taxId: c.taxId ?? '',
  phone: c.phone ?? '',
  email: c.email ?? '',
  address: c.address ?? '',
  creditDays: String(c.creditDays),
  active: c.active,
});

function ClientFormModal({
  client,
  open,
  onClose,
  onSaved,
}: {
  client: Client | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const notify = useToast();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(client ? toForm(client) : emptyForm);
    setErrors({});
    setError(null);
  }, [open, client]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const creditDays = Number.parseInt(form.creditDays, 10);
    if (Number.isNaN(creditDays) || creditDays < 0) {
      setErrors({ creditDays: 'Ingrese un número entero mayor o igual a 0' });
      return;
    }
    setErrors({});
    setSaving(true);
    setError(null);
    const body = {
      name: form.name,
      taxId: form.taxId.trim() || null,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      address: form.address.trim() || null,
      creditDays,
      active: form.active,
    };
    try {
      if (client) await api(`/clients/${client.id}`, { method: 'PATCH', body });
      else await api('/clients', { method: 'POST', body });
      notify(client ? 'Cliente actualizado' : 'Cliente creado');
      onSaved();
    } catch (err) {
      if (err instanceof ApiError && err.issues.length) setErrors(err.fieldErrors());
      else setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title={client ? 'Editar cliente' : 'Nuevo cliente'}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="client-form" loading={saving}>
            Guardar
          </Button>
        </>
      }
    >
      <form id="client-form" className="form" onSubmit={onSubmit} noValidate>
        {error && <Alert tone="error">{error}</Alert>}
        <TextInput
          label="Nombre o razón social"
          required
          maxLength={120}
          value={form.name}
          error={errors.name}
          onChange={(e) => set('name', e.target.value)}
        />
        <div className="form__row form__row--2">
          <TextInput
            label="RFC (opcional)"
            maxLength={13}
            value={form.taxId}
            error={errors.taxId}
            onChange={(e) => set('taxId', e.target.value.toUpperCase())}
          />
          <TextInput
            label="Teléfono (opcional)"
            type="tel"
            inputMode="tel"
            maxLength={20}
            value={form.phone}
            error={errors.phone}
            onChange={(e) => set('phone', e.target.value)}
          />
        </div>
        <TextInput
          label="Email (opcional)"
          type="email"
          maxLength={254}
          value={form.email}
          error={errors.email}
          onChange={(e) => set('email', e.target.value)}
        />
        <TextArea
          label="Dirección (opcional)"
          maxLength={250}
          value={form.address}
          error={errors.address}
          onChange={(e) => set('address', e.target.value)}
        />
        <TextInput
          label="Días de crédito"
          inputMode="numeric"
          value={form.creditDays}
          error={errors.creditDays}
          hint="Plazo para pagar las facturas a crédito"
          onChange={(e) => set('creditDays', e.target.value)}
        />
        <Checkbox label="Activo" checked={form.active} onChange={(e) => set('active', e.target.checked)} />
      </form>
    </Modal>
  );
}

export function ClientsPage() {
  const { can } = useAuth();
  const [search, setSearch] = useState('');
  const [active, setActive] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Client | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const { data, loading, error, reload } = useQuery(
    (signal) => api<Paginated<Client>>(`/clients${toQuery({ search, active, page, pageSize: PAGE_SIZE })}`, { signal }),
    [search, active, page],
  );

  const canEdit = can('clients.update');

  const openForm = (client: Client | null) => {
    setEditing(client);
    setFormOpen(true);
  };

  const columns: Column<Client>[] = [
    { key: 'name', header: 'Nombre', render: (c) => c.name, hideOnCard: true },
    { key: 'taxId', header: 'RFC', render: (c) => c.taxId ?? '—' },
    { key: 'phone', header: 'Teléfono', render: (c) => c.phone ?? '—' },
    { key: 'email', header: 'Email', render: (c) => c.email ?? '—' },
    { key: 'credit', header: 'Crédito', align: 'right', render: (c) => `${c.creditDays} días` },
    {
      key: 'active',
      header: 'Estado',
      render: (c) => <Badge tone={c.active ? 'success' : 'neutral'}>{c.active ? 'Activo' : 'Inactivo'}</Badge>,
    },
  ];

  return (
    <div className="page">
      <PageHeader
        title="Clientes"
        subtitle="Directorio de clientes de la miscelánea"
        actions={
          can('clients.create') && (
            <Button icon="plus" onClick={() => openForm(null)}>
              Nuevo
            </Button>
          )
        }
      />

      <div className="toolbar">
        <TextInput
          label="Buscar"
          type="search"
          placeholder="Nombre, RFC o teléfono"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <Select
          label="Estado"
          options={[
            { value: '', label: 'Todos' },
            { value: 'true', label: 'Activos' },
            { value: 'false', label: 'Inactivos' },
          ]}
          value={active}
          onChange={(e) => {
            setActive(e.target.value);
            setPage(1);
          }}
        />
      </div>

      {error && <Alert tone="error">{error}</Alert>}
      {loading && !data ? (
        <Loading />
      ) : data && data.items.length === 0 ? (
        <EmptyState title="Sin resultados" description="No hay clientes que coincidan con la búsqueda." />
      ) : (
        data && (
          <>
            <DataTable
              caption="Clientes"
              rows={data.items}
              columns={columns}
              rowKey={(c) => c.id}
              cardTitle={(c) => c.name}
              actions={
                canEdit
                  ? (c) => (
                      <Button variant="ghost" icon="edit" iconOnly onClick={() => openForm(c)}>
                        Editar {c.name}
                      </Button>
                    )
                  : undefined
              }
            />
            <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onChange={setPage} />
          </>
        )
      )}

      <ClientFormModal
        open={formOpen}
        client={editing}
        onClose={() => setFormOpen(false)}
        onSaved={() => {
          setFormOpen(false);
          reload();
        }}
      />
    </div>
  );
}
