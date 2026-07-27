import React, { useEffect, useState } from 'react';
import { BookOpen, Calendar, Key, RefreshCw } from 'lucide-react';
import api from '../../services/api';
import { Spinner } from '../../components/ui/Spinner';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../components/ui/Toast';

export const LedgerBook = () => {
  const { showToast } = useToast();
  const [ledgerTxList, setLedgerTxList] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchLedger = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/ledger');
      const entries = res.data.data;
      
      // Group flat entries by transactionId
      const grouped = entries.reduce((acc, entry) => {
        const txId = entry.transactionId;
        if (!acc[txId]) {
          acc[txId] = {
            id: txId,
            referenceType: entry.referenceType,
            referenceId: entry.referenceId,
            status: entry.transactionStatus,
            createdAt: entry.transactionCreatedAt,
            entries: [],
          };
        }
        acc[txId].entries.push(entry);
        return acc;
      }, {});

      // Sort transactions descending by date
      const sortedTxs = Object.values(grouped).sort((a, b) => 
        new Date(b.createdAt) - new Date(a.createdAt)
      );

      setLedgerTxList(sortedTxs);
    } catch (err) {
      showToast('error', err.response?.data?.error?.message || 'Failed to retrieve ledger data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLedger();
  }, []);

  const formatCentsToUSD = (centsStr) => {
    const cents = parseInt(centsStr, 10);
    if (isNaN(cents)) return '$0.00';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  };

  if (loading && ledgerTxList.length === 0) {
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
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>Double-Entry Ledger Book</h2>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
              Inspect immutable balanced debit and credit entries matching transaction logs.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchLedger} disabled={loading}>
            <RefreshCw size={14} style={{ marginRight: '0.5rem' }} /> Refresh
          </Button>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem 0' }}>
            <Spinner size="md" />
          </div>
        ) : ledgerTxList.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--color-text-secondary)' }}>
            No ledger transactions exist in the database.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {ledgerTxList.map((tx) => {
              const dateStr = new Date(tx.createdAt).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              });

              // Sum Debits and Credits to verify balance
              const totalDebits = tx.entries
                .filter(e => e.direction === 'DEBIT')
                .reduce((sum, e) => sum + BigInt(e.amount), 0n);

              const totalCredits = tx.entries
                .filter(e => e.direction === 'CREDIT')
                .reduce((sum, e) => sum + BigInt(e.amount), 0n);

              const isBalanced = totalDebits === totalCredits;

              return (
                <div key={tx.id} style={{
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--color-bg)',
                  overflow: 'hidden',
                  boxShadow: 'var(--shadow-sm)'
                }}>
                  {/* Transaction Header Info */}
                  <div style={{
                    backgroundColor: 'var(--color-primary)',
                    color: 'white',
                    padding: '1rem',
                    display: 'flex',
                    flexWrap: 'wrap',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '1rem'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <BookOpen size={18} color="var(--color-accent)" />
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>
                          Transaction: <span style={{ fontFamily: 'monospace' }}>{tx.id}</span>
                        </div>
                        <div style={{ fontSize: '0.75rem', opacity: 0.8, display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.125rem' }}>
                          <span>Ref: {tx.referenceType} ({tx.referenceId})</span>
                          <span>•</span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <Calendar size={10} /> {dateStr}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <Badge variant={isBalanced ? 'success' : 'danger'}>
                        {isBalanced ? 'BALANCED' : 'UNBALANCED'}
                      </Badge>
                      <Badge variant="outline" style={{ color: 'white', borderColor: 'rgba(255,255,255,0.3)' }}>
                        {tx.status}
                      </Badge>
                    </div>
                  </div>

                  {/* Double-Entry Postings Table */}
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', backgroundColor: 'var(--color-surface)' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface-hover)' }}>
                        <th style={{ padding: '0.75rem 1rem', color: 'var(--color-text-secondary)', fontSize: '0.7125rem', fontWeight: 600, textTransform: 'uppercase' }}>Ledger Account ID</th>
                        <th style={{ padding: '0.75rem 1rem', color: 'var(--color-text-secondary)', fontSize: '0.7125rem', fontWeight: 600, textTransform: 'uppercase' }}>Holder Type</th>
                        <th style={{ padding: '0.75rem 1rem', color: 'var(--color-text-secondary)', fontSize: '0.7125rem', fontWeight: 600, textTransform: 'uppercase' }}>Holder Detail</th>
                        <th style={{ padding: '0.75rem 1rem', color: 'var(--color-text-secondary)', fontSize: '0.7125rem', fontWeight: 600, textTransform: 'uppercase', textAlign: 'right' }}>Debit (Dr)</th>
                        <th style={{ padding: '0.75rem 1rem', color: 'var(--color-text-secondary)', fontSize: '0.7125rem', fontWeight: 600, textTransform: 'uppercase', textAlign: 'right' }}>Credit (Cr)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tx.entries.map((entry) => {
                        const isDebit = entry.direction === 'DEBIT';
                        return (
                          <tr key={entry.entryId} style={{ borderBottom: '1px solid var(--color-border)' }}>
                            <td style={{ padding: '0.75rem 1rem', fontFamily: 'monospace', fontSize: '0.8125rem' }}>
                              ACT-{String(entry.accountId).padStart(5, '0')}
                            </td>
                            <td style={{ padding: '0.75rem 1rem', fontSize: '0.8125rem' }}>
                              <Badge variant="outline">{entry.holderType}</Badge>
                            </td>
                            <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem' }}>
                              {entry.holderType === 'SYSTEM' ? (
                                <span style={{ fontStyle: 'italic', color: 'var(--color-text-secondary)' }}>System Treasury Reserve</span>
                              ) : entry.holder ? (
                                <div>
                                  <span style={{ fontWeight: 500 }}>{entry.holder.firstName} {entry.holder.lastName}</span>
                                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginLeft: '0.5rem', fontFamily: 'monospace' }}>({entry.holder.email})</span>
                                </div>
                              ) : (
                                <span style={{ color: 'var(--color-text-muted)' }}>ID: {entry.holderId}</span>
                              )}
                            </td>
                            <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: isDebit ? 700 : 400, color: isDebit ? 'var(--color-text-primary)' : 'var(--color-text-muted)' }}>
                              {isDebit ? formatCentsToUSD(entry.amount) : '-'}
                            </td>
                            <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: !isDebit ? 700 : 400, color: !isDebit ? 'var(--color-accent)' : 'var(--color-text-muted)' }}>
                              {!isDebit ? formatCentsToUSD(entry.amount) : '-'}
                            </td>
                          </tr>
                        );
                      })}
                      {/* Summary Row */}
                      <tr style={{ backgroundColor: 'var(--color-surface-hover)', fontWeight: 700 }}>
                        <td colSpan="3" style={{ padding: '0.75rem 1rem', textAlign: 'right', fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
                          Total Postings:
                        </td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontSize: '0.875rem' }}>
                          {formatCentsToUSD(totalDebits.toString())}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontSize: '0.875rem', color: 'var(--color-accent)' }}>
                          {formatCentsToUSD(totalCredits.toString())}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default LedgerBook;
