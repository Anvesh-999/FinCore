import React, { useEffect, useState } from 'react';
import { Key, Copy, Check, Eye, Trash2, AlertTriangle, KeyRound } from 'lucide-react';
import api from '../../services/api';
import { Spinner } from '../../components/ui/Spinner';
import { Badge } from '../../components/ui/Badge';
import { useToast } from '../../components/ui/Toast';

export const ApiKeys = () => {
  const { showToast } = useToast();
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);

  // New Key Modal State
  const [generatedKey, setGeneratedKey] = useState(null);
  const [copiedPublic, setCopiedPublic] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [submittingKey, setSubmittingKey] = useState(false);

  const fetchKeys = async () => {
    try {
      setLoading(true);
      const res = await api.get('/merchant/api-keys');
      setKeys(res.data.data);
    } catch (err) {
      showToast('error', err.response?.data?.error?.message || 'Failed to load API keys');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKeys();
  }, []);

  const handleGenerateKey = async () => {
    try {
      setSubmittingKey(true);
      const res = await api.post('/merchant/api-keys');
      setGeneratedKey(res.data.data);
      showToast('success', 'API key generated successfully!');
      fetchKeys(); // Refresh key list
    } catch (err) {
      showToast('error', err.response?.data?.error?.message || 'Failed to generate key');
    } finally {
      setSubmittingKey(false);
    }
  };

  const handleRevokeKey = async (id) => {
    if (!window.confirm('Are you sure you want to revoke this API key? This action is immediate and cannot be undone.')) {
      return;
    }

    try {
      await api.delete(`/merchant/api-keys/${id}`);
      showToast('success', 'API Key successfully revoked');
      fetchKeys();
    } catch (err) {
      showToast('error', err.response?.data?.error?.message || 'Failed to revoke API key');
    }
  };

  const copyToClipboard = (text, type) => {
    navigator.clipboard.writeText(text);
    if (type === 'public') {
      setCopiedPublic(true);
      setTimeout(() => setCopiedPublic(false), 2000);
    } else {
      setCopiedSecret(true);
      setTimeout(() => setCopiedSecret(false), 2000);
    }
    showToast('info', 'Copied to clipboard');
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
            API Keys
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
            Generate and manage your developer credentials. Authenticate requests by passing headers in format: <code style={{ backgroundColor: 'var(--color-bg)', padding: '0.125rem 0.25rem', borderRadius: 'var(--radius-sm)' }}>x-api-key: publicKey:secretKey</code>
          </p>
        </div>
        <button
          onClick={handleGenerateKey}
          disabled={submittingKey}
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
            cursor: 'pointer',
            boxShadow: 'var(--shadow-sm)',
            transition: 'var(--transition-fast)'
          }}
        >
          {submittingKey ? <Spinner size="sm" /> : <Key size={16} />}
          {submittingKey ? 'Generating...' : 'Generate New Key'}
        </button>
      </div>

      {/* Main Keys List */}
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
        ) : keys.length === 0 ? (
          <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
            No API Keys generated yet. Create one to start accepting payments.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>
                  <th style={{ padding: '1rem 1.5rem', fontWeight: 500, color: 'var(--color-text-secondary)' }}>Key ID</th>
                  <th style={{ padding: '1rem 1.5rem', fontWeight: 500, color: 'var(--color-text-secondary)' }}>Public Key</th>
                  <th style={{ padding: '1rem 1.5rem', fontWeight: 500, color: 'var(--color-text-secondary)' }}>Created</th>
                  <th style={{ padding: '1rem 1.5rem', fontWeight: 500, color: 'var(--color-text-secondary)' }}>Status</th>
                  <th style={{ padding: '1rem 1.5rem', fontWeight: 500, color: 'var(--color-text-secondary)', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {keys.map((k) => {
                  const isActive = k.status === 'ACTIVE';
                  return (
                    <tr key={k.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={{ padding: '1rem 1.5rem', fontWeight: 500 }}>{k.id}</td>
                      <td style={{ padding: '1rem 1.5rem', fontFamily: 'monospace', color: 'var(--color-text-primary)' }}>{k.publicKey}</td>
                      <td style={{ padding: '1rem 1.5rem', color: 'var(--color-text-secondary)' }}>{formatDate(k.createdAt)}</td>
                      <td style={{ padding: '1rem 1.5rem' }}>
                        <Badge variant={isActive ? 'success' : 'secondary'}>
                          {k.status}
                        </Badge>
                      </td>
                      <td style={{ padding: '1rem 1.5rem', textAlign: 'right' }}>
                        {isActive && (
                          <button
                            onClick={() => handleRevokeKey(k.id)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                              backgroundColor: 'transparent',
                              border: '1px solid var(--color-danger)',
                              borderRadius: 'var(--radius-sm)',
                              padding: '0.375rem 0.75rem',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              color: 'var(--color-danger)',
                              cursor: 'pointer',
                              transition: 'var(--transition-fast)'
                            }}
                          >
                            <Trash2 size={12} /> Revoke
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

      {/* plain text secret key display modal */}
      {generatedKey && (
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
            maxWidth: '560px',
            boxShadow: 'var(--shadow-lg)',
            border: '1px solid var(--color-border)',
            overflow: 'hidden',
            animation: 'fadeIn 0.2s ease'
          }}>
            <div style={{
              padding: '1.5rem',
              borderBottom: '1px solid var(--color-border)',
              backgroundColor: 'var(--color-bg)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem'
            }}>
              <KeyRound size={24} style={{ color: 'var(--color-accent)' }} />
              <div>
                <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                  Save your credentials
                </h2>
                <p style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                  This is the only time we will display your secret key.
                </p>
              </div>
            </div>

            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* Alert Callout */}
              <div style={{
                display: 'flex',
                gap: '0.75rem',
                backgroundColor: 'var(--color-danger-bg)',
                border: '1px solid var(--color-danger)',
                borderRadius: 'var(--radius-md)',
                padding: '0.875rem 1rem',
                color: 'var(--color-danger)',
                fontSize: '0.875rem'
              }}>
                <AlertTriangle size={20} style={{ flexShrink: 0 }} />
                <div>
                  <div style={{ fontWeight: 700 }}>Store your Secret Key securely!</div>
                  <div>If you lose this key, you will have to revoke it and generate a new key pair. It cannot be recovered.</div>
                </div>
              </div>

              {/* Public Key Display */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                  Public Key (identifies your sandbox environment)
                </label>
                <div style={{
                  display: 'flex',
                  backgroundColor: 'var(--color-bg)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  overflow: 'hidden'
                }}>
                  <input
                    type="text"
                    readOnly
                    value={generatedKey.publicKey}
                    style={{
                      border: 'none',
                      outline: 'none',
                      backgroundColor: 'transparent',
                      width: '100%',
                      padding: '0.625rem 0.875rem',
                      fontFamily: 'monospace',
                      fontSize: '0.875rem',
                      color: 'var(--color-text-primary)'
                    }}
                  />
                  <button
                    onClick={() => copyToClipboard(generatedKey.publicKey, 'public')}
                    style={{
                      border: 'none',
                      borderLeft: '1px solid var(--color-border)',
                      backgroundColor: 'white',
                      padding: '0 1rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    {copiedPublic ? <Check size={16} style={{ color: 'var(--color-success)' }} /> : <Copy size={16} />}
                  </button>
                </div>
              </div>

              {/* Secret Key Display */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                  Secret Key (authenticates API calls)
                </label>
                <div style={{
                  display: 'flex',
                  backgroundColor: 'var(--color-bg)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  overflow: 'hidden'
                }}>
                  <input
                    type="text"
                    readOnly
                    value={generatedKey.secretKey}
                    style={{
                      border: 'none',
                      outline: 'none',
                      backgroundColor: 'transparent',
                      width: '100%',
                      padding: '0.625rem 0.875rem',
                      fontFamily: 'monospace',
                      fontSize: '0.875rem',
                      color: 'var(--color-text-primary)'
                    }}
                  />
                  <button
                    onClick={() => copyToClipboard(generatedKey.secretKey, 'secret')}
                    style={{
                      border: 'none',
                      borderLeft: '1px solid var(--color-border)',
                      backgroundColor: 'white',
                      padding: '0 1rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    {copiedSecret ? <Check size={16} style={{ color: 'var(--color-success)' }} /> : <Copy size={16} />}
                  </button>
                </div>
              </div>
            </div>

            <div style={{
              padding: '1rem 1.5rem',
              borderTop: '1px solid var(--color-border)',
              backgroundColor: 'var(--color-bg)',
              display: 'flex',
              justifyContent: 'flex-end'
            }}>
              <button
                onClick={() => setGeneratedKey(null)}
                style={{
                  backgroundColor: 'var(--color-primary-light)',
                  color: 'white',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  padding: '0.5rem 1.5rem',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                I have copied it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
