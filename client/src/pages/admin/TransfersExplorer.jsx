import React, { useEffect, useState } from 'react';
import { ArrowRight, Calendar, RefreshCw } from 'lucide-react';
import api from '../../services/api';
import { Spinner } from '../../components/ui/Spinner';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../components/ui/Toast';

export const TransfersExplorer = () => {
  const { showToast } = useToast();
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchTransfers = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/transfers');
      setTransfers(res.data.data);
    } catch (err) {
      showToast('error', err.response?.data?.error?.message || 'Failed to retrieve system transfers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransfers();
  }, []);

  const formatCentsToUSD = (centsStr) => {
    const cents = parseInt(centsStr, 10);
    if (isNaN(cents)) return '$0.00';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  };

  if (loading && transfers.length === 0) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px' }}>
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{
        backgroundColor: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        padding: '2rem',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>System Transfers Explorer</h2>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
              Observe and inspect all simulated peer-to-peer transfer transactions.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchTransfers} disabled={loading}>
            <RefreshCw size={14} style={{ marginRight: '0.5rem' }} /> Refresh
          </Button>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem 0' }}>
            <Spinner size="md" />
          </div>
        ) : transfers.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--color-text-secondary)' }}>
            No peer transfer records found.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
                  <th style={{ padding: '1rem', color: 'var(--color-text-secondary)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>Transfer ID</th>
                  <th style={{ padding: '1rem', color: 'var(--color-text-secondary)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>Sender User</th>
                  <th style={{ padding: '1rem', color: 'var(--color-text-secondary)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', textAlign: 'center' }}>Direction</th>
                  <th style={{ padding: '1rem', color: 'var(--color-text-secondary)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>Recipient User</th>
                  <th style={{ padding: '1rem', color: 'var(--color-text-secondary)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>Status</th>
                  <th style={{ padding: '1rem', color: 'var(--color-text-secondary)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', textAlign: 'right' }}>Amount</th>
                  <th style={{ padding: '1rem', color: 'var(--color-text-secondary)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>Processed Date</th>
                </tr>
              </thead>
              <tbody>
                {transfers.map((t) => {
                  const dateStr = new Date(t.createdAt).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  });

                  return (
                    <tr key={t.id} style={{ borderBottom: '1px solid var(--color-border)', transition: 'background-color 0.15s ease' }}>
                      <td style={{ padding: '1.25rem 1rem', fontFamily: 'monospace', fontSize: '0.8125rem' }}>
                        {t.id}
                      </td>
                      <td style={{ padding: '1.25rem 1rem' }}>
                        <div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>
                          {t.sender.firstName} {t.sender.lastName}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', fontFamily: 'monospace' }}>
                          {t.sender.email}
                        </div>
                      </td>
                      <td style={{ padding: '1.25rem 1rem', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                        <ArrowRight size={16} style={{ display: 'inline' }} />
                      </td>
                      <td style={{ padding: '1.25rem 1rem' }}>
                        <div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>
                          {t.recipient.firstName} {t.recipient.lastName}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', fontFamily: 'monospace' }}>
                          {t.recipient.email}
                        </div>
                      </td>
                      <td style={{ padding: '1.25rem 1rem' }}>
                        <Badge variant={t.status === 'COMPLETED' ? 'success' : t.status === 'FAILED' ? 'danger' : 'info'}>
                          {t.status}
                        </Badge>
                      </td>
                      <td style={{ padding: '1.25rem 1rem', textAlign: 'right', fontWeight: 700, color: t.status === 'FAILED' ? 'var(--color-text-secondary)' : 'var(--color-text-primary)' }}>
                        {formatCentsToUSD(t.amount)}
                      </td>
                      <td style={{ padding: '1.25rem 1rem', fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                          <Calendar size={12} />
                          {dateStr}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default TransfersExplorer;
