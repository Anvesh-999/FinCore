import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useToast } from '../components/ui/Toast';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import api from '../services/api';

export const Register = () => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    role: 'CUSTOMER',
  });
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const { showToast } = useToast();

  const handleChange = (e) => {
    const { id, value } = e.target;
    setFormData((prev) => ({ ...prev, [id]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { firstName, lastName, email, password, role } = formData;
    
    if (!firstName || !lastName || !email || !password || !role) {
      showToast('error', 'All fields are required');
      return;
    }

    setLoading(true);

    try {
      await api.post('/auth/register', formData);
      showToast('success', 'Registration successful! Please login.');
      navigate('/login');
    } catch (err) {
      const message = err.response?.data?.error?.message || 'Registration failed.';
      showToast('error', message);
    } finally {
      setLoading(false);
    }
  };

  const roleOptions = [
    { value: 'CUSTOMER', label: 'Customer (Wallet & Personal Transfers)' },
    { value: 'MERCHANT', label: 'Merchant (Business Dashboard & APIs)' },
    { value: 'ADMIN', label: 'Operations Admin (Full Dashboard & Controls)' },
    { value: 'AUDITOR', label: 'Auditor (Read-Only Compliance View)' },
  ];

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
      <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '1.5rem', textAlign: 'center' }}>
        Create sandbox account
      </h2>

      <div style={{ display: 'flex', gap: '1rem' }}>
        <Input
          label="First Name"
          id="firstName"
          placeholder="John"
          value={formData.firstName}
          onChange={handleChange}
          required
        />
        <Input
          label="Last Name"
          id="lastName"
          placeholder="Doe"
          value={formData.lastName}
          onChange={handleChange}
          required
        />
      </div>

      <Input
        label="Email Address"
        id="email"
        type="email"
        placeholder="john.doe@company.com"
        value={formData.email}
        onChange={handleChange}
        required
      />

      <Input
        label="Password"
        id="password"
        type="password"
        placeholder="Min 6 characters"
        value={formData.password}
        onChange={handleChange}
        required
      />

      <Select
        label="Account Role"
        id="role"
        options={roleOptions}
        value={formData.role}
        onChange={handleChange}
        required
      />

      <Button
        type="submit"
        variant="primary"
        fullWidth
        loading={loading}
        style={{ marginTop: '1rem' }}
      >
        Create Account
      </Button>

      <div style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
        Already have an account?{' '}
        <Link to="/login" style={{ fontWeight: 600, color: 'var(--color-accent)' }}>
          Sign In
        </Link>
      </div>
    </form>
  );
};

export default Register;
