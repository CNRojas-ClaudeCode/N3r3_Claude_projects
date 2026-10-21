import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useAuth } from '../auth/AuthContext';
import { DataTable, type Column } from '../components/DataTable';
import { InvoiceDetailModal, InvoiceStatusBadge, PAYMENT_METHOD_OPTIONS } from '../components/InvoiceDialogs';
import {
  Alert,
  Button,
  EmptyState,
  Loading,
  Modal,
  PageHeader,
  Pagination,
  Select,
  TextInput,
  useToast,
} from '../components/ui';
import { PAGE_SIZE } from '../config';
import { api, ApiError, errorMessage, toQuery } from '../lib/api';
import { formatDateTime, formatFolio, formatMoney, PAYMENT_TYPE_LABELS } from '../lib/format';
import type { Client, Invoice, InvoiceSummary, Paginated, PaymentMethod, PaymentType, Product } from '../lib/types';
import { useQuery } from '../lib/useQuery';

/** Máximo permitido por la API para listas de selección. */
const PICKER_SIZE = 100;

type Line = { product: Product; quantity: number };

function InvoiceFormModal({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: (invoice: Invoice) => void;
}) {
  const notify = useToast();
  const [clientSearch, setClientSearch] = useState('');
  const [clientId, setClientId] = useState('');
  const [paymentType, setPaymentType] = useState<PaymentType>('CONTADO');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('EFECTIVO');
  const [notes, setNotes] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [lines, setLines] = useState<Line[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setClientSearch('');
    setClientId('');
    setPaymentType('CONTADO');
    setPaymentMethod('EFECTIVO');
    setNotes('');
    setProductSearch('');
    setProductId('');
    setQuantity('1');
    setLines([]);
    setErrors({});
    setError(null);
  }, [open]);

  const clients = useQuery(
    (signal) =>
      open
        ? api<Paginated<Client>>(`/clients${toQuery({ search: clientSearch, active: true, pageSize: PICKER_SIZE })}`, {
            signal,
          })
        : Promise.resolve(undefined),
    [open, clientSearch],
  );
  const products = useQuery(
    (signal) =>
      open
        ? api<Paginated<Product>>(
            `/products${toQuery({ search: productSearch, active: true, pageSize: PICKER_SIZE })}`,
            { signal },
          )
        : Promise.resolve(undefined),
    [open, productSearch],
  );

  const total = useMemo(() => lines.reduce((sum, l) => sum + l.product.priceCents * l.quantity, 0), [lines]);

  const addLine = () => {
    const product = products.data?.items.find((p) => p.id === productId);
    const qty = Number.parseInt(quantity, 10);
    if (!product) return setErrors({ product: 'Seleccione un producto o servicio' });
    if (Number.isNaN(qty) || qty < 1) return setErrors({ quantity: 'Cantidad mínima 1' });
    const existing = lines.find((l) => l.product.id === product.id);
    const newQty = (existing?.quantity ?? 0) + qty;
    if (product.stock !== null && newQty > product.stock) {
      return setErrors({ quantity: `Solo hay ${product.stock} en existencia` });
    }
    setErrors({});
    setLines((ls) =>
      existing ? ls.map((l) => (l.product.id === product.id ? { ...l, quantity: newQty } : l)) : [...ls, { product, quantity: qty }],
    );
    setProductId('');
    setQuantity('1');
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const localErrors: Record<string, string> = {};
    if (!clientId) localErrors.clientId = 'Seleccione un cliente';
    if (lines.length === 0) localErrors.items = 'Agregue al menos un producto';
    setErrors(localErrors);
    if (Object.keys(localErrors).length) return;

    setSaving(true);
    setError(null);
    try {
      const invoice = await api<Invoice>('/invoices', {
        method: 'POST',
        body: {
          clientId,
          paymentType,
          ...(paymentType === 'CONTADO' ? { paymentMethod } : {}),
          notes: notes.trim() || null,
          items: lines.map((l) => ({ productId: l.product.id, quantity: l.quantity })),
        },
      });
      notify(`Factura ${formatFolio(invoice.folio)} creada`);
      onSaved(invoice);
    } catch (err) {
      if (err instanceof ApiError && err.issues.length) setErrors(err.fieldErrors());
      else setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const clientOptions = [
    { value: '', label: clients.loading ? 'Cargando…' : 'Seleccione…' },
    ...(clients.data?.items ?? []).map((c) => ({ value: c.id, label: c.taxId ? `${c.name} · ${c.taxId}` : c.name })),
  ];
  const productOptions = [
    { value: '', label: products.loading ? 'Cargando…' : 'Seleccione…' },
    ...(products.data?.items ?? []).map((p) => ({
      value: p.id,
      label: `${p.name} · ${formatMoney(p.priceCents)}${p.stock !== null ? ` · ${p.stock} uds.` : ''}`,
    })),
  ];

  return (
    <Modal
      open={open}
      title="Nueva factura"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="invoice-form" loading={saving}>
            Crear factura
          </Button>
        </>
      }
    >
      <form id="invoice-form" className="form" onSubmit={onSubmit} noValidate>
        {error && <Alert tone="error">{error}</Alert>}
        <div className="form__row form__row--2">
          <TextInput
            label="Buscar cliente"
            type="search"
            placeholder="Nombre o RFC"
            value={clientSearch}
            onChange={(e) => setClientSearch(e.target.value)}
          />
          <Select
            label="Cliente"
            options={clientOptions}
            value={clientId}
            error={errors.clientId}
            onChange={(e) => setClientId(e.target.value)}
          />
        </div>
        <div className="form__row form__row--2">
          <Select
            label="Tipo de pago"
            options={Object.entries(PAYMENT_TYPE_LABELS).map(([value, label]) => ({ value, label }))}
            value={paymentType}
            error={errors.paymentType}
            onChange={(e) => setPaymentType(e.target.value as PaymentType)}
          />
          {paymentType === 'CONTADO' ? (
            <Select
              label="Método de pago"
              options={PAYMENT_METHOD_OPTIONS}
              value={paymentMethod}
              error={errors.paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
            />
          ) : (
            <p className="field__hint invoice-form__hint">El vencimiento se calcula con los días de crédito del cliente.</p>
          )}
        </div>

        <fieldset className="fieldset">
          <legend className="field__label">Productos y servicios</legend>
          <div className="form__row form__row--2">
            <TextInput
              label="Buscar producto"
              type="search"
              placeholder="Nombre o código"
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
            />
            <Select
              label="Producto"
              options={productOptions}
              value={productId}
              error={errors.product}
              onChange={(e) => setProductId(e.target.value)}
            />
          </div>
          <div className="invoice-form__add">
            <TextInput
              label="Cantidad"
              inputMode="numeric"
              value={quantity}
              error={errors.quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
            <Button variant="secondary" icon="plus" onClick={addLine}>
              Agregar
            </Button>
          </div>
          {errors.items && (
            <span className="field__error" role="alert">
              {errors.items}
            </span>
          )}
          {lines.length > 0 && (
            <ul className="list">
              {lines.map((l) => (
                <li key={l.product.id} className="list__item">
                  <span className="list__main">
                    <strong className="truncate">{l.product.name}</strong>
                    <span className="text-small text-secondary">
                      {l.quantity} × {formatMoney(l.product.priceCents)}
                    </span>
                  </span>
                  <span className="invoice-form__line-end">
                    {formatMoney(l.product.priceCents * l.quantity)}
                    <Button
                      variant="ghost"
                      icon="trash"
                      iconOnly
                      onClick={() => setLines((ls) => ls.filter((x) => x.product.id !== l.product.id))}
                    >
                      Quitar {l.product.name}
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div className="totals">
            <div className="totals__row totals__row--strong">
              <span>Total</span>
              <span>{formatMoney(total)}</span>
            </div>
          </div>
        </fieldset>

        <TextInput
          label="Notas (opcional)"
          maxLength={300}
          value={notes}
          error={errors.notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </form>
    </Modal>
  );
}

export function InvoicesPage() {
  const { can } = useAuth();
  const [folio, setFolio] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const folioNumber = /^\d+$/.test(folio.replace(/^F-?/i, '')) ? Number(folio.replace(/^F-?/i, '')) : undefined;

  const { data, loading, error, reload } = useQuery(
    (signal) =>
      api<Paginated<InvoiceSummary>>(
        `/invoices${toQuery({ folio: folioNumber, status, page, pageSize: PAGE_SIZE })}`,
        { signal },
      ),
    [folioNumber, status, page],
  );

  const columns: Column<InvoiceSummary>[] = [
    { key: 'folio', header: 'Folio', render: (i) => formatFolio(i.folio), hideOnCard: true },
    { key: 'date', header: 'Fecha', render: (i) => formatDateTime(i.createdAt) },
    { key: 'client', header: 'Cliente', render: (i) => i.client.name },
    { key: 'type', header: 'Pago', render: (i) => PAYMENT_TYPE_LABELS[i.paymentType] },
    { key: 'total', header: 'Total', align: 'right', render: (i) => formatMoney(i.totalCents) },
    { key: 'balance', header: 'Saldo', align: 'right', render: (i) => formatMoney(i.balanceCents) },
    { key: 'status', header: 'Estado', render: (i) => <InvoiceStatusBadge status={i.paymentStatus} /> },
  ];

  return (
    <div className="page">
      <PageHeader
        title="Facturación"
        subtitle="Notas de venta de contado y a crédito"
        actions={
          can('invoices.create') && (
            <Button icon="plus" onClick={() => setFormOpen(true)}>
              Nueva factura
            </Button>
          )
        }
      />

      <div className="toolbar">
        <TextInput
          label="Folio"
          type="search"
          placeholder="Ej. 15"
          value={folio}
          onChange={(e) => {
            setFolio(e.target.value);
            setPage(1);
          }}
        />
        <Select
          label="Estado"
          options={[
            { value: '', label: 'Todas' },
            { value: 'VIGENTE', label: 'Vigentes' },
            { value: 'ANULADA', label: 'Anuladas' },
          ]}
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        />
      </div>

      {error && <Alert tone="error">{error}</Alert>}
      {loading && !data ? (
        <Loading />
      ) : data && data.items.length === 0 ? (
        <EmptyState title="Sin facturas" description="No hay facturas que coincidan con los filtros." />
      ) : (
        data && (
          <>
            <DataTable
              caption="Facturas"
              rows={data.items}
              columns={columns}
              rowKey={(i) => i.id}
              cardTitle={(i) => formatFolio(i.folio)}
              actions={(i) => (
                <Button variant="ghost" icon="eye" iconOnly onClick={() => setDetailId(i.id)}>
                  Ver factura {formatFolio(i.folio)}
                </Button>
              )}
            />
            <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onChange={setPage} />
          </>
        )
      )}

      <InvoiceFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={(invoice) => {
          setFormOpen(false);
          reload();
          setDetailId(invoice.id);
        }}
      />
      <InvoiceDetailModal invoiceId={detailId} onClose={() => setDetailId(null)} onChanged={reload} />
    </div>
  );
}
