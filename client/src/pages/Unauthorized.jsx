import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { ShieldAlert } from 'lucide-react';
import { Button } from '../components/ui/Button';

export const Unauthorized = () => {
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);

  const handleBack = () => {
    if (!user) {
      navigate('/login');
    } else if (user.role === 'ADMIN' || user.role === 'AUDITOR') {
      navigate('/admin/dashboard');
    } else if (user.role === 'MERCHANT') {
      navigate('/merchant/dashboard');
    } else {
      navigate('/customer/dashboard');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', textAlign: 'center', padding: '2rem' }}>
      <div style={{ padding: '1rem', borderRadius: '50%', backgroundColor: 'var(--color-danger-bg)', color: 'var(--color-danger)', marginBottom: '1.5rem' }}>
        <ShieldAlert size={48} />
      </div>
      <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '0.75rem' }}>
        Access Restricted
      </h1>
      <p style={{ color: 'var(--color-text-secondary)', maxWidth: '420px', marginBottom: '2rem', fontSize: '0.95rem' }}>
        You do not have the permissions required to view this dashboard page. Please contact your operations administrator if you believe this is an error.
      </p>
      <Button variant="secondary" onClick={handleBack}>
        Return to Dashboard
      </Button>
    </div>
  );
};

export default Unauthorized;
