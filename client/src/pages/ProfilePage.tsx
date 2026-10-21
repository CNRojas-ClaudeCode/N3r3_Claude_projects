import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Alert, Button, Card, PageHeader, TextInput, useToast } from '../components/ui';
import { PASSWORD_MIN_LENGTH } from '../config';
import { api, ApiError, errorMessage } from '../lib/api';
import { formatDateTime, ROLE_LABELS } from '../lib/format';
import type { SessionUser } from '../lib/types';

function ProfileForm() {
  const { user, setSession } = useAuth();
  const notify = useToast();
  const [name, setName] = useState(user?.name ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      setSession(await api<SessionUser>('/profile', { method: 'PATCH', body: { name } }));
      notify('Perfil actualizado');
    } catch (err) {
      setError(err instanceof ApiError && err.issues[0] ? err.issues[0].message : errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card title="Datos personales">
      <form className="form" onSubmit={onSubmit} noValidate>
        {error && <Alert tone="error">{error}</Alert>}
        <TextInput label="Nombre" required value={name} onChange={(e) => setName(e.target.value)} />
        <div>
          <Button type="submit" loading={saving}>
            Guardar cambios
          </Button>
        </div>
      </form>
    </Card>
  );
}

function ChangePasswordForm() {
  const { setSession, user } = useAuth();
  const navigate = useNavigate();
  const notify = useToast();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrors({});
    setError(null);
    if (next !== confirm) {
      setErrors({ confirm: 'Las contraseñas no coinciden' });
      return;
    }
    setSaving(true);
    const wasForced = user?.mustChangePassword;
    try {
      setSession(
        await api<SessionUser>('/profile/password', {
          method: 'POST',
          body: { currentPassword: current, newPassword: next },
        }),
      );
      setCurrent('');
      setNext('');
      setConfirm('');
      notify('Contraseña actualizada. Se cerraron las demás sesiones.');
      if (wasForced) navigate('/', { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.issues.length) setErrors(err.fieldErrors());
      else setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card title="Cambiar contraseña">
      <form className="form" onSubmit={onSubmit} noValidate>
        {error && <Alert tone="error">{error}</Alert>}
        <TextInput
          label="Contraseña actual"
          type="password"
          autoComplete="current-password"
          required
          value={current}
          error={errors.currentPassword}
          onChange={(e) => setCurrent(e.target.value)}
        />
        <div className="form__row form__row--2">
          <TextInput
            label="Nueva contraseña"
            type="password"
            autoComplete="new-password"
            required
            minLength={PASSWORD_MIN_LENGTH}
            value={next}
            error={errors.newPassword}
            hint={`Mínimo ${PASSWORD_MIN_LENGTH} caracteres`}
            onChange={(e) => setNext(e.target.value)}
          />
          <TextInput
            label="Confirmar nueva contraseña"
            type="password"
            autoComplete="new-password"
            required
            value={confirm}
            error={errors.confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>
        <div>
          <Button type="submit" loading={saving}>
            Actualizar contraseña
          </Button>
        </div>
      </form>
    </Card>
  );
}

export function ProfilePage() {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <div className="page">
      <PageHeader title="Mi perfil" subtitle="Datos de su cuenta y seguridad" />
      {user.mustChangePassword && (
        <Alert tone="warning">Debe cambiar su contraseña temporal antes de usar la aplicación.</Alert>
      )}
      <Card title="Cuenta">
        <dl className="definition-list">
          <div>
            <dt>Email</dt>
            <dd>{user.email}</dd>
          </div>
          <div>
            <dt>Rol</dt>
            <dd>{ROLE_LABELS[user.role]}</dd>
          </div>
          <div>
            <dt>Último acceso</dt>
            <dd>{formatDateTime(user.lastLoginAt)}</dd>
          </div>
          <div>
            <dt>Miembro desde</dt>
            <dd>{formatDateTime(user.createdAt)}</dd>
          </div>
        </dl>
      </Card>
      {!user.mustChangePassword && <ProfileForm />}
      <ChangePasswordForm />
    </div>
  );
}
