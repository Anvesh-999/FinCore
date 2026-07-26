import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { LayoutDashboard, CreditCard, RotateCcw, Key, Webhook, LogOut, Menu, X } from 'lucide-react';
import { logoutSuccess } from '../store/authSlice';
import api from '../services/api';
import './layouts.css';

export const MerchantLayout = () => {
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
    { name: 'Overview', path: '/merchant/dashboard', icon: <LayoutDashboard size={18} /> },
    { name: 'Payments', path: '/merchant/payments', icon: <CreditCard size={18} /> },
    { name: 'Refunds', path: '/merchant/refunds', icon: <RotateCcw size={18} /> },
    { name: 'API Keys', path: '/merchant/api-keys', icon: <Key size={18} /> },
    { name: 'Webhooks', path: '/merchant/webhooks', icon: <Webhook size={18} /> },
  ];

  return (
    <div className="dashboard-container">
      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '2rem', height: '2rem', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--color-secondary)', color: 'white', fontWeight: 800 }}>FC</span>
            <span>FinCore</span>
          </div>
          <span className="sidebar-role-badge" style={{ backgroundColor: 'var(--color-secondary)' }}>Merchant</span>
          <button className="menu-toggle" style={{ color: 'white' }} onClick={() => setSidebarOpen(false)}>
            <X size={20} />
          </button>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <NavLink
              key={item.name}
              to={item.path}
              className={({ isActive }) => `nav-item ${isActive ? 'nav-item-active' : ''}`}
              style={({ isActive }) => isActive ? { backgroundColor: 'var(--color-secondary)' } : {}}
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
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Merchant Portal</h2>
          </div>
          <div className="navbar-right">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--color-text-secondary)' }}>Sandbox Mode</span>
              <div style={{ width: '2rem', height: '2rem', borderRadius: '50%', backgroundColor: 'var(--color-secondary-hover)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: '0.875rem' }}>
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

export default MerchantLayout;
