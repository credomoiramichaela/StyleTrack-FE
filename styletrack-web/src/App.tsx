import { Navigate, NavLink, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './auth';
import type { Role } from './api';
import { Icon, Loading } from './ui';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import AppointmentsPage from './pages/AppointmentsPage';
import CustomersPage from './pages/CustomersPage';
import CustomerDetailPage from './pages/CustomerDetailPage';
import StylistsPage from './pages/StylistsPage';
import StylistDetailPage from './pages/StylistDetailPage';
import ServicesPage from './pages/ServicesPage';
import ReportsPage from './pages/ReportsPage';
import UsersPage from './pages/UsersPage';
import PaymentsPage from './pages/PaymentsPage';
import RewardsPage from './pages/RewardsPage';
import LogReportsPage from './pages/LogReportsPage';

interface NavItem { to: string; label: string; roles: Role[]; icon: string }

const NAV: NavItem[] = [
  { to: '/', label: 'Today', roles: ['SUPER_ADMIN', 'ADMIN'], icon: 'today' },
  { to: '/appointments', label: 'Appointments', roles: ['SUPER_ADMIN', 'ADMIN', 'STYLIST'], icon: 'calendar' },
  { to: '/customers', label: 'Customers', roles: ['SUPER_ADMIN', 'ADMIN', 'STYLIST'], icon: 'people' },
  { to: '/stylists', label: 'Stylists', roles: ['SUPER_ADMIN', 'ADMIN', 'STYLIST'], icon: 'scissors' },
  { to: '/services', label: 'Services', roles: ['SUPER_ADMIN', 'ADMIN', 'STYLIST'], icon: 'sparkle' },
  { to: '/payments', label: 'Payments', roles: ['SUPER_ADMIN', 'ADMIN'], icon: 'wallet' },
  { to: '/rewards', label: 'Rewards', roles: ['SUPER_ADMIN'], icon: 'gift' },
  { to: '/reports', label: 'Reports', roles: ['SUPER_ADMIN', 'ADMIN'], icon: 'chart' },
  { to: '/users', label: 'Team logins', roles: ['SUPER_ADMIN'], icon: 'key' },
  { to: '/log-reports', label: 'Log reports', roles: ['SUPER_ADMIN'], icon: 'log' },
];

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');

const ROLE_LABEL: Record<Role, string> = { SUPER_ADMIN: 'Super Admin', ADMIN: 'Admin', STYLIST: 'Staff' };

/** Stylists land on their own bookings; Super Admin/Admin land on the Admin Dashboard. */
const homeRouteFor = (role?: Role) => (role === 'STYLIST' ? '/appointments' : '/');

function Shell() {
  const { user, logout } = useAuth();
  if (!user) return null;
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-name">Jonathan Hair Studio</span>
          <span className="brand-sub">Salon Management System</span>
        </div>
        <nav aria-label="Main">
          <span className="nav-label">Salon</span>
          {NAV.filter((n) => n.roles.includes(user.role)).map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => (isActive ? 'active' : '')}>
              <Icon name={n.icon} />
              {user.role === 'STYLIST' && n.to === '/appointments' ? 'My bookings' : n.label}
            </NavLink>
          ))}
        </nav>
        <p className="side-quote">More Than Beauty, A Better You.<small>Beautiful services. Happier people.</small></p>
        <div className="who">
          <span className="avatar" aria-hidden="true">{initials(user.fullName)}</span>
          <strong>{user.fullName}</strong>
          <span>{ROLE_LABEL[user.role]}</span>
          <button className="btn btn-ghost-light" onClick={logout}>Sign out</button>
        </div>
      </aside>
      <main className="main" id="main">
        <Outlet />
      </main>
    </div>
  );
}

function Protected({ roles }: { roles?: Role[] }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Loading label="Signing you in" />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (roles && !roles.includes(user.role)) return <Navigate to={homeRouteFor(user.role)} replace />;
  return <Shell />;
}

export default function App() {
  const { user, loading } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={!loading && user ? <Navigate to={homeRouteFor(user.role)} replace /> : <LoginPage />} />
      <Route element={<Protected roles={['SUPER_ADMIN', 'ADMIN']} />}>
        <Route index element={<DashboardPage />} />
      </Route>
      <Route element={<Protected />}>
        <Route path="appointments" element={<AppointmentsPage />} />
        <Route path="customers" element={<CustomersPage />} />
        <Route path="customers/:id" element={<CustomerDetailPage />} />
        <Route path="stylists" element={<StylistsPage />} />
        <Route path="stylists/:id" element={<StylistDetailPage />} />
        <Route path="services" element={<ServicesPage />} />
      </Route>
      <Route element={<Protected roles={['SUPER_ADMIN', 'ADMIN']} />}>
        <Route path="payments" element={<PaymentsPage />} />
        <Route path="reports" element={<ReportsPage />} />
      </Route>
      <Route element={<Protected roles={['SUPER_ADMIN']} />}>
        <Route path="rewards" element={<RewardsPage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="log-reports" element={<LogReportsPage />} />
      </Route>
      <Route path="*" element={<Navigate to={homeRouteFor(user?.role)} replace />} />
    </Routes>
  );
}
