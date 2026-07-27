import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { CreditCard, ArrowUpRight, ArrowDownLeft, Shield, AlertTriangle } from 'lucide-react';
import api from '../../services/api';
import { Spinner } from '../../components/ui/Spinner';
import { Badge } from '../../components/ui/Badge';
import { useToast } from '../../components/ui/Toast';
import { Link } from 'react-router-dom';

export const Wallet = () => {
  const { user } = useSelector((state) => state.auth);
  const { showToast } = useToast();
  const [wallet, setWallet] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchWalletData = async () => {
      try {
        const [walletRes, txRes] = await Promise.all([
          api.get('/wallet'),
          api.get('/wallet/transactions?limit=5')
        ]);
        setWallet(walletRes.data.data);
        setTransactions(txRes.data.data);
      } catch (err) {
        showToast('error', err.response?.data?.error?.message || 'Failed to load wallet data');
      } finally {
        setLoading(false);
      }
    };
    fetchWalletData();
  }, [showToast]);

  const formatCentsToUSD = (centsStr) => {
    const cents = parseInt(centsStr, 10);
    if (isNaN(cents)) return '$0.00';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px' }}>
        <Spinner size="lg" />
      </div>
    );
  }

  const isFrozen = wallet?.status === 'FROZEN';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {isFrozen && (
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '1rem', 
          backgroundColor: 'var(--color-danger-bg)', 
          border: '1px solid var(--color-danger)', 
          borderRadius: 'var(--radius-lg)', 
          padding: '1rem 1.5rem',
          color: 'var(--color-danger)'
        }}>
          <AlertTriangle size={24} />
          <div>
            <div style={{ fontWeight: 700 }}>Your wallet has been FROZEN by Operations</div>
            <div style={{ fontSize: '0.875rem' }}>Outbound transfers and merchant payments are disabled until status is restored.</div>
          </div>
        </div>
      )}

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', 
        gap: '2rem', 
        alignItems: 'start' 
      }}>
        {/* Glassmorphic Virtual Sandbox Card */}
        <div style={{
          background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
          borderRadius: 'var(--radius-lg)',
          padding: '2rem',
          color: 'white',
          boxShadow: 'var(--shadow-lg)',
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          height: '220px',
          border: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
          {/* Card background circle glow */}
          <div style={{
            position: 'absolute',
            top: '-20%',
            right: '-10%',
            width: '180px',
            height: '180px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(16, 185, 129, 0.2) 0%, rgba(0,0,0,0) 70%)',
            pointerEvents: 'none'
          }} />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 1 }}>
            <div>
              <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', tracking: '0.1em', opacity: 0.8 }}>Sandbox Wallet</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 700, marginTop: '0.25rem' }}>
                {formatCentsToUSD(wallet?.availableBalance)}
              </div>
            </div>
            <CreditCard size={32} color="var(--color-accent)" />
          </div>

          <div style={{ zIndex: 1 }}>
            <div style={{ fontSize: '1.25rem', fontFamily: 'monospace', tracking: '0.2em', margin: '1.5rem 0 1rem 0' }}>
              ••••  ••••  ••••  {wallet?.id ? String(wallet.id).padStart(4, '0') : '0000'}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '0.625rem', textTransform: 'uppercase', opacity: 0.6 }}>Cardholder</div>
                <div style={{ fontSize: '0.875rem', fontWeight: 500 }}>{user?.firstName} {user?.lastName}</div>
              </div>
              <div style={{ display: 'flex', gap: '1.5rem' }}>
                <div>
                  <div style={{ fontSize: '0.625rem', textTransform: 'uppercase', opacity: 0.6 }}>Status</div>
                  <Badge variant={isFrozen ? 'danger' : 'success'}>{wallet?.status}</Badge>
                </div>
                <div>
                  <div style={{ fontSize: '0.625rem', textTransform: 'uppercase', opacity: 0.6 }}>Currency</div>
                  <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>{wallet?.currency}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Detailed Wallet Balance Specs */}
        <div style={{
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          padding: '2rem',
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.5rem',
          height: '220px',
          justifyContent: 'center'
        }}>
          <div>
            <div style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>Available Ledger Balance</div>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
              {formatCentsToUSD(wallet?.availableBalance)}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-success)', display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.25rem' }}>
              <Shield size={12} /> Immediately available for transfers & payments
            </div>
          </div>
          
          <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '1rem' }}>
            <div style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>Pending / Blocked Balance</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>
              {formatCentsToUSD(wallet?.pendingBalance)}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>
              Simulated funds pending checkout session completions
            </div>
          </div>
        </div>
      </div>

      {/* Transaction History Section */}
      <div style={{ 
        backgroundColor: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        padding: '2rem',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Recent Sandbox Transfers</h2>
          <Link to="/customer/transactions" style={{ fontSize: '0.875rem', fontWeight: 600 }}>View All</Link>
        </div>

        {transactions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--color-text-secondary)' }}>
            No transaction records found for this wallet.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {transactions.map((tx) => {
              const isSent = tx.direction === 'SENT';
              return (
                <div key={tx.id} style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between', 
                  padding: '1rem', 
                  border: '1px solid var(--color-border)', 
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--color-bg)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ 
                      width: '40px', 
                      height: '40px', 
                      borderRadius: '50%', 
                      backgroundColor: isSent ? 'var(--color-danger-bg)' : 'var(--color-success-bg)',
                      color: isSent ? 'var(--color-danger)' : 'var(--color-success)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      {isSent ? <ArrowUpRight size={20} /> : <ArrowDownLeft size={20} />}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>
                        {isSent ? 'Funds Transferred Out' : 'Funds Received'}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                        {tx.description || (isSent ? 'Sent Transfer' : 'Received Transfer')}
                      </div>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ 
                      fontWeight: 700, 
                      color: isSent ? 'var(--color-danger)' : 'var(--color-success)' 
                    }}>
                      {isSent ? '-' : '+'}{formatCentsToUSD(tx.amount)}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>
                      {new Date(tx.createdAt).toLocaleDateString(undefined, { 
                        month: 'short', 
                        day: 'numeric', 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Wallet;
