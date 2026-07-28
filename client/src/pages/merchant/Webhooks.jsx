import React, { useEffect, useState } from 'react';
import { Plus, RotateCw, Trash2, Shield, Settings, Activity, RefreshCw, Eye, EyeOff, AlertTriangle } from 'lucide-react';
import api from '../../services/api';
import { Spinner } from '../../components/ui/Spinner';
import { Badge } from '../../components/ui/Badge';
import { useToast } from '../../components/ui/Toast';

export const Webhooks = () => {
  const { showToast } = useToast();
  const [endpoints, setEndpoints] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);

  // New Endpoint Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newUrl, setNewUrl] = useState('');
  const [selectedEvents, setSelectedEvents] = useState(['payment.succeeded']);
  const [submitting, setSubmitting] = useState(false);

  // View secret states
  const [visibleSecrets, setVisibleSecrets] = useState({});

  const availableEvents = [
    { value: 'payment.succeeded', label: 'payment.succeeded (Payment Completed)' },
    { value: 'refund.succeeded', label: 'refund.succeeded (Refund Completed)' }
  ];

  const fetchWebhooksData = async () => {
    try {
      setLoading(true);
      const [epRes, delRes] = await Promise.all([
        api.get('/merchant/webhooks/endpoints'),
        api.get('/merchant/webhooks/deliveries')
      ]);
      setEndpoints(epRes.data.data);
      setDeliveries(delRes.data.data);
    } catch (err) {
      showToast('error', err.response?.data?.error?.message || 'Failed to load webhooks dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWebhooksData();
  }, []);

  const handleCreateEndpoint = async (e) => {
    e.preventDefault();
    if (!newUrl.startsWith('http')) {
      showToast('error', 'URL must begin with http:// or https://');
      return;
    }

    try {
      setSubmitting(true);
      await api.post('/merchant/webhooks/endpoints', {
        url: newUrl,
        events: selectedEvents
      });
      showToast('success', 'Webhook endpoint registered successfully');
      setNewUrl('');
      setShowAddModal(false);
      fetchWebhooksData();
    } catch (err) {
      showToast('error', err.response?.data?.error?.message || 'Failed to register endpoint');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (endpoint) => {
    const nextStatus = endpoint.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await api.put(`/merchant/webhooks/endpoints/${endpoint.id}`, {
        url: endpoint.url,
        status: nextStatus,
        events: endpoint.events
      });
      showToast('success', `Endpoint state updated to ${nextStatus}`);
      fetchWebhooksData();
    } catch (err) {
      showToast('error', 'Failed to toggle status');
    }
  };

  const handleDeleteEndpoint = async (id) => {
    if (!window.confirm('Are you sure you want to delete this webhook endpoint configuration?')) {
      return;
    }
    try {
      await api.delete(`/merchant/webhooks/endpoints/${id}`);
      showToast('success', 'Endpoint configuration deleted');
      fetchWebhooksData();
    } catch (err) {
      showToast('error', 'Failed to delete endpoint');
    }
  };

  const handleRotateSecret = async (id) => {
    if (!window.confirm('Rotate webhook signing secret? This will invalidate the previous signing secret immediately.')) {
      return;
    }
    try {
      await api.post(`/merchant/webhooks/endpoints/${id}/rotate`);
      showToast('success', 'Webhook signing secret rotated');
      fetchWebhooksData();
    } catch (err) {
      showToast('error', 'Failed to rotate secret');
    }
  };

  const handleRetryDelivery = async (deliveryId) => {
    try {
      showToast('info', 'Webhook retry attempt scheduled');
      await api.post(`/merchant/webhooks/deliveries/${deliveryId}/retry`);
      setTimeout(() => fetchWebhooksData(), 1500); // Wait for async dispatcher then refresh
    } catch (err) {
      showToast('error', 'Failed to retry delivery');
    }
  };

  const toggleSecretVisibility = (id) => {
    setVisibleSecrets(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const handleCheckboxChange = (eventVal) => {
    setSelectedEvents(prev => 
      prev.includes(eventVal)
        ? prev.filter(e => e !== eventVal)
        : [...prev, eventVal]
    );
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  if (loading && endpoints.length === 0) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px' }}>
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
            Webhook Endpoints
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
            Notify your servers in real-time when payments or refunds complete in the sandbox.
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            backgroundColor: 'var(--color-accent)',
            color: 'white',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            padding: '0.625rem 1.25rem',
            fontSize: '0.875rem',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          <Plus size={16} /> Register Endpoint
        </button>
      </div>

      {/* Configured Endpoints Card */}
      <div style={{
        backgroundColor: 'var(--color-surface)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--color-border)',
        boxShadow: 'var(--shadow-sm)',
        padding: '1.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem'
      }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Settings size={18} /> Endpoint Configuration
        </h2>

        {endpoints.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
            No webhook endpoints registered. Add an endpoint to receive signed transactions.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {endpoints.map((ep) => (
              <div key={ep.id} style={{
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                padding: '1rem 1.25rem',
                backgroundColor: 'var(--color-bg)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '1rem'
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', maxWidth: '70%' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 600, color: 'var(--color-text-primary)', wordBreak: 'break-all' }}>{ep.url}</span>
                    <Badge variant={ep.status === 'ACTIVE' ? 'success' : 'secondary'}>
                      {ep.status}
                    </Badge>
                  </div>
                  
                  {/* Signing Secret Viewer */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                    <Shield size={12} />
                    <span>Secret: </span>
                    <code style={{ fontFamily: 'monospace', backgroundColor: 'rgba(255,255,255,0.05)', padding: '0.125rem 0.375rem', borderRadius: 'var(--radius-sm)' }}>
                      {visibleSecrets[ep.id] ? ep.secret : 'whsec_••••••••••••••••••••••••••••••••'}
                    </code>
                    <button onClick={() => toggleSecretVisibility(ep.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', display: 'flex', padding: 0 }}>
                      {visibleSecrets[ep.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>

                  <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                    {ep.events.map((e) => (
                      <span key={e} style={{ fontSize: '0.675rem', backgroundColor: 'var(--color-primary-light)', color: 'white', padding: '0.125rem 0.5rem', borderRadius: '10px' }}>
                        {e}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Endpoint Controls */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <button onClick={() => handleToggleStatus(ep)} style={{ fontSize: '0.75rem', fontWeight: 600, padding: '0.375rem 0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', backgroundColor: 'white', cursor: 'pointer' }}>
                    {ep.status === 'ACTIVE' ? 'Disable' : 'Enable'}
                  </button>
                  <button onClick={() => handleRotateSecret(ep.id)} title="Rotate secret key" style={{ display: 'inline-flex', padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', backgroundColor: 'white', color: 'var(--color-text-secondary)', cursor: 'pointer' }}>
                    <RotateCw size={14} />
                  </button>
                  <button onClick={() => handleDeleteEndpoint(ep.id)} style={{ display: 'inline-flex', padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-danger)', backgroundColor: 'var(--color-danger-bg)', color: 'var(--color-danger)', cursor: 'pointer' }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Webhook Delivery Attempts table */}
      <div style={{
        backgroundColor: 'var(--color-surface)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--color-border)',
        boxShadow: 'var(--shadow-sm)',
        overflow: 'hidden'
      }}>
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Activity size={18} /> Webhook Delivery Logs
          </h2>
          <button onClick={fetchWebhooksData} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>

        {deliveries.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
            No webhook delivery attempts recorded.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>
                  <th style={{ padding: '1rem 1.5rem', fontWeight: 500, color: 'var(--color-text-secondary)' }}>Event Type / ID</th>
                  <th style={{ padding: '1rem 1.5rem', fontWeight: 500, color: 'var(--color-text-secondary)' }}>Destination URL</th>
                  <th style={{ padding: '1rem 1.5rem', fontWeight: 500, color: 'var(--color-text-secondary)' }}>Date</th>
                  <th style={{ padding: '1rem 1.5rem', fontWeight: 500, color: 'var(--color-text-secondary)' }}>Status</th>
                  <th style={{ padding: '1rem 1.5rem', fontWeight: 500, color: 'var(--color-text-secondary)' }}>Response</th>
                  <th style={{ padding: '1rem 1.5rem', fontWeight: 500, color: 'var(--color-text-secondary)', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {deliveries.map((del) => (
                  <tr key={del.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td style={{ padding: '1rem 1.5rem' }}>
                      <div style={{ fontWeight: 600 }}>{del.event_type}</div>
                      <div style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--color-text-muted)' }}>{del.webhook_event_id}</div>
                    </td>
                    <td style={{ padding: '1rem 1.5rem', color: 'var(--color-text-secondary)', wordBreak: 'break-all', maxWidth: '200px' }}>{del.url}</td>
                    <td style={{ padding: '1rem 1.5rem', color: 'var(--color-text-secondary)' }}>{formatDate(del.created_at)}</td>
                    <td style={{ padding: '1rem 1.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                        <Badge variant={del.status === 'SUCCESS' ? 'success' : 'danger'}>
                          {del.status}
                        </Badge>
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Attempt {del.attempt_number}</span>
                      </div>
                    </td>
                    <td style={{ padding: '1rem 1.5rem' }}>
                      {del.response_status ? (
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: 600, color: del.response_status >= 200 && del.response_status < 300 ? 'var(--color-success)' : 'var(--color-danger)' }}>HTTP {del.response_status}</span>
                          <span style={{ fontSize: '0.675rem', color: 'var(--color-text-muted)', fontFamily: 'monospace', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={del.response_body}>
                            {del.response_body}
                          </span>
                        </div>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-danger)', fontWeight: 500 }}>{del.response_body}</span>
                      )}
                    </td>
                    <td style={{ padding: '1rem 1.5rem', textAlign: 'right' }}>
                      <button
                        onClick={() => handleRetryDelivery(del.id)}
                        style={{
                          backgroundColor: 'transparent',
                          border: '1px solid var(--color-border)',
                          borderRadius: 'var(--radius-sm)',
                          padding: '0.375rem 0.75rem',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          color: 'var(--color-text-primary)',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem'
                        }}
                      >
                        <RefreshCw size={12} /> Redeliver
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Register Endpoint Modal */}
      {showAddModal && (
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
            maxWidth: '500px',
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
              <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                Register Webhook Endpoint
              </h2>
              <button onClick={() => setShowAddModal(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.25rem', color: 'var(--color-text-secondary)', fontWeight: 700 }}>
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateEndpoint}>
              <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label htmlFor="url" style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                    Payload URL
                  </label>
                  <input
                    id="url"
                    type="url"
                    required
                    placeholder="https://your-api.com/webhooks"
                    value={newUrl}
                    onChange={(e) => setNewUrl(e.target.value)}
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
                    Needs to be a public URL that accepts POST requests.
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                    Event Subscriptions
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0.5rem', backgroundColor: 'var(--color-bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
                    {availableEvents.map((evt) => (
                      <label key={evt.value} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', cursor: 'pointer', color: 'var(--color-text-primary)', padding: '0.25rem' }}>
                        <input
                          type="checkbox"
                          checked={selectedEvents.includes(evt.value)}
                          onChange={() => handleCheckboxChange(evt.value)}
                          style={{ cursor: 'pointer' }}
                        />
                        <span>{evt.label}</span>
                      </label>
                    ))}
                  </div>
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
                  onClick={() => setShowAddModal(false)}
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
                  disabled={submitting || selectedEvents.length === 0}
                  style={{
                    backgroundColor: 'var(--color-accent)',
                    color: 'white',
                    border: 'none',
                    borderRadius: 'var(--radius-md)',
                    padding: '0.5rem 1.25rem',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    cursor: submitting || selectedEvents.length === 0 ? 'not-allowed' : 'pointer'
                  }}
                >
                  {submitting ? <Spinner size="sm" /> : 'Register'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
