import React from 'react';
import { Outlet } from 'react-router-dom';
import './layouts.css';

export const PublicLayout = () => {
  return (
    <div className="public-layout-container">
      <div className="public-card">
        <div className="public-header">
          <div className="logo-container">
            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '2.5rem', height: '2.5rem', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-accent)', color: 'white', fontWeight: 800, fontSize: '1.25rem' }}>FC</span>
            <span>Fin<span className="logo-accent">Core</span></span>
          </div>
          <div className="public-subtitle">Digital Wallet & Payment Infrastructure</div>
        </div>
        <Outlet />
      </div>
    </div>
  );
};

export default PublicLayout;
