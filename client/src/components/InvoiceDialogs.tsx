import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../auth/AuthContext';
import { api, ApiError, errorMessage } from '../lib/api';
import {
  formatDate,
  formatDateTime,
  formatFolio,
  formatMoney,
  INVOICE_STATUS,
  parseMoneyToCents,
  PAYMENT_KIND_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_TYPE_LABELS,
} from '../lib/format';
import type { Invoice, PaymentMethod } from '../lib/types';
import { useQuery } from '../lib/useQuery';
import { Alert, Badge, Button, Loading, Modal, Select, TextArea, TextInput, useToast } from './ui';

export const PAYMENT_METHOD_OPTIONS = Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => ({ value, label }));

export function InvoiceStatusBadge({ status }: { status: string }) {
  const s = INVOICE_STATUS[status] ?? { label: status, tone: 'neutral' as const };
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

type PaymentKind = 'PAGO' | 'ABONO';

/** Registro de pago (liquida el saldo) o abono (parcial). */
function PaymentModal({
  invoice,
  kind,
  onClose,
  onSaved,
}: {
  invoice: Invoice;
  kind: PaymentKind | null;
  onClose: () => void;
  onSaved: (invoice: Invoice) => void;
}) {
  const notify = useToast();
  const [method, setMethod] = useState<PaymentMethod>('EFECTIVO');
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!kind) return;
    setMethod('EFECTIVO');
    setAmount('');
    setReference('');
    setErrors({});
    setError(null);
  }, [kind]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    let amountCents: number | undefined;
    if (kind === 'ABONO') {
      const cents = parseMoneyToCents(amount);
      if (cents === null || cents <= 0) return setErrors({ amountCents: 'Ingrese un monto válido (ej. 150.00)' });
      if (cents >= invoice.balanceCents) {
        return setErrors({ amountCents: 'El abono debe ser menor al saldo; para liquidar registre un pago' });
      }
      amountCents = cents;
    }
    setErrors({});
    setSaving(true);
    setError(null);
    try {
      const path = kind === 'PAGO' ? 'payments' : 'installments';
      const updated = await api<Invoice>(`/invoices/${invoice.id}/${path}`, {
        method: 'POST',
        body: { method, reference: reference.trim() || null, ...(amountCents ? { amountCents } : {}) },
      });
      notify(kind === 'PAGO' ? 'Pago registrado' : 'Abono registrado');
      onSaved(updated);
    } catch (err) {
      if (err instanceof ApiError && err.issues.length) setErrors(err.fieldErrors());
      else setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={!!kind}
      title={kind === 'PAGO' ? 'Registrar pago' : 'Registrar abono'}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="payment-form" loading={saving}>
            Registrar
          </Button>
        </>
      }
    >
      <form id="payment-form" className="form" onSubmit={onSubmit} noValidate>
        {error && <Alert tone="error">{error}</Alert>}
        <Alert>
          Factura {formatFolio(invoice.folio)} · Saldo pendiente <strong>{formatMoney(invoice.balanceCents)}</strong>
        </Alert>
        {kind === 'PAGO' ? (
          <p className="text-secondary">El pago liquida el saldo completo de la factura.</p>
        ) : (
          <TextInput
            label="Monto del abono"
            inputMode="decimal"
            required
            placeholder="0.00"
            value={amount}
            error={errors.amountCents}
            onChange={(e) => setAmount(e.target.value)}
          />
        )}
        <div className="form__row form__row--2">
          <Select
            label="Método"
            options={PAYMENT_METHOD_OPTIONS}
            value={method}
            error={errors.method}
            onChange={(e) => setMethod(e.target.value as PaymentMethod)}
          />
          <TextInput
            label="Referencia (opcional)"
            maxLength={80}
            value={reference}
            error={errors.reference}
            onChange={(e) => setReference(e.target.value)}
          />
        </div>
      </form>
    </Modal>
  );
}

