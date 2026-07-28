import React, { useEffect, useState } from 'react';
import { RefreshCw, Play, ShieldCheck, ShieldAlert, CheckCircle2, XCircle, FileText, ChevronDown, ChevronRight } from 'lucide-react';
import api from '../../services/api';
import { Spinner } from '../../components/ui/Spinner';
import { Badge } from '../../components/ui/Badge';
import { useToast } from '../../components/ui/Toast';

export const Reconciliation = () => {
  const { showToast } = useToast();
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [runningAudit, setRunningAudit] = useState(false);
  const [selectedRun, setSelectedRun] = useState(null);

  const fetchReconciliationData = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/reconciliation/runs');
      setRuns(res.data.data);
      
      // Auto-select the latest run if present and none selected
      if (res.data.data.length > 0 && !selectedRun) {
        setSelectedRun(res.data.data[0]);
      } else if (res.data.data.length > 0 && selectedRun) {
        // Update selected run with fresh data
        const updated = res.data.data.find(r => r.id === selectedRun.id);
        if (updated) setSelectedRun(updated);
      }
    } catch (err) {
      showToast('error', err.response?.data?.error?.message || 'Failed to load reconciliation logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReconciliationData();
  }, []);

  const handleRunAudit = async () => {
    try {
      setRunningAudit(true);
      showToast('info', 'Executing platform-wide ledger reconciliation check...');
      const res = await api.post('/admin/reconciliation/check');
      showToast('success', `Reconciliation audit completed! Inconsistencies: ${res.data.data.inconsistencies_found}`);
      setSelectedRun(res.data.data);
      fetchReconciliationData();
    } catch (err) {
      showToast('error', err.response?.data?.error?.message || 'Audit execution failed');
    } finally {
      setRunningAudit(false);
    }
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
            Financial Reconciliation
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
            Verify transactional consistency by matching customer wallet balances against double-entry ledger entries.
          </p>
        </div>
        <button
          onClick={handleRunAudit}
          disabled={runningAudit}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            backgroundColor: 'var(--color-danger)',
            color: 'white',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            padding: '0.625rem 1.25rem',
            fontSize: '0.875rem',
            fontWeight: 600,
            cursor: runningAudit ? 'not-allowed' : 'pointer',
            boxShadow: 'var(--shadow-sm)',
            transition: 'var(--transition-fast)'
          }}
        >
          {runningAudit ? <Spinner size="sm" /> : <Play size={16} />}
          {runningAudit ? 'Auditing Ledger...' : 'Run Consistency Audit'}
        </button>
      </div>

      {/* Main Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '2rem',
        alignItems: 'start'
      }}>
        {/* Left Column: Runs History List */}
        <div style={{
          backgroundColor: 'var(--color-surface)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-border)',
          boxShadow: 'var(--shadow-sm)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>
              Audit History Logs
            </h2>
            <button onClick={fetchReconciliationData} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
              <RefreshCw size={14} /> Refresh
            </button>
          </div>

          {loading && runs.length === 0 ? (
            <div style={{ padding: '3rem', display: 'flex', justifyContent: 'center' }}>
              <Spinner size="md" />
            </div>
          ) : runs.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
              No reconciliation runs executed yet. Trigger the audit run above.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {runs.map((r) => {
                const isSelected = selectedRun && selectedRun.id === r.id;
                const hasAnomalies = r.inconsistencies_found > 0;
                return (
                  <div
                    key={r.id}
                    onClick={() => setSelectedRun(r)}
                    style={{
                      padding: '1rem 1.5rem',
                      borderBottom: '1px solid var(--color-border)',
                      cursor: 'pointer',
                      backgroundColor: isSelected ? 'var(--color-bg)' : 'transparent',
                      transition: 'var(--transition-fast)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                    className="table-row"
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--color-text-primary)' }}>Run #{r.id}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>{formatDate(r.created_at)}</div>
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <Badge variant={hasAnomalies ? 'danger' : 'success'}>
                        {hasAnomalies ? `${r.inconsistencies_found} Anomalies` : 'Balanced'}
                      </Badge>
                      <ChevronRight size={16} style={{ color: 'var(--color-text-muted)' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Run Details panel */}
        {selectedRun && (
          <div style={{
            backgroundColor: 'var(--color-surface)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--color-border)',
            boxShadow: 'var(--shadow-sm)',
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.5rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border)', paddingBottom: '1rem' }}>
              <div>
                <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                  Audit Details: Run #{selectedRun.id}
                </h2>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                  Executed on {formatDate(selectedRun.created_at)}
                </span>
              </div>
              <Badge variant={selectedRun.inconsistencies_found > 0 ? 'danger' : 'success'}>
                {selectedRun.inconsistencies_found > 0 ? 'ANOMALIES FOUND' : 'PASSING'}
              </Badge>
            </div>

            {/* Run summary statistics */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '1rem',
              textAlign: 'center'
            }}>
              <div style={{ backgroundColor: 'var(--color-bg)', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Payments</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{selectedRun.total_payments_checked}</div>
              </div>
              <div style={{ backgroundColor: 'var(--color-bg)', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Refunds</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{selectedRun.total_refunds_checked}</div>
              </div>
              <div style={{ backgroundColor: 'var(--color-bg)', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Transfers</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{selectedRun.total_transfers_checked}</div>
              </div>
            </div>

            {/* Inconsistencies List */}
            <div>
              <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '0.75rem' }}>
                Discrepancy Logs ({selectedRun.inconsistencies_found})
              </h3>
              
              {selectedRun.inconsistencies_found === 0 ? (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  backgroundColor: 'var(--color-success-bg)',
                  border: '1px solid var(--color-success)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1rem',
                  color: 'var(--color-success)',
                  fontSize: '0.875rem'
                }}>
                  <CheckCircle2 size={20} />
                  <div>
                    <span style={{ fontWeight: 700 }}>Balanced Books!</span>
                    <p style={{ fontSize: '0.75rem', marginTop: '0.125rem' }}>No balance leaks, ledger mismatches, or missing entries detected.</p>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {selectedRun.results.map((anomaly, idx) => (
                    <div key={idx} style={{
                      backgroundColor: 'var(--color-danger-bg)',
                      border: '1px solid var(--color-danger)',
                      borderRadius: 'var(--radius-md)',
                      padding: '1rem',
                      color: 'var(--color-danger)',
                      fontSize: '0.875rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.5rem'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}>
                        <XCircle size={16} />
                        <span>{anomaly.type}</span>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-primary)' }}>
                        {anomaly.description}
                      </div>
                      {/* JSON debug logs */}
                      <pre style={{
                        margin: 0,
                        padding: '0.5rem',
                        backgroundColor: 'rgba(0,0,0,0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.2)',
                        borderRadius: 'var(--radius-sm)',
                        fontFamily: 'monospace',
                        fontSize: '0.675rem',
                        color: 'var(--color-text-muted)',
                        overflowX: 'auto'
                      }}>
                        {JSON.stringify(anomaly.details, null, 2)}
                      </pre>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
