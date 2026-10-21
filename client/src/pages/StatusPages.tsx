import { Link } from 'react-router-dom';
import { Card, EmptyState } from '../components/ui';

export function ForbiddenPage() {
  return (
    <Card>
      <EmptyState title="Acceso denegado" description="No tiene permisos para ver esta sección." />
      <div className="auth-card__links">
        <Link to="/">Volver al inicio</Link>
      </div>
    </Card>
  );
}

export function NotFoundPage() {
  return (
    <Card>
      <EmptyState title="Página no encontrada" description="La dirección no existe." />
      <div className="auth-card__links">
        <Link to="/">Volver al inicio</Link>
      </div>
    </Card>
  );
}
