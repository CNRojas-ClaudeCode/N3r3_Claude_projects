import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, onApiError } from '../lib/api';
import { clearDataCache } from '../lib/serviceWorker';
import type { Permission, SessionUser, User } from '../lib/types';

type AuthState = {
  user: User | null;
  permissions: Permission[];
  loading: boolean;
  can: (permission: Permission) => boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setSession: (session: SessionUser) => void;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSessionState] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  const clear = useCallback(() => {
    setSessionState(null);
    clearDataCache();
  }, []);

  useEffect(() => {
    api<SessionUser>('/auth/me')
      .then(setSessionState)
      .catch(() => setSessionState(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(
    () =>
      onApiError((error) => {
        if (error.status === 401 && error.code === 'UNAUTHENTICATED') clear();
        if (error.code === 'PASSWORD_CHANGE_REQUIRED') {
          setSessionState((s) => (s ? { ...s, user: { ...s.user, mustChangePassword: true } } : s));
        }
      }),
    [clear],
  );

  const login = useCallback(async (email: string, password: string) => {
    const result = await api<SessionUser>('/auth/login', { method: 'POST', body: { email, password } });
    setSessionState(result);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api<void>('/auth/logout', { method: 'POST', body: {} });
    } finally {
      clear();
    }
  }, [clear]);

  const value = useMemo<AuthState>(() => {
    const permissions = session?.permissions ?? [];
    return {
      user: session?.user ?? null,
      permissions,
      loading,
      can: (p) => permissions.includes(p),
      login,
      logout,
      setSession: setSessionState,
    };
  }, [session, loading, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
};
