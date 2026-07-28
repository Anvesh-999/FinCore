import React, { useEffect, useState } from 'react';
import { RefreshCw, ShieldAlert, Shield, AlertTriangle, ShieldCheck, Search } from 'lucide-react';
import api from '../../services/api';
import { Spinner } from '../../components/ui/Spinner';
import { Badge } from '../../components/ui/Badge';
import { useToast } from '../../components/ui/Toast';

export const RiskExplorer = () => {
  const { showToast } = useToast();
  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchRiskData = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/risk/assessments');
      setAssessments(res.data.data);
    } catch (err) {
      showToast('error', err.response?.data?.error?.message || 'Failed to load risk logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRiskData();
  }, []);

  const formatCentsToUSD = (centsStr) => {
    if (!centsStr) return '—';
    const cents = parseInt(centsStr, 10);
    if (isNaN(cents)) return '—';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  // Search/filter
  const filtered = assessments.filter(a => {
    const query = search.toLowerCase();
    const id = a.id.toLowerCase();
    const type = a.transaction_type.toLowerCase();
    const decision = a.decision.toLowerCase();
    const rules = a.rules_triggered.join(' ').toLowerCase();
    
    const sender = a.sender_email?.toLowerCase() || '';
    const recipient = a.recipient_email?.toLowerCase() || '';
    const merchant = a.merchant_email?.toLowerCase() || '';
    const customer = a.customer_email?.toLowerCase() || '';

    return (
      id.includes(query) ||
      type.includes(query) ||
      decision.includes(query) ||
      rules.includes(query) ||
      sender.includes(query) ||
      recipient.includes(query) ||
      merchant.includes(query) ||
      customer.includes(query)
    );
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
            Transaction Risk Controls
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
            Platform-wide automated risk rules logs, velocity audits, and security block records.
          </p>
        </div>
        <button onClick={fetchRiskData} className="btn btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)', padding: '0.5rem 1rem', borderRadius: 'var(--radius-md)', fontWeight: 500, cursor: 'pointer' }}>
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      {/* Filter Toolbar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        backgroundColor: 'var(--color-surface)',
        padding: '0.75rem 1.25rem',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--color-border)',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <Search size={20} style={{ color: 'var(--color-text-muted)', marginRight: '0.75rem' }} />
        <input
          type="text"
          placeholder="Filter by assessment ID, rule, decision, or email address..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            border: 'none',
            outline: 'none',
            width: '100%',
            fontSize: '0.875rem',
            color: 'var(--color-text-primary)',
            backgroundColor: 'transparent'
          }}
        />
      </div>

      {/* Risk logs Table */}
      <div style={{
        backgroundColor: 'var(--color-surface)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--color-border)',
        boxShadow: 'var(--shadow-sm)',
        overflow: 'hidden'
      }}>
        {loading ? (
          <div style={{ padding: '4rem', display: 'flex', justifyContent: 'center' }}>
            <Spinner size="lg" />
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
            No matching risk assessments found in logs.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>
                  <th style={{ padding: '1rem 1.5rem', fontWeight: 500, color: 'var(--color-text-secondary)' }}>Assessment ID</th>
                  <th style={{ padding: '1rem 1.5rem', fontWeight: 500, color: 'var(--color-text-secondary)' }}>Tx Type & ID</th>
                  <th style={{ padding: '1rem 1.5rem', fontWeight: 500, color: 'var(--color-text-secondary)' }}>Parties / Amount</th>
                  <th style={{ padding: '1rem 1.5rem', fontWeight: 500, color: 'var(--color-text-secondary)' }}>Score</th>
                  <th style={{ padding: '1rem 1.5rem', fontWeight: 500, color: 'var(--color-text-secondary)' }}>Decision</th>
                  <th style={{ padding: '1rem 1.5rem', fontWeight: 500, color: 'var(--color-text-secondary)' }}>Rules Triggered</th>
                  <th style={{ padding: '1rem 1.5rem', fontWeight: 500, color: 'var(--color-text-secondary)' }}>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr key={item.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td style={{ padding: '1rem 1.5rem', fontFamily: 'monospace', fontSize: '0.75rem', fontWeight: 600 }}>{item.id}</td>
                    <td style={{ padding: '1rem 1.5rem' }}>
                      <div style={{ fontWeight: 600 }}>{item.transaction_type}</div>
                      <div style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--color-text-muted)' }}>{item.transaction_id}</div>
                    </td>
                    <td style={{ padding: '1rem 1.5rem' }}>
                      {item.transaction_type === 'TRANSFER' ? (
                        <div>
                          <div style={{ fontSize: '0.75rem' }}><span style={{ color: 'var(--color-text-secondary)' }}>From:</span> {item.sender_email}</div>
                          <div style={{ fontSize: '0.75rem' }}><span style={{ color: 'var(--color-text-secondary)' }}>To:</span> {item.recipient_email}</div>
                          <div style={{ fontWeight: 600, marginTop: '0.25rem' }}>{formatCentsToUSD(item.transfer_amount)}</div>
                        </div>
                      ) : (
                        <div>
                          <div style={{ fontSize: '0.75rem' }}><span style={{ color: 'var(--color-text-secondary)' }}>Customer:</span> {item.customer_email}</div>
                          <div style={{ fontSize: '0.75rem' }}><span style={{ color: 'var(--color-text-secondary)' }}>Merchant:</span> {item.merchant_email}</div>
                          <div style={{ fontWeight: 600, marginTop: '0.25rem' }}>{formatCentsToUSD(item.payment_amount)}</div>
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '1rem 1.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <span style={{ 
                          fontSize: '1rem', 
                          fontWeight: 700, 
                          color: item.risk_score >= 70 ? 'var(--color-danger)' : 
                                 item.risk_score >= 40 ? 'var(--color-warning)' : 'var(--color-success)'
                        }}>
                          {item.risk_score}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>/100</span>
                      </div>
                    </td>
                    <td style={{ padding: '1rem 1.5rem' }}>
                      <Badge 
                        variant={
                          item.decision === 'BLOCK' ? 'danger' :
                          item.decision === 'REVIEW' ? 'warning' : 'success'
                        }
                      >
                        {item.decision}
                      </Badge>
                    </td>
                    <td style={{ padding: '1rem 1.5rem' }}>
                      {item.rules_triggered.length === 0 ? (
                        <span style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>None</span>
                      ) : (
                        <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                          {item.rules_triggered.map(r => (
                            <span key={r} style={{ 
                              fontSize: '0.675rem', 
                              fontWeight: 600,
                              backgroundColor: 'rgba(239, 68, 68, 0.1)', 
                              color: 'var(--color-danger)', 
                              padding: '0.125rem 0.5rem', 
                              borderRadius: '4px',
                              border: '1px solid rgba(239, 68, 68, 0.2)'
                            }}>
                              {r}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '1rem 1.5rem', color: 'var(--color-text-secondary)' }}>{formatDate(item.created_at)}</td>
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
