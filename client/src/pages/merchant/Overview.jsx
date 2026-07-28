import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { TrendingUp, RotateCcw, Activity, ShieldCheck, Key, ArrowRight } from 'lucide-react';
import api from '../../services/api';
import { Spinner } from '../../components/ui/Spinner';
import { Badge } from '../../components/ui/Badge';
import { useToast } from '../../components/ui/Toast';
import { Link } from 'react-router-dom';

export const Overview = () => {
  const { user } = useSelector((state) => state.auth);
  const { showToast } = useToast();
  const [stats, setStats] = useState(null);
  const [recentPayments, setRecentPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [statsRes, paymentsRes] = await Promise.all([
          api.get('/payments/merchant/stats'),
          api.get('/payments/merchant/list')
        ]);
        setStats(statsRes.data.data);
        // Show only the 5 most recent payments
        setRecentPayments(paymentsRes.data.data.slice(0, 5));
      } catch (err) {
        showToast('error', err.response?.data?.error?.message || 'Failed to load merchant overview');
      } finally {
        setLoading(false);
      }
    };
    fetchDashboardData();
  }, [showToast]);

  const formatCentsToUSD = (centsStr) => {
    const cents = parseInt(centsStr, 10);
    if (isNaN(cents)) return '$0.00';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px' }}>
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Welcome Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
            Merchant Workspace
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
            Testing checkout integrations in sandbox environment.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <Link to="/merchant/api-keys" className="btn btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-primary-light)', color: 'white', fontWeight: 500 }}>
            <Key size={16} /> API Keys
          </Link>
        </div>
      </div>

      {/* Analytics Cards Grid */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', 
        gap: '1.5rem' 
      }}>
        {/* Sales Volume */}
        <div style={{
          backgroundColor: 'var(--color-surface)',
          padding: '1.5rem',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-border)',
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--color-text-secondary)' }}>
            <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>Gross Volume</span>
            <TrendingUp size={20} style={{ color: 'var(--color-accent)' }} />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
            {formatCentsToUSD(stats?.totalVolume)}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
            Sandbox captured volume
          </div>
        </div>

        {/* Refunded Volume */}
        <div style={{
          backgroundColor: 'var(--color-surface)',
          padding: '1.5rem',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-border)',
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--color-text-secondary)' }}>
            <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>Refunded Volume</span>
            <RotateCcw size={20} style={{ color: 'var(--color-warning)' }} />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
            {formatCentsToUSD(stats?.refundVolume)}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
            Total value returned
          </div>
        </div>

        {/* Success Rate */}
        <div style={{
          backgroundColor: 'var(--color-surface)',
          padding: '1.5rem',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-border)',
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--color-text-secondary)' }}>
            <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>Success Rate</span>
            <Activity size={20} style={{ color: 'var(--color-info)' }} />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
            {stats?.successRate}%
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
            {stats?.successCount} of {stats?.totalCount} orders succeeded
          </div>
        </div>

        {/* Status Check */}
        <div style={{
          backgroundColor: 'var(--color-surface)',
          padding: '1.5rem',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-border)',
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--color-text-secondary)' }}>
            <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>Sandbox Status</span>
            <ShieldCheck size={20} style={{ color: 'var(--color-accent)' }} />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--color-success)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            Active
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
            API endpoints operational
          </div>
        </div>
      </div>

      {/* Recent Activity Table */}
      <div style={{
        backgroundColor: 'var(--color-surface)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--color-border)',
        boxShadow: 'var(--shadow-sm)',
        overflow: 'hidden'
      }}>
        <div style={{ 
          padding: '1.25rem 1.5rem', 
          borderBottom: '1px solid var(--color-border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>
            Recent Payment Orders
          </h2>
          <Link to="/merchant/payments" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.875rem', fontWeight: 500, color: 'var(--color-secondary)' }}>
            View all <ArrowRight size={14} />
          </Link>
        </div>

        {recentPayments.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
            No payment orders captured yet. Initiate checks using your API Key.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>
                  <th style={{ padding: '0.75rem 1.5rem', fontWeight: 500, color: 'var(--color-text-secondary)' }}>Payment ID</th>
                  <th style={{ padding: '0.75rem 1.5rem', fontWeight: 500, color: 'var(--color-text-secondary)' }}>Reference</th>
                  <th style={{ padding: '0.75rem 1.5rem', fontWeight: 500, color: 'var(--color-text-secondary)' }}>Date</th>
                  <th style={{ padding: '0.75rem 1.5rem', fontWeight: 500, color: 'var(--color-text-secondary)' }}>Amount</th>
                  <th style={{ padding: '0.75rem 1.5rem', fontWeight: 500, color: 'var(--color-text-secondary)' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentPayments.map((p) => (
                  <tr key={p.id} style={{ borderBottom: '1px solid var(--color-border)', transition: 'var(--transition-fast)' }} className="table-row">
                    <td style={{ padding: '1rem 1.5rem', fontFamily: 'monospace', fontWeight: 500 }}>{p.id}</td>
                    <td style={{ padding: '1rem 1.5rem', color: 'var(--color-text-primary)', fontWeight: 500 }}>{p.reference || '—'}</td>
                    <td style={{ padding: '1rem 1.5rem', color: 'var(--color-text-secondary)' }}>{formatDate(p.createdAt)}</td>
                    <td style={{ padding: '1rem 1.5rem', color: 'var(--color-text-primary)', fontWeight: 600 }}>{formatCentsToUSD(p.amount)}</td>
                    <td style={{ padding: '1rem 1.5rem' }}>
                      <Badge 
                        variant={
                          p.status === 'SUCCEEDED' ? 'success' :
                          p.status === 'CREATED' ? 'info' :
                          p.status === 'PARTIALLY_REFUNDED' ? 'warning' :
                          p.status === 'REFUNDED' ? 'danger' : 'secondary'
                        }
                      >
                        {p.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
