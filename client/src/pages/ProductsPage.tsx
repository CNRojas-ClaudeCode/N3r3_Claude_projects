import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../auth/AuthContext';
import { DataTable, type Column } from '../components/DataTable';
import {
  Alert,
  Badge,
  Button,
  Checkbox,
  ConfirmDialog,
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
import { centsToInput, formatMoney, parseMoneyToCents, PRODUCT_TYPE_LABELS } from '../lib/format';
import type { Paginated, Product, ProductType } from '../lib/types';
import { useQuery } from '../lib/useQuery';

const TYPE_OPTIONS = [
  { value: 'PRODUCTO', label: 'Producto' },
  { value: 'SERVICIO', label: 'Servicio' },
];

type FormState = {
  code: string;
  name: string;
  description: string;
  type: ProductType;
  price: string;
  stock: string;
  active: boolean;
};

const emptyForm: FormState = { code: '', name: '', description: '', type: 'PRODUCTO', price: '', stock: '0', active: true };

const toForm = (p: Product): FormState => ({
  code: p.code,
  name: p.name,
  description: p.description ?? '',
  type: p.type,
  price: centsToInput(p.priceCents),
  stock: String(p.stock ?? 0),
  active: p.active,
});

function ProductFormModal({
  product,
  open,
  onClose,
  onSaved,
}: {
  product: Product | null;
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
    setForm(product ? toForm(product) : emptyForm);
    setErrors({});
    setError(null);
  }, [open, product]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const priceCents = parseMoneyToCents(form.price);
    const stock = form.type === 'SERVICIO' ? null : Number.parseInt(form.stock, 10);
    const localErrors: Record<string, string> = {};
    if (priceCents === null) localErrors.priceCents = 'Ingrese un precio válido (ej. 25.50)';
    if (stock !== null && (Number.isNaN(stock) || stock < 0)) localErrors.stock = 'Ingrese un número entero mayor o igual a 0';
    setErrors(localErrors);
    if (Object.keys(localErrors).length) return;

    setSaving(true);
    setError(null);
    const body = {
      code: form.code,
      name: form.name,
      description: form.description.trim() || null,
      type: form.type,
      priceCents,
      stock,
      active: form.active,
    };
    try {
      if (product) await api(`/products/${product.id}`, { method: 'PATCH', body });
      else await api('/products', { method: 'POST', body });
      notify(product ? 'Producto actualizado' : 'Producto creado');
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
      title={product ? 'Editar producto' : 'Nuevo producto o servicio'}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="product-form" loading={saving}>
            Guardar
          </Button>
        </>
      }
    >
      <form id="product-form" className="form" onSubmit={onSubmit} noValidate>
        {error && <Alert tone="error">{error}</Alert>}
        <div className="form__row form__row--2">
          <TextInput
            label="Código"
            required
            maxLength={30}
            value={form.code}
            error={errors.code}
            hint="Letras, números y guiones"
            onChange={(e) => set('code', e.target.value.toUpperCase())}
          />
          <Select
            label="Tipo"
            options={TYPE_OPTIONS}
            value={form.type}
            error={errors.type}
            onChange={(e) => set('type', e.target.value as ProductType)}
          />
        </div>
        <TextInput
          label="Nombre"
          required
          maxLength={120}
          value={form.name}
          error={errors.name}
          onChange={(e) => set('name', e.target.value)}
        />
        <TextArea
          label="Descripción (opcional)"
          maxLength={500}
          value={form.description}
          error={errors.description}
          onChange={(e) => set('description', e.target.value)}
        />
        <div className="form__row form__row--2">
          <TextInput
            label="Precio"
            inputMode="decimal"
            required
            value={form.price}
            error={errors.priceCents}
            placeholder="0.00"
            onChange={(e) => set('price', e.target.value)}
          />
          {form.type === 'PRODUCTO' && (
            <TextInput
              label="Existencias"
              inputMode="numeric"
              required
              value={form.stock}
              error={errors.stock}
              onChange={(e) => set('stock', e.target.value)}
            />
          )}
        </div>
        <Checkbox label="Activo" checked={form.active} onChange={(e) => set('active', e.target.checked)} />
      </form>
    </Modal>
  );
}

export function ProductsPage() {
  const { can } = useAuth();
  const notify = useToast();
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Product | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [toDelete, setToDelete] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { data, loading, error, reload } = useQuery(
    (signal) =>
      api<Paginated<Product>>(`/products${toQuery({ search, type, page, pageSize: PAGE_SIZE })}`, { signal }),
    [search, type, page],
  );

  const canEdit = can('products.update');
  const canDelete = can('products.delete');

  const openForm = (product: Product | null) => {
    setEditing(product);
    setFormOpen(true);
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await api(`/products/${toDelete.id}`, { method: 'DELETE' });
      notify('Producto eliminado');
      setToDelete(null);
      reload();
    } catch (err) {
      notify(errorMessage(err), 'error');
    } finally {
      setDeleting(false);
    }
  };

  const columns: Column<Product>[] = [
    { key: 'code', header: 'Código', render: (p) => p.code },
    { key: 'name', header: 'Nombre', render: (p) => p.name, hideOnCard: true },
    { key: 'type', header: 'Tipo', render: (p) => PRODUCT_TYPE_LABELS[p.type] },
    { key: 'price', header: 'Precio', align: 'right', render: (p) => formatMoney(p.priceCents) },
    { key: 'stock', header: 'Existencias', align: 'right', render: (p) => (p.stock === null ? '—' : p.stock) },
    {
      key: 'active',
      header: 'Estado',
      render: (p) => <Badge tone={p.active ? 'success' : 'neutral'}>{p.active ? 'Activo' : 'Inactivo'}</Badge>,
    },
  ];

  return (
    <div className="page">
      <PageHeader
        title="Productos y servicios"
        subtitle="Catálogo de la miscelánea"
        actions={
          can('products.create') && (
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
          placeholder="Nombre o código"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <Select
          label="Tipo"
          options={[{ value: '', label: 'Todos' }, ...TYPE_OPTIONS]}
          value={type}
          onChange={(e) => {
            setType(e.target.value);
            setPage(1);
          }}
        />
      </div>

      {error && <Alert tone="error">{error}</Alert>}
      {loading && !data ? (
        <Loading />
      ) : data && data.items.length === 0 ? (
        <EmptyState title="Sin resultados" description="No hay productos que coincidan con la búsqueda." />
      ) : (
        data && (
          <>
            <DataTable
              caption="Productos y servicios"
              rows={data.items}
              columns={columns}
              rowKey={(p) => p.id}
              cardTitle={(p) => p.name}
              actions={
                canEdit || canDelete
                  ? (p) => (
                      <>
                        {canEdit && (
                          <Button variant="ghost" icon="edit" iconOnly onClick={() => openForm(p)}>
                            Editar {p.name}
                          </Button>
                        )}
                        {canDelete && (
                          <Button variant="ghost" icon="trash" iconOnly onClick={() => setToDelete(p)}>
                            Eliminar {p.name}
                          </Button>
                        )}
                      </>
                    )
                  : undefined
              }
            />
            <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onChange={setPage} />
          </>
        )
      )}

      <ProductFormModal
        open={formOpen}
        product={editing}
        onClose={() => setFormOpen(false)}
        onSaved={() => {
          setFormOpen(false);
          reload();
        }}
      />
      <ConfirmDialog
        open={!!toDelete}
        title="Eliminar producto"
        message={`¿Eliminar "${toDelete?.name ?? ''}"? Esta acción queda registrada en la bitácora.`}
        confirmLabel="Eliminar"
        danger
        loading={deleting}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}
