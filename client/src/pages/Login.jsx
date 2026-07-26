import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { authStart, authSuccess, authFailure } from '../store/authSlice';
import { useToast } from '../components/ui/Toast';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import api from '../services/api';

export const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      showToast('error', 'Please fill in all fields');
      return;
    }

    setLoading(true);
    dispatch(authStart());

    try {
      const response = await api.post('/auth/login', { email, password });
      const { user, accessToken } = response.data.data;
      
      dispatch(authSuccess({ user, accessToken }));
      showToast('success', `Logged in successfully as ${user.role}!`);
      
      // Redirect based on role
      if (user.role === 'ADMIN' || user.role === 'AUDITOR') {
        navigate('/admin/dashboard');
      } else if (user.role === 'MERCHANT') {
        navigate('/merchant/dashboard');
      } else {
        navigate('/customer/dashboard');
      }
    } catch (err) {
      const message = err.response?.data?.error?.message || 'Login failed. Please try again.';
      dispatch(authFailure(message));
      showToast('error', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '1.5rem', textAlign: 'center' }}>
        Access your account
      </h2>
      
      <Input
        label="Email Address"
        id="email"
        type="email"
        placeholder="name@company.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />

      <Input
        label="Password"
        id="password"
        type="password"
        placeholder="••••••••"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />

      <Button
        type="submit"
        variant="primary"
        fullWidth
        loading={loading}
        style={{ marginTop: '1rem' }}
      >
        Sign In
      </Button>

      <div style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
        Don't have an account?{' '}
        <Link to="/register" style={{ fontWeight: 600, color: 'var(--color-accent)' }}>
          Create an account
        </Link>
      </div>
    </form>
  );
};

export default Login;
