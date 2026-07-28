import React, { useEffect, useState } from 'react';
import { RefreshCw, Search, ArrowUpDown } from 'lucide-react';
import api from '../../services/api';
import { Spinner } from '../../components/ui/Spinner';
import { Badge } from '../../components/ui/Badge';
import { useToast } from '../../components/ui/Toast';

export const RefundsExplorer = () => {
  const { showToast } = useToast();
  const [refunds, setRefunds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');

  const fetchRefunds = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/refunds');
      setRefunds(res.data.data);
    } catch (err) {
      showToast('error', err.response?.data?.error?.message || 'Failed to load system refunds');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRefunds();
  }, []);

  const handleSort = (field) => {
    const order = sortField === field && sortOrder === 'desc' ? 'asc' : 'desc';
    setSortField(field);
    setSortOrder(order);
  };

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
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Search filter
  const filteredRefunds = refunds.filter((r) => {
    const query = search.toLowerCase();
    const merchantName = r.merchant ? `${r.merchant.firstName} ${r.merchant.lastName}`.toLowerCase() : '';
    const merchantEmail = r.merchant?.email?.toLowerCase() || '';
    const customerName = r.customer ? `${r.customer.firstName} ${r.customer.lastName}`.toLowerCase() : '';
    const customerEmail = r.customer?.email?.toLowerCase() || '';
    const refundId = r.id.toLowerCase();
    const paymentId = r.paymentId.toLowerCase();
    const description = r.description?.toLowerCase() || '';
    const status = r.status?.toLowerCase() || '';

    return (
      refundId.includes(query) ||
      paymentId.includes(query) ||
      description.includes(query) ||
      status.includes(query) ||
      merchantName.includes(query) ||
      merchantEmail.includes(query) ||
      customerName.includes(query) ||
      customerEmail.includes(query)
    );
  });

  // Sort
  const sortedRefunds = [...filteredRefunds].sort((a, b) => {
    let valA = a[sortField];
    let valB = b[sortField];

    if (sortField === 'amount') {
      valA = parseInt(a.amount, 10);
      valB = parseInt(b.amount, 10);
    }

    if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
    if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
            System Refunds
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
            Administrative explorer for all payment refunds and reversals executed across the platform.
          </p>
        </div>
        <button onClick={fetchRefunds} className="btn btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)', padding: '0.5rem 1rem', borderRadius: 'var(--radius-md)', fontWeight: 500, cursor: 'pointer' }}>
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
          placeholder="Filter by Refund ID, Payment ID, description, status, or email..."
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

      {/* Table */}
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
        ) : sortedRefunds.length === 0 ? (
          <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
            No refund records found in system logs.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>
                  <th onClick={() => handleSort('id')} style={{ padding: '1rem 1.5rem', fontWeight: 500, color: 'var(--color-text-secondary)', cursor: 'pointer' }}>
                    Refund ID <ArrowUpDown size={14} style={{ marginLeft: '0.25rem' }} />
                  </th>
                  <th style={{ padding: '1rem 1.5rem', fontWeight: 500, color: 'var(--color-text-secondary)' }}>Original Payment ID</th>
                  <th style={{ padding: '1rem 1.5rem', fontWeight: 500, color: 'var(--color-text-secondary)' }}>Merchant</th>
                  <th style={{ padding: '1rem 1.5rem', fontWeight: 500, color: 'var(--color-text-secondary)' }}>Customer / Recipient</th>
                  <th onClick={() => handleSort('createdAt')} style={{ padding: '1rem 1.5rem', fontWeight: 500, color: 'var(--color-text-secondary)', cursor: 'pointer' }}>
                    Date <ArrowUpDown size={14} style={{ marginLeft: '0.25rem' }} />
                  </th>
                  <th onClick={() => handleSort('amount')} style={{ padding: '1rem 1.5rem', fontWeight: 500, color: 'var(--color-text-secondary)', cursor: 'pointer' }}>
                    Refunded <ArrowUpDown size={14} style={{ marginLeft: '0.25rem' }} />
                  </th>
                  <th onClick={() => handleSort('status')} style={{ padding: '1rem 1.5rem', fontWeight: 500, color: 'var(--color-text-secondary)', cursor: 'pointer' }}>
                    Status <ArrowUpDown size={14} style={{ marginLeft: '0.25rem' }} />
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedRefunds.map((r) => (
                  <tr key={r.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td style={{ padding: '1rem 1.5rem', fontFamily: 'monospace', fontWeight: 500 }}>
                      <div>{r.id}</div>
                      {r.description && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.125rem' }}>
                          Reason: {r.description}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '1rem 1.5rem', fontFamily: 'monospace' }}>
                      <div>{r.paymentId}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.125rem' }}>
                        Captured: {formatCentsToUSD(r.paymentAmount)}
                      </div>
                    </td>
                    <td style={{ padding: '1rem 1.5rem' }}>
                      <div style={{ fontWeight: 600 }}>{r.merchant ? `${r.merchant.firstName} ${r.merchant.lastName}` : 'System'}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>{r.merchant?.email}</div>
                    </td>
                    <td style={{ padding: '1rem 1.5rem' }}>
                      {r.customer ? (
                        <>
                          <div style={{ fontWeight: 500 }}>{r.customer.firstName} {r.customer.lastName}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>{r.customer.email}</div>
                        </>
                      ) : (
                        <span style={{ color: 'var(--color-text-muted)' }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: '1rem 1.5rem', color: 'var(--color-text-secondary)' }}>{formatDate(r.createdAt)}</td>
                    <td style={{ padding: '1rem 1.5rem', fontWeight: 600, color: 'var(--color-danger)' }}>
                      -{formatCentsToUSD(r.amount)}
                    </td>
                    <td style={{ padding: '1rem 1.5rem' }}>
                      <Badge variant={r.status === 'SUCCEEDED' ? 'success' : 'secondary'}>
                        {r.status}
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
