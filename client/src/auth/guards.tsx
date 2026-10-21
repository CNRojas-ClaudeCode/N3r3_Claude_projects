import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { Loading } from '../components/ui';
import { ForbiddenPage } from '../pages/StatusPages';
import type { Permission } from '../lib/types';

const PROFILE_PATH = '/perfil';

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Loading fullscreen />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  // Contraseña temporal: solo puede usar su perfil hasta cambiarla
  if (user.mustChangePassword && location.pathname !== PROFILE_PATH) return <Navigate to={PROFILE_PATH} replace />;
  return <>{children}</>;
}

export function RequirePermission({ permission, children }: { permission: Permission; children: ReactNode }) {
  const { can } = useAuth();
  return can(permission) ? <>{children}</> : <ForbiddenPage />;
}

export function PublicOnly({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <Loading fullscreen />;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}
