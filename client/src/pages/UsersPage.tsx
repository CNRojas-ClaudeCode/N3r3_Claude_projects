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
  TextInput,
  useToast,
} from '../components/ui';
import { PAGE_SIZE, PASSWORD_MIN_LENGTH } from '../config';
import { api, ApiError, errorMessage, toQuery } from '../lib/api';
import { formatDateTime, ROLE_LABELS } from '../lib/format';
import type { Paginated, Role, User } from '../lib/types';
import { useQuery } from '../lib/useQuery';

const ROLE_OPTIONS = Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label }));

type FormState = { name: string; email: string; role: Role; password: string; active: boolean };

function UserFormModal({
  user,
  open,
  onClose,
  onSaved,
}: {
  user: User | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { user: me } = useAuth();
  const notify = useToast();
  const [form, setForm] = useState<FormState>({ name: '', email: '', role: 'EMPLEADO', password: '', active: true });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const isSelf = user?.id === me?.id;

  useEffect(() => {
    if (!open) return;
    setForm(
      user
        ? { name: user.name, email: user.email, role: user.role, password: '', active: user.active }
        : { name: '', email: '', role: 'EMPLEADO', password: '', active: true },
    );
    setErrors({});
    setError(null);
  }, [open, user]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setErrors({});
    try {
      if (user) {
        const body: Partial<FormState> = { name: form.name, email: form.email };
        if (!isSelf) {
          body.role = form.role;
          body.active = form.active;
        }
        await api(`/users/${user.id}`, { method: 'PATCH', body });
      } else {
        await api('/users', {
          method: 'POST',
          body: { name: form.name, email: form.email, role: form.role, password: form.password },
        });
      }
      notify(user ? 'Usuario actualizado' : 'Usuario creado');
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
      title={user ? 'Editar usuario' : 'Nuevo usuario'}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="user-form" loading={saving}>
            Guardar
          </Button>
        </>
      }
    >
      <form id="user-form" className="form" onSubmit={onSubmit} noValidate>
        {error && <Alert tone="error">{error}</Alert>}
        <TextInput
          label="Nombre"
          required
          value={form.name}
          error={errors.name}
          onChange={(e) => set('name', e.target.value)}
        />
        <TextInput
          label="Email"
          type="email"
          required
          value={form.email}
          error={errors.email}
          onChange={(e) => set('email', e.target.value)}
        />
        <Select
          label="Rol"
          options={ROLE_OPTIONS}
          value={form.role}
          error={errors.role}
          disabled={isSelf}
          onChange={(e) => set('role', e.target.value as Role)}
        />
        {!user && (
          <TextInput
            label="Contraseña temporal"
            type="password"
            autoComplete="new-password"
            required
            minLength={PASSWORD_MIN_LENGTH}
            value={form.password}
            error={errors.password}
            hint={`Mínimo ${PASSWORD_MIN_LENGTH} caracteres. El usuario deberá cambiarla al ingresar.`}
            onChange={(e) => set('password', e.target.value)}
          />
        )}
        {user && !isSelf && (
          <Checkbox label="Usuario activo" checked={form.active} onChange={(e) => set('active', e.target.checked)} />
        )}
        {isSelf && <Alert>No puede cambiar su propio rol ni desactivar su cuenta.</Alert>}
      </form>
    </Modal>
  );
}

export function UsersPage() {
  const { user: me } = useAuth();
  const notify = useToast();
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<User | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [toUnlock, setToUnlock] = useState<User | null>(null);
  const [toDeactivate, setToDeactivate] = useState<User | null>(null);
  const [busy, setBusy] = useState(false);

  const { data, loading, error, reload } = useQuery(
    (signal) => api<Paginated<User>>(`/users${toQuery({ search, role, page, pageSize: PAGE_SIZE })}`, { signal }),
    [search, role, page],
  );

  const runAction = async (action: () => Promise<unknown>, success: string, done: () => void) => {
    setBusy(true);
    try {
      await action();
      notify(success);
      done();
      reload();
    } catch (err) {
      notify(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  const columns: Column<User>[] = [
    { key: 'name', header: 'Nombre', render: (u) => u.name, hideOnCard: true },
    { key: 'email', header: 'Email', render: (u) => u.email },
    { key: 'role', header: 'Rol', render: (u) => ROLE_LABELS[u.role] },
    {
      key: 'status',
      header: 'Estado',
      render: (u) =>
        u.locked ? (
          <Badge tone="error">Bloqueado</Badge>
        ) : u.active ? (
          <Badge tone="success">Activo</Badge>
        ) : (
          <Badge tone="neutral">Inactivo</Badge>
        ),
    },
    { key: 'last', header: 'Último acceso', render: (u) => formatDateTime(u.lastLoginAt) },
  ];

  return (
    <div className="page">
      <PageHeader
        title="Usuarios"
        subtitle="Cuentas, roles y estado de acceso"
        actions={
          <Button
            icon="plus"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            Nuevo
          </Button>
        }
      />
      <div className="toolbar">
        <TextInput
          label="Buscar"
          type="search"
          placeholder="Nombre o email"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <Select
          label="Rol"
          options={[{ value: '', label: 'Todos' }, ...ROLE_OPTIONS]}
          value={role}
          onChange={(e) => {
            setRole(e.target.value);
            setPage(1);
          }}
        />
      </div>

      {error && <Alert tone="error">{error}</Alert>}
      {loading && !data ? (
        <Loading />
      ) : data && data.items.length === 0 ? (
        <EmptyState title="Sin resultados" />
      ) : (
        data && (
          <>
            <DataTable
              caption="Usuarios"
              rows={data.items}
              columns={columns}
              rowKey={(u) => u.id}
              cardTitle={(u) => u.name}
              actions={(u) => (
                <>
                  {u.locked && (
                    <Button variant="ghost" icon="unlock" iconOnly onClick={() => setToUnlock(u)}>
                      Desbloquear {u.name}
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    icon="edit"
                    iconOnly
                    onClick={() => {
                      setEditing(u);
                      setFormOpen(true);
                    }}
                  >
                    Editar {u.name}
                  </Button>
                  {u.active && u.id !== me?.id && (
                    <Button variant="ghost" icon="trash" iconOnly onClick={() => setToDeactivate(u)}>
                      Desactivar {u.name}
                    </Button>
                  )}
                </>
              )}
            />
            <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onChange={setPage} />
          </>
        )
      )}

      <UserFormModal
        open={formOpen}
        user={editing}
        onClose={() => setFormOpen(false)}
        onSaved={() => {
          setFormOpen(false);
          reload();
        }}
      />
      <ConfirmDialog
        open={!!toUnlock}
        title="Desbloquear usuario"
        message={`¿Desbloquear a ${toUnlock?.name ?? ''}? Se reiniciará su contador de intentos fallidos.`}
        confirmLabel="Desbloquear"
        loading={busy}
        onConfirm={() =>
          void runAction(
            () => api(`/users/${toUnlock!.id}/unlock`, { method: 'POST', body: {} }),
            'Usuario desbloqueado',
            () => setToUnlock(null),
          )
        }
        onCancel={() => setToUnlock(null)}
      />
      <ConfirmDialog
        open={!!toDeactivate}
        title="Desactivar usuario"
        message={`¿Desactivar a ${toDeactivate?.name ?? ''}? Se cerrarán sus sesiones y no podrá ingresar.`}
        confirmLabel="Desactivar"
        danger
        loading={busy}
        onConfirm={() =>
          void runAction(
            () => api(`/users/${toDeactivate!.id}`, { method: 'PATCH', body: { active: false } }),
            'Usuario desactivado',
            () => setToDeactivate(null),
          )
        }
        onCancel={() => setToDeactivate(null)}
      />
    </div>
  );
}
