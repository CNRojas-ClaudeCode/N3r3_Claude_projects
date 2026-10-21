export type ApiIssue = { path: string; message: string };

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
    public readonly issues: ApiIssue[] = [],
  ) {
    super(message);
  }

  /** Errores de validación indexados por campo. */
  fieldErrors(): Record<string, string> {
    return Object.fromEntries(this.issues.map((i) => [i.path, i.message]));
  }
}

type Listener = (error: ApiError) => void;
const listeners = new Set<Listener>();

/** Permite a AuthContext reaccionar ante sesión expirada (401) o cambio de contraseña obligatorio. */
export const onApiError = (listener: Listener) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

type Options = { method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'; body?: unknown; signal?: AbortSignal };

/**
 * Cliente HTTP único. La sesión viaja en cookie httpOnly (credentials same-origin);
 * no se almacena ningún token en el navegador.
 */
export async function api<T>(path: string, { method = 'GET', body, signal }: Options = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    throw new ApiError(0, 'No hay conexión con el servidor', 'NETWORK_ERROR');
  }

  if (response.status === 204) return undefined as T;
  const data: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const payload = (data ?? {}) as { message?: string; code?: string; issues?: ApiIssue[] };
    const error = new ApiError(
      response.status,
      payload.message ?? 'Ocurrió un error inesperado',
      payload.code,
      payload.issues ?? [],
    );
    listeners.forEach((l) => l(error));
    throw error;
  }
  return data as T;
}

export const errorMessage = (err: unknown) =>
  err instanceof ApiError ? err.message : 'Ocurrió un error inesperado';

export const toQuery = (params: Record<string, string | number | boolean | undefined>) => {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') search.set(k, String(v));
  const s = search.toString();
  return s ? `?${s}` : '';
};