function VoidModal({
  invoice,
  open,
  onClose,
  onSaved,
}: {
  invoice: Invoice;
  open: boolean;
  onClose: () => void;
  onSaved: (invoice: Invoice) => void;
}) {
  const notify = useToast();
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setReason('');
    setError(null);
    setFieldError(undefined);
  }, [open]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (reason.trim().length < 5) return setFieldError('El motivo debe tener al menos 5 caracteres');
    setFieldError(undefined);
    setSaving(true);
    setError(null);
    try {
      const updated = await api<Invoice>(`/invoices/${invoice.id}/void`, { method: 'POST', body: { reason } });
      notify('Factura anulada');
      onSaved(updated);
    } catch (err) {
      if (err instanceof ApiError && err.issues.length) setFieldError(err.fieldErrors().reason);
      else setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const paidCents = invoice.totalCents - invoice.balanceCents;

  return (
    <Modal
      open={open}
      title={`Anular factura ${formatFolio(invoice.folio)}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" variant="danger" form="void-form" loading={saving}>
            Anular
          </Button>
        </>
      }
    >
      <form id="void-form" className="form" onSubmit={onSubmit} noValidate>
        {error && <Alert tone="error">{error}</Alert>}
        <Alert tone="warning">
          La anulación no se puede revertir. Las existencias vuelven al inventario y la factura sale de ventas y cartera.
          {paidCents > 0 && ` Tiene ${formatMoney(paidCents)} cobrados: la devolución al cliente se gestiona fuera del sistema.`}
        </Alert>
        <TextArea
          label="Motivo"
          required
          maxLength={300}
          value={reason}
          error={fieldError}
          onChange={(e) => setReason(e.target.value)}
        />
      </form>
    </Modal>
  );
}

/** Detalle de factura con acciones según permisos: pago, abono y anulación. */
export function InvoiceDetailModal({
  invoiceId,
  onClose,
  onChanged,
}: {
  invoiceId: string | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { can } = useAuth();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [paymentKind, setPaymentKind] = useState<PaymentKind | null>(null);
  const [voidOpen, setVoidOpen] = useState(false);

  const { data, loading, error } = useQuery(
    (signal) => (invoiceId ? api<Invoice>(`/invoices/${invoiceId}`, { signal }) : Promise.resolve(null)),
    [invoiceId],
  );

  useEffect(() => setInvoice(data ?? null), [data]);

  const updated = (inv: Invoice) => {
    setInvoice(inv);
    setPaymentKind(null);
    setVoidOpen(false);
    onChanged();
  };

  const collectible = invoice?.status === 'VIGENTE' && invoice.balanceCents > 0;

  return (
    <>
      <Modal open={!!invoiceId && !paymentKind && !voidOpen} title="Detalle de factura" onClose={onClose}>
        {error && <Alert tone="error">{error}</Alert>}
        {loading && !invoice ? (
          <Loading />
        ) : (
          invoice && (
            <div className="invoice-detail">
              <div className="invoice-detail__header">
                <div>
                  <h3>{formatFolio(invoice.folio)}</h3>
                  <span className="text-secondary">{formatDateTime(invoice.createdAt)}</span>
                </div>
                <InvoiceStatusBadge status={invoice.paymentStatus} />
              </div>

              <dl className="definition-list">
                <div>
                  <dt>Cliente</dt>
                  <dd>
                    {invoice.client.name}
                    {invoice.client.taxId && <span className="text-secondary"> · {invoice.client.taxId}</span>}
                  </dd>
                </div>
                <div>
                  <dt>Tipo de pago</dt>
                  <dd>{PAYMENT_TYPE_LABELS[invoice.paymentType]}</dd>
                </div>
                {invoice.dueDate && (
                  <div>
                    <dt>Vencimiento</dt>
                    <dd>{formatDate(invoice.dueDate)}</dd>
                  </div>
                )}
                <div>
                  <dt>Elaboró</dt>
                  <dd>{invoice.createdByName}</dd>
                </div>
              </dl>

              <ul className="list">
                {invoice.items.map((item) => (
                  <li key={item.id} className="list__item">
                    <span className="list__main">
                      <strong className="truncate">{item.name}</strong>
                      <span className="text-small text-secondary">
                        {item.quantity} × {formatMoney(item.unitPriceCents)} · {item.code}
                      </span>
                    </span>
                    <span>{formatMoney(item.lineTotalCents)}</span>
                  </li>
                ))}
              </ul>

              <div className="totals">
                <div className="totals__row totals__row--strong">
                  <span>Total</span>
                  <span>{formatMoney(invoice.totalCents)}</span>
                </div>
                <div className="totals__row">
                  <span>Pagado</span>
                  <span>{formatMoney(invoice.totalCents - invoice.balanceCents)}</span>
                </div>
                <div className="totals__row">
                  <span>Saldo</span>
                  <span>{formatMoney(invoice.balanceCents)}</span>
                </div>
              </div>

              {invoice.notes && <p className="text-secondary">Notas: {invoice.notes}</p>}
              {invoice.status === 'ANULADA' && (
                <Alert tone="warning">
                  Anulada el {formatDateTime(invoice.voidedAt)}. Motivo: {invoice.voidReason}
                </Alert>
              )}

              {invoice.payments.length > 0 && (
                <section className="invoice-detail__section">
                  <h3>Pagos y abonos</h3>
                  <ul className="list">
                    {invoice.payments.map((p) => (
                      <li key={p.id} className="list__item">
                        <span className="list__main">
                          <strong>
                            {PAYMENT_KIND_LABELS[p.kind]} · {PAYMENT_METHOD_LABELS[p.method]}
                          </strong>
                          <span className="text-small text-secondary">
                            {formatDateTime(p.createdAt)} · {p.createdByName}
                            {p.reference && ` · Ref. ${p.reference}`}
                          </span>
                        </span>
                        <span>{formatMoney(p.amountCents)}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <div className="modal__footer">
                {invoice.status === 'VIGENTE' && can('invoices.void') && (
                  <Button variant="danger" icon="ban" onClick={() => setVoidOpen(true)}>
                    Anular
                  </Button>
                )}
                {collectible && can('installments.create') && (
                  <Button variant="secondary" onClick={() => setPaymentKind('ABONO')}>
                    Registrar abono
                  </Button>
                )}
                {collectible && can('payments.create') && (
                  <Button icon="cash" onClick={() => setPaymentKind('PAGO')}>
                    Registrar pago
                  </Button>
                )}
              </div>
            </div>
          )
        )}
      </Modal>

      {invoice && (
        <>
          <PaymentModal invoice={invoice} kind={paymentKind} onClose={() => setPaymentKind(null)} onSaved={updated} />
          <VoidModal invoice={invoice} open={voidOpen} onClose={() => setVoidOpen(false)} onSaved={updated} />
        </>
      )}
    </>
  );
}
