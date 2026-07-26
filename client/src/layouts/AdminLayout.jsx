import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import {
  LayoutDashboard,
  Users,
  Store,
  Wallet,
  CreditCard,
  ArrowLeftRight,
  BookOpen,
  ShieldAlert,
  Webhook,
  CheckSquare,
  FileText,
  Activity,
  LogOut,
  Menu,
  X
} from 'lucide-react';
import { logoutSuccess } from '../store/authSlice';
import api from '../services/api';
import './layouts.css';

export const AdminLayout = () => {
  const { user } = useSelector((state) => state.auth);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      dispatch(logoutSuccess());
      navigate('/login');
    }
  };

  const navItems = [
    { name: 'Overview', path: '/admin/dashboard', icon: <LayoutDashboard size={16} /> },
    { name: 'Customers', path: '/admin/customers', icon: <Users size={16} /> },
    { name: 'Merchants', path: '/admin/merchants', icon: <Store size={16} /> },
    { name: 'Wallets', path: '/admin/wallets', icon: <Wallet size={16} /> },
    { name: 'Payments', path: '/admin/payments', icon: <CreditCard size={16} /> },
    { name: 'Transfers', path: '/admin/transfers', icon: <ArrowLeftRight size={16} /> },
    { name: 'Ledger Explorer', path: '/admin/ledger', icon: <BookOpen size={16} /> },
    { name: 'Risk Controls', path: '/admin/risk', icon: <ShieldAlert size={16} /> },
    { name: 'Webhook Logs', path: '/admin/webhooks', icon: <Webhook size={16} /> },
    { name: 'Reconciliation', path: '/admin/reconciliation', icon: <CheckSquare size={16} /> },
    { name: 'Audit Logs', path: '/admin/audit', icon: <FileText size={16} /> },
    { name: 'System Health', path: '/admin/health', icon: <Activity size={16} /> },
  ];

  return (
    <div className="dashboard-container">
      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`} style={{ width: '280px' }}>
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '2rem', height: '2rem', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--color-danger)', color: 'white', fontWeight: 800 }}>FC</span>
            <span>FinCore</span>
          </div>
          <span className="sidebar-role-badge" style={{ backgroundColor: 'var(--color-danger)' }}>Admin</span>
          <button className="menu-toggle" style={{ color: 'white' }} onClick={() => setSidebarOpen(false)}>
            <X size={20} />
          </button>
        </div>

        <nav className="sidebar-nav" style={{ padding: '1rem 0.75rem' }}>
          {navItems.map((item) => (
            <NavLink
              key={item.name}
              to={item.path}
              className={({ isActive }) => `nav-item ${isActive ? 'nav-item-active' : ''}`}
              style={({ isActive }) => isActive ? { backgroundColor: 'var(--color-danger)' } : {}}
              onClick={() => setSidebarOpen(false)}
            >
              {item.icon}
              {item.name}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-info">
            <span className="user-name">{user?.firstName} {user?.lastName}</span>
            <span className="user-email">{user?.email}</span>
          </div>
          <button
            onClick={handleLogout}
            className="btn btn-secondary btn-block"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', border: '1px solid rgba(255, 255, 255, 0.1)' }}
          >
            <LogOut size={16} />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="main-content">
        <header className="top-navbar">
          <button className="menu-toggle" onClick={() => setSidebarOpen(true)}>
            <Menu size={24} />
          </button>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Operations Control Console</h2>
          </div>
          <div className="navbar-right">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ width: '2rem', height: '2rem', borderRadius: '50%', backgroundColor: 'var(--color-danger)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: '0.875rem' }}>
                {user?.firstName?.[0]}
              </div>
            </div>
          </div>
        </header>

        <main className="page-container">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
