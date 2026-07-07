import React from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { LayoutDashboard, ShieldCheck, FileText, CreditCard, LogOut, ShieldHalf } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/policies',  icon: ShieldCheck,     label: 'My Policies' },
  { to: '/claims',    icon: FileText,         label: 'Claims' },
  { to: '/billing',   icon: CreditCard,       label: 'Billing' },
];

export default function AppShell() {
  const { customer, logout } = useAuth();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-mark">
            <ShieldHalf size={28} color="#c8962c" />
            <div>
              <div>NorthWind<span className="accent"> Insurance</span></div>
              <div style={{ fontSize: '11px', fontWeight: 400, opacity: 0.6, marginTop: 1 }}>Policy Hub</div>
            </div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            >
              <Icon className="nav-icon" size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          {customer && (
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, marginBottom: 12 }}>
              <div style={{ fontWeight: 600, color: 'white' }}>{customer.firstName} {customer.lastName}</div>
              <div style={{ fontSize: 12, marginTop: 2 }}>{customer.email}</div>
            </div>
          )}
          <button className="nav-item" style={{ width: '100%', background: 'none', border: 'none' }} onClick={logout}>
            <LogOut size={18} />
            Sign Out
          </button>
        </div>
      </aside>

      <div className="main-content">
        <header className="topbar">
          <div style={{ fontSize: 14, color: 'var(--nw-text-muted)' }}>
            Welcome back, <strong style={{ color: 'var(--nw-navy)' }}>{customer?.firstName}</strong>
          </div>
          <div style={{ fontSize: 12, color: 'var(--nw-text-muted)' }}>
            Ontario, Canada &nbsp;·&nbsp; Powered by NorthWind Insurance
          </div>
        </header>
        <main className="page-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
