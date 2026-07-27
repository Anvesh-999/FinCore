import React, { useEffect, useState } from 'react';
import { Shield, ShieldAlert, Check, RefreshCw } from 'lucide-react';
import api from '../../services/api';
import { Spinner } from '../../components/ui/Spinner';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../components/ui/Toast';

export const WalletsExplorer = () => {
  const { showToast } = useToast();
  const [wallets, setWallets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState(null);

  const fetchWallets = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/wallets');
      setWallets(res.data.data);
    } catch (err) {
      showToast('error', err.response?.data?.error?.message || 'Failed to retrieve system wallets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWallets();
  }, []);

  const formatCentsToUSD = (centsStr) => {
    const cents = parseInt(centsStr, 10);
    if (isNaN(cents)) return '$0.00';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  };

  const handleToggleFreeze = async (walletId, currentStatus) => {
    const newStatus = currentStatus === 'ACTIVE' ? 'FROZEN' : 'ACTIVE';
    setActionLoadingId(walletId);
    try {
      await api.post(`/admin/wallets/${walletId}/status`, { status: newStatus });
      showToast('success', `Wallet ID ${walletId} successfully set to ${newStatus}`);
      
      // Update local wallet state list
      setWallets((prev) => 
        prev.map((w) => w.id === walletId ? { ...w, status: newStatus } : w)
      );
    } catch (err) {
      showToast('error', err.response?.data?.error?.message || 'Failed to update wallet status');
    } finally {
      setActionLoadingId(null);
    }
  };

  if (loading && wallets.length === 0) {
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
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>System Wallets Directory</h2>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
              Operations control center to monitor user ledger balances and administer wallet statuses.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchWallets} disabled={loading}>
            <RefreshCw size={14} style={{ marginRight: '0.5rem' }} /> Refresh
          </Button>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem 0' }}>
            <Spinner size="md" />
          </div>
        ) : wallets.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--color-text-secondary)' }}>
            No wallets exist in the PostgreSQL database.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
                  <th style={{ padding: '1rem', color: 'var(--color-text-secondary)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>Wallet ID</th>
                  <th style={{ padding: '1rem', color: 'var(--color-text-secondary)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>User Holder</th>
                  <th style={{ padding: '1rem', color: 'var(--color-text-secondary)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>Role</th>
                  <th style={{ padding: '1rem', color: 'var(--color-text-secondary)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>Status</th>
                  <th style={{ padding: '1rem', color: 'var(--color-text-secondary)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', textAlign: 'right' }}>Available Balance</th>
                  <th style={{ padding: '1rem', color: 'var(--color-text-secondary)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', textAlign: 'right' }}>Pending Balance</th>
                  <th style={{ padding: '1rem', color: 'var(--color-text-secondary)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', textAlign: 'center' }}>Admin Operations</th>
                </tr>
              </thead>
              <tbody>
                {wallets.map((w) => {
                  const isFrozen = w.status === 'FROZEN';
                  const isActionLoading = actionLoadingId === w.id;

                  return (
                    <tr key={w.id} style={{ 
                      borderBottom: '1px solid var(--color-border)', 
                      backgroundColor: isFrozen ? 'var(--color-warning-bg)' : 'transparent',
                      transition: 'background-color 0.15s ease' 
                    }}>
                      <td style={{ padding: '1.25rem 1rem', fontFamily: 'monospace', fontWeight: 600 }}>
                        W-{String(w.id).padStart(5, '0')}
                      </td>
                      <td style={{ padding: '1.25rem 1rem' }}>
                        <div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>
                          {w.user.firstName} {w.user.lastName}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                          {w.user.email}
                        </div>
                      </td>
                      <td style={{ padding: '1.25rem 1rem', fontSize: '0.875rem' }}>
                        <Badge variant="outline">{w.user.role}</Badge>
                      </td>
                      <td style={{ padding: '1.25rem 1rem' }}>
                        <Badge variant={isFrozen ? 'danger' : 'success'}>
                          {w.status}
                        </Badge>
                      </td>
                      <td style={{ padding: '1.25rem 1rem', textAlign: 'right', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                        {formatCentsToUSD(w.availableBalance)}
                      </td>
                      <td style={{ padding: '1.25rem 1rem', textAlign: 'right', color: 'var(--color-text-secondary)' }}>
                        {formatCentsToUSD(w.pendingBalance)}
                      </td>
                      <td style={{ padding: '1.25rem 1rem', textAlign: 'center' }}>
                        {isFrozen ? (
                          <Button 
                            variant="primary" 
                            size="sm" 
                            onClick={() => handleToggleFreeze(w.id, w.status)}
                            disabled={isActionLoading}
                            loading={isActionLoading}
                            style={{ backgroundColor: 'var(--color-success)', borderColor: 'var(--color-success)' }}
                          >
                            <Check size={14} style={{ marginRight: '0.25rem' }} /> Unfreeze Wallet
                          </Button>
                        ) : (
                          <Button 
                            variant="danger" 
                            size="sm" 
                            onClick={() => handleToggleFreeze(w.id, w.status)}
                            disabled={isActionLoading}
                            loading={isActionLoading}
                          >
                            <ShieldAlert size={14} style={{ marginRight: '0.25rem' }} /> Freeze Wallet
                          </Button>
                        )}
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

export default WalletsExplorer;
