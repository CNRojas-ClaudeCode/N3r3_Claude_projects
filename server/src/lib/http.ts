export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
  ) {
    super(message);
  }
}

export const notFound = (message = 'Recurso no encontrado') => new HttpError(404, message, 'NOT_FOUND');
export const forbidden = () => new HttpError(403, 'No tiene permisos para realizar esta acción', 'FORBIDDEN');
export const unauthorized = () => new HttpError(401, 'No autenticado', 'UNAUTHENTICATED');
export const badRequest = (message: string, code = 'BAD_REQUEST') => new HttpError(400, message, code);
export const conflict = (message: string) => new HttpError(409, message, 'CONFLICT');
