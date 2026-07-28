import React, { useEffect, useState } from 'react';
import { RefreshCw, Search, ArrowUpDown, ChevronDown, RotateCcw, AlertTriangle } from 'lucide-react';
import api from '../../services/api';
import { Spinner } from '../../components/ui/Spinner';
import { Badge } from '../../components/ui/Badge';
import { useToast } from '../../components/ui/Toast';

export const Payments = () => {
  const { showToast } = useToast();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');

  // Refund Modal State
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundDescription, setRefundDescription] = useState('');
  const [submittingRefund, setSubmittingRefund] = useState(false);

  const fetchPayments = async () => {
    try {
      setLoading(true);
      const res = await api.get('/payments/merchant/list');
      setPayments(res.data.data);
    } catch (err) {
      showToast('error', err.response?.data?.error?.message || 'Failed to load payments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, []);

  const handleSort = (field) => {
    const order = sortField === field && sortOrder === 'desc' ? 'asc' : 'desc';
    setSortField(field);
    setSortOrder(order);
  };

  const handleRefundSubmit = async (e) => {
    e.preventDefault();
    if (!selectedPayment) return;

    const amountInCents = Math.round(parseFloat(refundAmount) * 100);
    if (isNaN(amountInCents) || amountInCents <= 0) {
      showToast('error', 'Please enter a valid refund amount greater than zero');
      return;
    }

    try {
      setSubmittingRefund(true);
      await api.post(`/payments/${selectedPayment.id}/refunds`, {
        amount: amountInCents,
        description: refundDescription
      });
      showToast('success', `Successfully issued refund of $${parseFloat(refundAmount).toFixed(2)}`);
      setSelectedPayment(null);
      setRefundAmount('');
      setRefundDescription('');
      fetchPayments(); // Refresh list
    } catch (err) {
      showToast('error', err.response?.data?.error?.message || 'Failed to issue refund');
    } finally {
      setSubmittingRefund(false);
    }
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
  const filteredPayments = payments.filter((p) => {
    const query = search.toLowerCase();
    return (
      p.id.toLowerCase().includes(query) ||
      (p.reference && p.reference.toLowerCase().includes(query)) ||
      (p.status && p.status.toLowerCase().includes(query))
    );
  });

  const sortedPayments = [...filteredPayments].sort((a, b) => {
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
            Payment Orders
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
            List of all incoming client transaction sessions, checkouts, and refunds.
          </p>
        </div>
        <button onClick={fetchPayments} className="btn btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)', padding: '0.5rem 1rem', borderRadius: 'var(--radius-md)', fontWeight: 500, cursor: 'pointer' }}>
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
          placeholder="Search by Payment ID, reference, or status..."
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
        ) : sortedPayments.length === 0 ? (
          <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
            No matching payment orders found.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>
                  <th onClick={() => handleSort('id')} style={{ padding: '1rem 1.5rem', fontWeight: 500, color: 'var(--color-text-secondary)', cursor: 'pointer' }}>
                    Payment ID <ArrowUpDown size={14} style={{ marginLeft: '0.25rem' }} />
                  </th>
                  <th onClick={() => handleSort('reference')} style={{ padding: '1rem 1.5rem', fontWeight: 500, color: 'var(--color-text-secondary)', cursor: 'pointer' }}>
                    Reference <ArrowUpDown size={14} style={{ marginLeft: '0.25rem' }} />
                  </th>
                  <th onClick={() => handleSort('createdAt')} style={{ padding: '1rem 1.5rem', fontWeight: 500, color: 'var(--color-text-secondary)', cursor: 'pointer' }}>
                    Date <ArrowUpDown size={14} style={{ marginLeft: '0.25rem' }} />
                  </th>
                  <th onClick={() => handleSort('amount')} style={{ padding: '1rem 1.5rem', fontWeight: 500, color: 'var(--color-text-secondary)', cursor: 'pointer' }}>
                    Amount <ArrowUpDown size={14} style={{ marginLeft: '0.25rem' }} />
                  </th>
                  <th onClick={() => handleSort('status')} style={{ padding: '1rem 1.5rem', fontWeight: 500, color: 'var(--color-text-secondary)', cursor: 'pointer' }}>
                    Status <ArrowUpDown size={14} style={{ marginLeft: '0.25rem' }} />
                  </th>
                  <th style={{ padding: '1rem 1.5rem', fontWeight: 500, color: 'var(--color-text-secondary)', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedPayments.map((p) => {
                  const isRefundable = ['SUCCEEDED', 'PARTIALLY_REFUNDED'].includes(p.status);
                  return (
                    <tr key={p.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={{ padding: '1rem 1.5rem', fontFamily: 'monospace', fontWeight: 500 }}>{p.id}</td>
                      <td style={{ padding: '1rem 1.5rem', fontWeight: 500 }}>{p.reference || '—'}</td>
                      <td style={{ padding: '1rem 1.5rem', color: 'var(--color-text-secondary)' }}>{formatDate(p.createdAt)}</td>
                      <td style={{ padding: '1rem 1.5rem', fontWeight: 600 }}>{formatCentsToUSD(p.amount)}</td>
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
                      <td style={{ padding: '1rem 1.5rem', textAlign: 'right' }}>
                        {isRefundable && (
                          <button
                            onClick={() => setSelectedPayment(p)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                              backgroundColor: 'transparent',
                              border: '1px solid var(--color-border)',
                              borderRadius: 'var(--radius-sm)',
                              padding: '0.375rem 0.75rem',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              color: 'var(--color-text-primary)',
                              cursor: 'pointer',
                              transition: 'var(--transition-fast)'
                            }}
                            className="btn-refund-action"
                          >
                            <RotateCcw size={12} /> Refund
                          </button>
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

      {/* Issue Refund Modal */}
      {selectedPayment && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 999,
          padding: '1.5rem'
        }}>
          <div style={{
            backgroundColor: 'var(--color-surface)',
            borderRadius: 'var(--radius-lg)',
            width: '100%',
            maxWidth: '480px',
            boxShadow: 'var(--shadow-lg)',
            border: '1px solid var(--color-border)',
            overflow: 'hidden',
            animation: 'fadeIn 0.2s ease'
          }}>
            <div style={{
              padding: '1.5rem',
              borderBottom: '1px solid var(--color-border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: 'var(--color-bg)'
            }}>
              <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <RotateCcw size={20} style={{ color: 'var(--color-warning)' }} /> Issue Refund
              </h2>
              <button onClick={() => setSelectedPayment(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.25rem', color: 'var(--color-text-secondary)', fontWeight: 700 }}>
                &times;
              </button>
            </div>

            <form onSubmit={handleRefundSubmit}>
              <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.875rem' }}>
                  <div style={{ color: 'var(--color-text-secondary)' }}>Payment Reference:</div>
                  <div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{selectedPayment.reference || 'No reference'}</div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.875rem' }}>
                  <div style={{ color: 'var(--color-text-secondary)' }}>Total Payment Value:</div>
                  <div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{formatCentsToUSD(selectedPayment.amount)}</div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label htmlFor="amount" style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                    Refund Amount (USD)
                  </label>
                  <input
                    id="amount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    placeholder="0.00"
                    value={refundAmount}
                    onChange={(e) => setRefundAmount(e.target.value)}
                    style={{
                      padding: '0.625rem 0.875rem',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border)',
                      fontSize: '0.875rem',
                      outline: 'none',
                      color: 'var(--color-text-primary)'
                    }}
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                    Partial refunds are supported. Limit: total refunded cannot exceed total payment value.
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label htmlFor="description" style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                    Description / Reason
                  </label>
                  <textarea
                    id="description"
                    placeholder="Item returned, customer satisfaction compensation, etc."
                    value={refundDescription}
                    onChange={(e) => setRefundDescription(e.target.value)}
                    rows={3}
                    style={{
                      padding: '0.625rem 0.875rem',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border)',
                      fontSize: '0.875rem',
                      outline: 'none',
                      color: 'var(--color-text-primary)',
                      resize: 'none',
                      fontFamily: 'inherit'
                    }}
                  />
                </div>
              </div>

              <div style={{
                padding: '1rem 1.5rem',
                borderTop: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-bg)',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '0.75rem'
              }}>
                <button
                  type="button"
                  onClick={() => setSelectedPayment(null)}
                  style={{
                    backgroundColor: 'white',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    padding: '0.5rem 1rem',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    color: 'var(--color-text-primary)',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingRefund}
                  style={{
                    backgroundColor: 'var(--color-warning)',
                    color: 'white',
                    border: 'none',
                    borderRadius: 'var(--radius-md)',
                    padding: '0.5rem 1.25rem',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}
                >
                  {submittingRefund ? <Spinner size="sm" /> : 'Issue Refund'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
