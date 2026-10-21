import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../auth/AuthContext';
import { DataTable, type Column } from '../components/DataTable';
import { Icon } from '../components/Icon';
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
import { formatDateTime } from '../lib/format';
import type { Paginated, TrainingMaterial } from '../lib/types';
import { useQuery } from '../lib/useQuery';

type TrainingResponse = Paginated<TrainingMaterial> & { categories: string[] };

type FormState = { title: string; category: string; description: string; content: string; url: string; active: boolean };

const emptyForm: FormState = { title: '', category: '', description: '', content: '', url: '', active: true };

const toForm = (t: TrainingMaterial): FormState => ({
  title: t.title,
  category: t.category,
  description: t.description ?? '',
  content: t.content,
  url: t.url ?? '',
  active: t.active,
});

function TrainingFormModal({
  material,
  open,
  onClose,
  onSaved,
}: {
  material: TrainingMaterial | null;
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
    setForm(material ? toForm(material) : emptyForm);
    setErrors({});
    setError(null);
  }, [open, material]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setErrors({});
    const body = {
      title: form.title,
      category: form.category,
      description: form.description.trim() || null,
      content: form.content,
      url: form.url.trim() || null,
      active: form.active,
    };
    try {
      if (material) await api(`/training/${material.id}`, { method: 'PATCH', body });
      else await api('/training', { method: 'POST', body });
      notify(material ? 'Material actualizado' : 'Material creado');
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
      title={material ? 'Editar material' : 'Nuevo material de capacitación'}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="training-form" loading={saving}>
            Guardar
          </Button>
        </>
      }
    >
      <form id="training-form" className="form" onSubmit={onSubmit} noValidate>
        {error && <Alert tone="error">{error}</Alert>}
        <div className="form__row form__row--2">
          <TextInput
            label="Título"
            required
            maxLength={120}
            value={form.title}
            error={errors.title}
            onChange={(e) => set('title', e.target.value)}
          />
          <TextInput
            label="Categoría"
            required
            maxLength={60}
            placeholder="Ej. Ventas, Caja, Inventario"
            value={form.category}
            error={errors.category}
            onChange={(e) => set('category', e.target.value)}
          />
        </div>
        <TextInput
          label="Descripción breve (opcional)"
          maxLength={300}
          value={form.description}
          error={errors.description}
          onChange={(e) => set('description', e.target.value)}
        />
        <TextArea
          label="Contenido"
          required
          maxLength={10000}
          rows={8}
          value={form.content}
          error={errors.content}
          onChange={(e) => set('content', e.target.value)}
        />
        <TextInput
          label="Enlace (opcional)"
          type="url"
          maxLength={500}
          placeholder="https://"
          value={form.url}
          error={errors.url}
          hint="Video o documento externo. Solo enlaces https://"
          onChange={(e) => set('url', e.target.value)}
        />
        <Checkbox
          label="Publicado (visible para empleados)"
          checked={form.active}
          onChange={(e) => set('active', e.target.checked)}
        />
      </form>
    </Modal>
  );
}

function TrainingViewModal({ material, onClose }: { material: TrainingMaterial | null; onClose: () => void }) {
  return (
    <Modal open={!!material} title={material?.title ?? ''} onClose={onClose}>
      {material && (
        <div className="invoice-detail">
          <div className="invoice-detail__header">
            <Badge>{material.category}</Badge>
            <span className="text-small text-secondary">Actualizado {formatDateTime(material.updatedAt)}</span>
          </div>
          {material.description && <p className="text-secondary">{material.description}</p>}
          {/* Texto plano: React escapa el contenido, nunca se interpreta como HTML */}
          <p className="training-content">{material.content}</p>
          {material.url && (
            <a className="training-link" href={material.url} target="_blank" rel="noopener noreferrer">
              <Icon name="link" />
              Abrir material de apoyo
            </a>
          )}
        </div>
      )}
    </Modal>
  );
}

export function TrainingPage() {
  const { can } = useAuth();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<TrainingMaterial | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [viewing, setViewing] = useState<TrainingMaterial | null>(null);

  const { data, loading, error, reload } = useQuery(
    (signal) =>
      api<TrainingResponse>(`/training${toQuery({ search, category, page, pageSize: PAGE_SIZE })}`, { signal }),
    [search, category, page],
  );

  const canManage = can('training.manage');

  const openForm = (material: TrainingMaterial | null) => {
    setEditing(material);
    setFormOpen(true);
  };

  const columns: Column<TrainingMaterial>[] = [
    { key: 'title', header: 'Título', render: (t) => t.title, hideOnCard: true },
    { key: 'category', header: 'Categoría', render: (t) => t.category },
    { key: 'description', header: 'Descripción', render: (t) => t.description ?? '—' },
    ...(canManage
      ? [
          {
            key: 'active',
            header: 'Estado',
            render: (t: TrainingMaterial) => (
              <Badge tone={t.active ? 'success' : 'neutral'}>{t.active ? 'Publicado' : 'Oculto'}</Badge>
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="page">
      <PageHeader
        title="Capacitación"
        subtitle="Guías y materiales para el personal"
        actions={
          canManage && (
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
          placeholder="Título o descripción"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <Select
          label="Categoría"
          options={[{ value: '', label: 'Todas' }, ...(data?.categories ?? []).map((c) => ({ value: c, label: c }))]}
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setPage(1);
          }}
        />
      </div>

      {error && <Alert tone="error">{error}</Alert>}
      {loading && !data ? (
        <Loading />
      ) : data && data.items.length === 0 ? (
        <EmptyState title="Sin materiales" description="No hay materiales de capacitación disponibles." />
      ) : (
        data && (
          <>
            <DataTable
              caption="Materiales de capacitación"
              rows={data.items}
              columns={columns}
              rowKey={(t) => t.id}
              cardTitle={(t) => t.title}
              actions={(t) => (
                <>
                  <Button variant="ghost" icon="eye" iconOnly onClick={() => setViewing(t)}>
                    Ver {t.title}
                  </Button>
                  {canManage && (
                    <Button variant="ghost" icon="edit" iconOnly onClick={() => openForm(t)}>
                      Editar {t.title}
                    </Button>
                  )}
                </>
              )}
            />
            <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onChange={setPage} />
          </>
        )
      )}

      <TrainingViewModal material={viewing} onClose={() => setViewing(null)} />
      <TrainingFormModal
        open={formOpen}
        material={editing}
        onClose={() => setFormOpen(false)}
        onSaved={() => {
          setFormOpen(false);
          reload();
        }}
      />
    </div>
  );
}
