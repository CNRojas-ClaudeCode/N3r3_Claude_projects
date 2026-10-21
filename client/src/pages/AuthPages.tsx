import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Alert, Button, Card, TextInput } from '../components/ui';
import { api, errorMessage, ApiError } from '../lib/api';
import { PASSWORD_MIN_LENGTH } from '../config';

function AuthLayout({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <main className="auth-layout">
      <div className="auth-card">
        <div className="auth-card__brand">
          <img className="auth-card__logo" src="/icons/icon-192.png" alt="" />
          <h1>{title}</h1>
          <p className="text-secondary">{subtitle}</p>
        </div>
        <Card>{children}</Card>
      </div>
    </main>
  );
}

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const notice = (location.state as { notice?: string } | null)?.notice;
  const from = (location.state as { from?: string } | null)?.from ?? '/';

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout title="SPA Nereyda" subtitle="Ingrese con su cuenta para continuar">
      <form className="form" onSubmit={onSubmit} noValidate>
        {notice && <Alert tone="success">{notice}</Alert>}
        {error && <Alert tone="error">{error}</Alert>}
        <TextInput
          label="Email"
          type="email"
          autoComplete="username"
          inputMode="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <TextInput
          label="Contraseña"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Button type="submit" block loading={submitting}>
          Ingresar
        </Button>
        <div className="auth-card__links">
          <Link to="/recuperar">¿Olvidó su contraseña?</Link>
        </div>
      </form>
    </AuthLayout>
  );
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await api<{ message: string }>('/auth/forgot-password', { method: 'POST', body: { email } });
      setMessage(res.message);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout title="Recuperar contraseña" subtitle="Le enviaremos un enlace de un solo uso">
      <form className="form" onSubmit={onSubmit} noValidate>
        {message && <Alert tone="success">{message}</Alert>}
        {error && <Alert tone="error">{error}</Alert>}
        <TextInput
          label="Email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Button type="submit" block loading={submitting}>
          Enviar enlace
        </Button>
        <div className="auth-card__links">
          <Link to="/login">Volver a iniciar sesión</Link>
        </div>
      </form>
    </AuthLayout>
  );
}

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setErrors({});
    if (password !== confirm) {
      setErrors({ confirm: 'Las contraseñas no coinciden' });
      return;
    }
    setSubmitting(true);
    try {
      const res = await api<{ message: string }>('/auth/reset-password', { method: 'POST', body: { token, password } });
      navigate('/login', { replace: true, state: { notice: res.message } });
    } catch (err) {
      if (err instanceof ApiError && err.issues.length) setErrors(err.fieldErrors());
      else setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout title="Nueva contraseña" subtitle={`Mínimo ${PASSWORD_MIN_LENGTH} caracteres`}>
      {!token ? (
        <div className="form">
          <Alert tone="error">El enlace de recuperación no es válido.</Alert>
          <Link to="/recuperar">Solicitar un nuevo enlace</Link>
        </div>
      ) : (
        <form className="form" onSubmit={onSubmit} noValidate>
          {error && <Alert tone="error">{error}</Alert>}
          <TextInput
            label="Nueva contraseña"
            type="password"
            autoComplete="new-password"
            minLength={PASSWORD_MIN_LENGTH}
            required
            value={password}
            error={errors.password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <TextInput
            label="Confirmar contraseña"
            type="password"
            autoComplete="new-password"
            required
            value={confirm}
            error={errors.confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
          <Button type="submit" block loading={submitting}>
            Guardar contraseña
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
