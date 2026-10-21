import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { PublicOnly, RequireAuth, RequirePermission } from './auth/guards';
import { AppLayout } from './components/AppLayout';
import { ToastProvider } from './components/ui';
import { AuditPage, RolesPage } from './pages/AdminPages';
import { ForgotPasswordPage, LoginPage, ResetPasswordPage } from './pages/AuthPages';
import { DashboardPage } from './pages/DashboardPage';
import { ProductsPage } from './pages/ProductsPage';
import { ClientsPage } from './pages/ClientsPage';
import { InvoicesPage } from './pages/InvoicesPage';
import { PortfolioPage } from './pages/PortfolioPage';
import { TrainingPage } from './pages/TrainingPage';
import { ProfilePage } from './pages/ProfilePage';
import { NotFoundPage } from './pages/StatusPages';
import { UsersPage } from './pages/UsersPage';

export function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<PublicOnly><LoginPage /></PublicOnly>} />
            <Route path="/recuperar" element={<PublicOnly><ForgotPasswordPage /></PublicOnly>} />
            <Route path="/restablecer" element={<ResetPasswordPage />} />
            <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
              <Route index element={<RequirePermission permission="dashboard.view"><DashboardPage /></RequirePermission>} />
              <Route path="productos" element={<RequirePermission permission="products.view"><ProductsPage /></RequirePermission>} />
              <Route path="clientes" element={<RequirePermission permission="clients.view"><ClientsPage /></RequirePermission>} />
              <Route path="facturas" element={<RequirePermission permission="invoices.view"><InvoicesPage /></RequirePermission>} />
              <Route path="cartera" element={<RequirePermission permission="portfolio.view"><PortfolioPage /></RequirePermission>} />
              <Route path="capacitacion" element={<RequirePermission permission="training.view"><TrainingPage /></RequirePermission>} />
              <Route path="usuarios"element={<RequirePermission permission="users.manage"><UsersPage /></RequirePermission>} />
              <Route path="roles" element={<RequirePermission permission="roles.view"><RolesPage /></RequirePermission>} />
              <Route path="bitacora" element={<RequirePermission permission="audit.view"><AuditPage /></RequirePermission>} />
              <Route path="perfil" element={<RequirePermission permission="profile.self"><ProfilePage /></RequirePermission>} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
