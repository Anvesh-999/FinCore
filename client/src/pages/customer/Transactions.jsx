import React, { useEffect, useState } from 'react';
import { ArrowUpRight, ArrowDownLeft, Calendar, FileText } from 'lucide-react';
import api from '../../services/api';
import { Spinner } from '../../components/ui/Spinner';
import { Badge } from '../../components/ui/Badge';
import { useToast } from '../../components/ui/Toast';

export const Transactions = () => {
  const { showToast } = useToast();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [limit] = useState(10);
  const [offset, setOffset] = useState(0);
  const [totalCount, setTotalCount] = useState(0); // Mock/Client-side estimate since simple DB limits are offset-based

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      // Query transactions
      const res = await api.get(`/wallet/transactions?limit=${limit}&offset=${offset}`);
      const data = res.data.data;
      setTransactions(data);
      // If we got back exactly the limit, assume there is a next page
      setTotalCount(offset + data.length + (data.length === limit ? 1 : 0));
    } catch (err) {
      showToast('error', err.response?.data?.error?.message || 'Failed to load transaction history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [offset]);

  const formatCentsToUSD = (centsStr) => {
    const cents = parseInt(centsStr, 10);
    if (isNaN(cents)) return '$0.00';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  };

  const handleNextPage = () => {
    setOffset((prev) => prev + limit);
  };

  const handlePrevPage = () => {
    setOffset((prev) => Math.max(0, prev - limit));
  };

  if (loading && transactions.length === 0) {
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
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>Sandbox Transfer History</h2>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
              Detailed audit trail of all peer transfers processed on your account.
            </p>
          </div>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem 0' }}>
            <Spinner size="md" />
          </div>
        ) : transactions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--color-text-secondary)' }}>
            No transaction records found on this account.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
                  <th style={{ padding: '1rem', color: 'var(--color-text-secondary)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>Reference ID / Type</th>
                  <th style={{ padding: '1rem', color: 'var(--color-text-secondary)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>Date</th>
                  <th style={{ padding: '1rem', color: 'var(--color-text-secondary)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>Description / Memo</th>
                  <th style={{ padding: '1rem', color: 'var(--color-text-secondary)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>Status</th>
                  <th style={{ padding: '1rem', color: 'var(--color-text-secondary)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', textAlign: 'right' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => {
                  const isSent = tx.direction === 'SENT';
                  const txDate = new Date(tx.createdAt).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  });

                  return (
                    <tr key={tx.id} style={{ borderBottom: '1px solid var(--color-border)', transition: 'background-color 0.15s ease' }}>
                      <td style={{ padding: '1.25rem 1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <div style={{ 
                            width: '28px', 
                            height: '28px', 
                            borderRadius: '50%', 
                            backgroundColor: isSent ? 'var(--color-danger-bg)' : 'var(--color-success-bg)',
                            color: isSent ? 'var(--color-danger)' : 'var(--color-success)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            {isSent ? <ArrowUpRight size={14} /> : <ArrowDownLeft size={14} />}
                          </div>
                          <div>
                            <span style={{ fontFamily: 'monospace', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                              {tx.id.substring(0, 8)}...
                            </span>
                            <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                              {tx.type}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td style={{ padding: '1.25rem 1rem', fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                          <Calendar size={14} />
                          {txDate}
                        </div>
                      </td>

                      <td style={{ padding: '1.25rem 1rem', fontSize: '0.875rem', color: 'var(--color-text-primary)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                          <FileText size={14} color="var(--color-text-secondary)" />
                          <span style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {tx.description || 'Simulated Peer Transfer'}
                          </span>
                        </div>
                      </td>

                      <td style={{ padding: '1.25rem 1rem' }}>
                        <Badge variant={tx.status === 'COMPLETED' ? 'success' : tx.status === 'FAILED' ? 'danger' : 'info'}>
                          {tx.status}
                        </Badge>
                      </td>

                      <td style={{ padding: '1.25rem 1rem', textAlign: 'right', fontWeight: 700, fontSize: '0.95rem', color: isSent ? 'var(--color-danger)' : 'var(--color-success)' }}>
                        {isSent ? '-' : '+'}{formatCentsToUSD(tx.amount)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Actions */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem', borderTop: '1px solid var(--color-border)', paddingTop: '1rem' }}>
          <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
            Showing items {offset + 1} - {offset + transactions.length}
          </span>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <Button variant="outline" size="sm" onClick={handlePrevPage} disabled={offset === 0 || loading}>
              Previous
            </Button>
            <Button variant="outline" size="sm" onClick={handleNextPage} disabled={transactions.length < limit || loading}>
              Next
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Transactions;
