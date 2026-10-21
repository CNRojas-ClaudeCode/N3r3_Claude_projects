import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import type { Permission } from '../lib/types';
import { ROLE_LABELS, initials } from '../lib/format';
import { Icon, type IconName } from './Icon';
import { Button } from './ui';

type NavItem = { to: string; label: string; icon: IconName; permission: Permission; section: string };

const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: 'dashboard', permission: 'dashboard.view', section: 'General' },
  { to: '/productos', label: 'Productos y servicios', icon: 'box', permission: 'products.view', section: 'Negocio' },
  { to: '/clientes', label: 'Clientes', icon: 'contact', permission: 'clients.view', section: 'Negocio' },
  { to: '/facturas', label: 'Facturación', icon: 'invoice', permission: 'invoices.view', section: 'Negocio' },
  { to: '/cartera', label: 'Cartera', icon: 'wallet', permission: 'portfolio.view', section: 'Negocio' },
  { to: '/capacitacion', label: 'Capacitación', icon: 'book', permission: 'training.view', section: 'Negocio' },
  { to: '/usuarios', label: 'Usuarios', icon: 'users', permission: 'users.manage', section: 'Administración' },
  { to: '/roles', label: 'Roles', icon: 'shield', permission: 'roles.view', section: 'Administración' },
  { to: '/bitacora', label: 'Bitácora', icon: 'list', permission: 'audit.view', section: 'Administración' },
  { to: '/perfil', label: 'Mi perfil', icon: 'user', permission: 'profile.self', section: 'Cuenta' },
];

const titleFor = (pathname: string) =>
  NAV_ITEMS.find((i) => (i.to === '/' ? pathname === '/' : pathname.startsWith(i.to)))?.label ?? 'SPA Nereyda';

export function AppLayout() {
  const { user, can, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => setMenuOpen(false), [location.pathname]);

  const items = NAV_ITEMS.filter((i) => can(i.permission) && (!user?.mustChangePassword || i.to === '/perfil'));
  const sections = [...new Set(items.map((i) => i.section))];

  return (
    <div className="app-shell">
      <aside id="sidebar" className={`sidebar ${menuOpen ? 'sidebar--open' : ''}`} aria-label="Menú principal">
        <div className="sidebar__brand">
          <img className="sidebar__logo" src="/icons/icon-192.png" alt="" />
          <div>
            <strong>SPA Nereyda</strong>
            <div className="text-small text-secondary">Miscelánea</div>
          </div>
        </div>
        <nav className="sidebar__nav">
          {sections.map((section) => (
            <div key={section} className="sidebar__nav">
              <div className="sidebar__section">{section}</div>
              {items
                .filter((i) => i.section === section)
                .map((i) => (
                  <NavLink
                    key={i.to}
                    to={i.to}
                    end={i.to === '/'}
                    className={({ isActive }) => `sidebar__link ${isActive ? 'sidebar__link--active' : ''}`}
                  >
                    <Icon name={i.icon} />
                    {i.label}
                  </NavLink>
                ))}
            </div>
          ))}
        </nav>
        <div className="sidebar__footer">
          <Button variant="ghost" icon="logout" block onClick={() => void logout()}>
            Cerrar sesión
          </Button>
        </div>
      </aside>
      {menuOpen && (
        <button className="sidebar-overlay" aria-label="Cerrar menú" onClick={() => setMenuOpen(false)} />
      )}

      <div className="app-content">
        <header className="app-header">
          <Button
            variant="ghost"
            icon="menu"
            iconOnly
            className="menu-button"
            aria-expanded={menuOpen}
            aria-controls="sidebar"
            onClick={() => setMenuOpen(true)}
          >
            Abrir menú
          </Button>
          <span className="app-header__title truncate">{titleFor(location.pathname)}</span>
          {user && (
            <div className="app-header__user">
              <div className="app-header__user-text">
                <strong className="truncate">{user.name}</strong>
                <span className="text-small text-secondary">{ROLE_LABELS[user.role]}</span>
              </div>
              <span className="avatar" aria-hidden="true">
                {initials(user.name)}
              </span>
            </div>
          )}
        </header>
        <main className="app-main" id="contenido">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
