import React, { useEffect, useState } from 'react';
import { RefreshCw, Webhook, Activity, Search } from 'lucide-react';
import api from '../../services/api';
import { Spinner } from '../../components/ui/Spinner';
import { Badge } from '../../components/ui/Badge';
import { useToast } from '../../components/ui/Toast';

export const WebhooksExplorer = () => {
  const { showToast } = useToast();
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchDeliveries = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/webhooks');
      setDeliveries(res.data.data);
    } catch (err) {
      showToast('error', err.response?.data?.error?.message || 'Failed to load webhook logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeliveries();
  }, []);

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

  const filtered = deliveries.filter(d => {
    const query = search.toLowerCase();
    const id = d.id.toLowerCase();
    const event = d.event_type.toLowerCase();
    const url = d.url.toLowerCase();
    const merchant = d.merchant_email?.toLowerCase() || '';
    const status = d.status.toLowerCase();
    
    return (
      id.includes(query) ||
      event.includes(query) ||
      url.includes(query) ||
      merchant.includes(query) ||
      status.includes(query)
    );
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
            System Webhook Deliveries
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
            Inspect outbound webhook signals, response codes, and network latency logs.
          </p>
        </div>
        <button onClick={fetchDeliveries} className="btn btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)', padding: '0.5rem 1rem', borderRadius: 'var(--radius-md)', fontWeight: 500, cursor: 'pointer' }}>
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
          placeholder="Filter by delivery ID, event type, merchant email, or URL..."
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
        ) : filtered.length === 0 ? (
          <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
            No webhook delivery attempts recorded in system logs.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>
                  <th style={{ padding: '1rem 1.5rem', fontWeight: 500, color: 'var(--color-text-secondary)' }}>Delivery ID</th>
                  <th style={{ padding: '1rem 1.5rem', fontWeight: 500, color: 'var(--color-text-secondary)' }}>Merchant</th>
                  <th style={{ padding: '1rem 1.5rem', fontWeight: 500, color: 'var(--color-text-secondary)' }}>Event & Target</th>
                  <th style={{ padding: '1rem 1.5rem', fontWeight: 500, color: 'var(--color-text-secondary)' }}>Status</th>
                  <th style={{ padding: '1rem 1.5rem', fontWeight: 500, color: 'var(--color-text-secondary)' }}>Response Status / body</th>
                  <th style={{ padding: '1rem 1.5rem', fontWeight: 500, color: 'var(--color-text-secondary)' }}>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr key={item.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td style={{ padding: '1rem 1.5rem', fontFamily: 'monospace', fontSize: '0.75rem', fontWeight: 600 }}>{item.id}</td>
                    <td style={{ padding: '1rem 1.5rem' }}>
                      <div style={{ fontWeight: 600 }}>Merchant Office</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>{item.merchant_email}</div>
                    </td>
                    <td style={{ padding: '1rem 1.5rem' }}>
                      <div style={{ fontWeight: 600 }}>{item.event_type}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', wordBreak: 'break-all', maxWidth: '280px' }}>{item.url}</div>
                    </td>
                    <td style={{ padding: '1rem 1.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                        <Badge variant={item.status === 'SUCCESS' ? 'success' : 'danger'}>
                          {item.status}
                        </Badge>
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Retry #{item.attempt_number}</span>
                      </div>
                    </td>
                    <td style={{ padding: '1rem 1.5rem' }}>
                      {item.response_status ? (
                        <div>
                          <span style={{ fontWeight: 600, color: item.response_status >= 200 && item.response_status < 300 ? 'var(--color-success)' : 'var(--color-danger)' }}>HTTP {item.response_status}</span>
                          <div style={{ fontSize: '0.675rem', color: 'var(--color-text-muted)', fontFamily: 'monospace', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.response_body}>
                            {item.response_body}
                          </div>
                        </div>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-danger)', fontWeight: 500 }}>{item.response_body}</span>
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
