import React, { useEffect, useState } from 'react';
import { RefreshCw, Search, ArrowUpDown, RotateCcw } from 'lucide-react';
import api from '../../services/api';
import { Spinner } from '../../components/ui/Spinner';
import { Badge } from '../../components/ui/Badge';
import { useToast } from '../../components/ui/Toast';

export const Refunds = () => {
  const { showToast } = useToast();
  const [refunds, setRefunds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');

  const fetchRefunds = async () => {
    try {
      setLoading(true);
      const res = await api.get('/refunds/merchant/list');
      setRefunds(res.data.data);
    } catch (err) {
      showToast('error', err.response?.data?.error?.message || 'Failed to load refunds');
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

  // Filter and sort logic
  const filteredRefunds = refunds.filter((r) => {
    const query = search.toLowerCase();
    return (
      r.id.toLowerCase().includes(query) ||
      r.paymentId.toLowerCase().includes(query) ||
      (r.reference && r.reference.toLowerCase().includes(query)) ||
      (r.status && r.status.toLowerCase().includes(query)) ||
      (r.description && r.description.toLowerCase().includes(query))
    );
  });

  const sortedRefunds = [...filteredRefunds].sort((a, b) => {
    let valA = a[sortField];
    let valB = b[sortField];

    if (sortField === 'amount' || sortField === 'paymentAmount') {
      valA = parseInt(a[sortField], 10);
      valB = parseInt(b[sortField], 10);
    }

    if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
    if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  const getStatusBadgeVariant = (status) => {
    switch (status) {
      case 'SUCCEEDED': return 'success';
      case 'PROCESSING': return 'warning';
      case 'FAILED': return 'danger';
      default: return 'info';
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
            Refund History
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
            Historical record of all partial and full refunds processed against checkout payments.
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
          placeholder="Search by Refund ID, Payment ID, reference, status, or description..."
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

      {/* Main List */}
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
            No matching refunds found.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>
                  <th onClick={() => handleSort('id')} style={{ padding: '1rem 1.5rem', fontWeight: 500, color: 'var(--color-text-secondary)', cursor: 'pointer' }}>
                    Refund ID <ArrowUpDown size={14} style={{ marginLeft: '0.25rem' }} />
                  </th>
                  <th onClick={() => handleSort('paymentId')} style={{ padding: '1rem 1.5rem', fontWeight: 500, color: 'var(--color-text-secondary)', cursor: 'pointer' }}>
                    Payment ID <ArrowUpDown size={14} style={{ marginLeft: '0.25rem' }} />
                  </th>
                  <th onClick={() => handleSort('reference')} style={{ padding: '1rem 1.5rem', fontWeight: 500, color: 'var(--color-text-secondary)', cursor: 'pointer' }}>
                    Payment Reference <ArrowUpDown size={14} style={{ marginLeft: '0.25rem' }} />
                  </th>
                  <th onClick={() => handleSort('createdAt')} style={{ padding: '1rem 1.5rem', fontWeight: 500, color: 'var(--color-text-secondary)', cursor: 'pointer' }}>
                    Date <ArrowUpDown size={14} style={{ marginLeft: '0.25rem' }} />
                  </th>
                  <th onClick={() => handleSort('amount')} style={{ padding: '1rem 1.5rem', fontWeight: 500, color: 'var(--color-text-secondary)', cursor: 'pointer' }}>
                    Refunded <ArrowUpDown size={14} style={{ marginLeft: '0.25rem' }} />
                  </th>
                  <th onClick={() => handleSort('paymentAmount')} style={{ padding: '1rem 1.5rem', fontWeight: 500, color: 'var(--color-text-secondary)', cursor: 'pointer' }}>
                    Original Amount <ArrowUpDown size={14} style={{ marginLeft: '0.25rem' }} />
                  </th>
                  <th onClick={() => handleSort('status')} style={{ padding: '1rem 1.5rem', fontWeight: 500, color: 'var(--color-text-secondary)', cursor: 'pointer' }}>
                    Status <ArrowUpDown size={14} style={{ marginLeft: '0.25rem' }} />
                  </th>
                  <th style={{ padding: '1rem 1.5rem', fontWeight: 500, color: 'var(--color-text-secondary)' }}>Description</th>
                </tr>
              </thead>
              <tbody>
                {sortedRefunds.map((r) => (
                  <tr key={r.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td style={{ padding: '1rem 1.5rem', fontFamily: 'monospace', color: 'var(--color-text-primary)' }}>
                      {r.id}
                    </td>
                    <td style={{ padding: '1rem 1.5rem', fontFamily: 'monospace', color: 'var(--color-text-secondary)' }}>
                      {r.paymentId}
                    </td>
                    <td style={{ padding: '1rem 1.5rem', color: 'var(--color-text-primary)' }}>
                      {r.reference || <span style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>No Ref</span>}
                    </td>
                    <td style={{ padding: '1rem 1.5rem', color: 'var(--color-text-secondary)' }}>
                      {formatDate(r.createdAt)}
                    </td>
                    <td style={{ padding: '1rem 1.5rem', fontWeight: 600, color: 'var(--color-danger)' }}>
                      -{formatCentsToUSD(r.amount)}
                    </td>
                    <td style={{ padding: '1rem 1.5rem', color: 'var(--color-text-secondary)' }}>
                      {formatCentsToUSD(r.paymentAmount)}
                    </td>
                    <td style={{ padding: '1rem 1.5rem' }}>
                      <Badge variant={getStatusBadgeVariant(r.status)}>{r.status}</Badge>
                    </td>
                    <td style={{ padding: '1rem 1.5rem', color: 'var(--color-text-secondary)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.description || <span style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>—</span>}
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

export default Refunds;
