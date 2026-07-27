import React, { useState, useEffect } from 'react';
import { Send as SendIcon, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';
import api from '../../services/api';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../components/ui/Toast';

export const Send = () => {
  const { showToast } = useToast();
  const [recipientEmail, setRecipientEmail] = useState('');
  const [amountUSD, setAmountUSD] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState('');
  const [successData, setSuccessData] = useState(null);
  const [wallet, setWallet] = useState(null);

  // Generate a new idempotency key for this transfer attempt on load
  const generateNewIdempotencyKey = () => {
    setIdempotencyKey(crypto.randomUUID());
  };

  useEffect(() => {
    generateNewIdempotencyKey();
    
    // Fetch wallet to display current available balance
    api.get('/wallet')
      .then(res => setWallet(res.data.data))
      .catch(() => {});
  }, []);

  const formatCentsToUSD = (centsStr) => {
    const cents = parseInt(centsStr, 10);
    if (isNaN(cents)) return '$0.00';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  };

  const handleTransfer = async (e) => {
    e.preventDefault();
    if (!recipientEmail || !amountUSD) {
      showToast('error', 'Recipient email and amount are required');
      return;
    }

    const amountFloat = parseFloat(amountUSD);
    if (isNaN(amountFloat) || amountFloat <= 0) {
      showToast('error', 'Please enter a valid positive transfer amount');
      return;
    }

    // Convert to minor unit (cents)
    const amountCents = Math.round(amountFloat * 100);

    setLoading(true);
    try {
      const response = await api.post('/api/transfers', {
        recipientEmail: recipientEmail.trim(),
        amount: amountCents,
        description: description.trim()
      }, {
        headers: {
          'Idempotency-Key': idempotencyKey
        }
      });

      setSuccessData(response.data.data);
      showToast('success', 'Transfer completed successfully!');
      
      // Update available wallet balance display
      const updatedWallet = await api.get('/wallet');
      setWallet(updatedWallet.data.data);
    } catch (err) {
      showToast('error', err.response?.data?.error?.message || 'Transfer attempt failed.');
      // Keep same idempotency key if we want to retry the EXACT request,
      // or refresh it if user changes details.
      // For safety, generate a new key so next input attempt is fresh
      generateNewIdempotencyKey();
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setRecipientEmail('');
    setAmountUSD('');
    setDescription('');
    setSuccessData(null);
    generateNewIdempotencyKey();
  };

  if (successData) {
    return (
      <div style={{
        backgroundColor: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        padding: '3rem 2rem',
        boxShadow: 'var(--shadow-sm)',
        textAlign: 'center',
        maxWidth: '600px',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '1.5rem'
      }}>
        <div style={{ 
          width: '64px', 
          height: '64px', 
          borderRadius: '50%', 
          backgroundColor: 'var(--color-success-bg)',
          color: 'var(--color-success)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <CheckCircle2 size={36} />
        </div>

        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>Transfer Complete</h2>
          <p style={{ color: 'var(--color-text-secondary)', marginTop: '0.5rem' }}>
            Simulated payment has been successfully completed in the ledger.
          </p>
        </div>

        <div style={{
          width: '100%',
          backgroundColor: 'var(--color-bg)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)',
          padding: '1.25rem',
          textAlign: 'left',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
          fontSize: '0.875rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--color-text-secondary)' }}>Transaction ID</span>
            <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{successData.id}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--color-text-secondary)' }}>Recipient</span>
            <span style={{ fontWeight: 600 }}>{recipientEmail}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--color-text-secondary)' }}>Amount Sent</span>
            <span style={{ fontWeight: 700, color: 'var(--color-success)' }}>
              {formatCentsToUSD(successData.amount)}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--color-text-secondary)' }}>Status</span>
            <span style={{ fontWeight: 600 }}>{successData.status}</span>
          </div>
          {successData.description && (
            <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <span style={{ color: 'var(--color-text-secondary)' }}>Memo / Description</span>
              <span style={{ fontStyle: 'italic' }}>{successData.description}</span>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '1rem', width: '100%', marginTop: '1rem' }}>
          <Button variant="outline" fullWidth onClick={resetForm}>
            Send Another Payment
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {wallet && wallet.status === 'FROZEN' && (
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '1rem', 
          backgroundColor: 'var(--color-danger-bg)', 
          border: '1px solid var(--color-danger)', 
          borderRadius: 'var(--radius-lg)', 
          padding: '1rem 1.5rem',
          color: 'var(--color-danger)'
        }}>
          <AlertTriangle size={24} />
          <div>
            <div style={{ fontWeight: 700 }}>Outbound Transfers Blocked</div>
            <div style={{ fontSize: '0.875rem' }}>Your wallet is frozen. Please contact administration to request account clearance.</div>
          </div>
        </div>
      )}

      <div style={{
        backgroundColor: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        padding: '2rem',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>Send Sandbox Transfer</h2>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            Instantly transfer funds to another FinCore user.
          </p>
          {wallet && (
            <div style={{ 
              marginTop: '1rem', 
              padding: '0.75rem', 
              backgroundColor: 'var(--color-bg)', 
              borderRadius: 'var(--radius-sm)', 
              fontSize: '0.875rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span style={{ color: 'var(--color-text-secondary)' }}>Available Balance</span>
              <span style={{ fontWeight: 700 }}>{formatCentsToUSD(wallet.availableBalance)}</span>
            </div>
          )}
        </div>

        <form onSubmit={handleTransfer} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <Input
            label="Recipient Email Address"
            id="recipientEmail"
            type="email"
            placeholder="recipient@example.com"
            value={recipientEmail}
            onChange={(e) => setRecipientEmail(e.target.value)}
            disabled={loading || (wallet?.status === 'FROZEN')}
            required
          />

          <Input
            label="Amount (USD)"
            id="amountUSD"
            type="number"
            step="0.01"
            placeholder="0.00"
            value={amountUSD}
            onChange={(e) => setAmountUSD(e.target.value)}
            disabled={loading || (wallet?.status === 'FROZEN')}
            required
          />

          <div className="form-group">
            <label htmlFor="description" className="form-label">Memo / Description</label>
            <textarea
              id="description"
              className="form-input"
              rows="3"
              placeholder="e.g. Dinner share, sandbox test transfer"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={loading || (wallet?.status === 'FROZEN')}
              style={{
                fontFamily: 'inherit',
                width: '100%',
                padding: '0.625rem',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--color-surface)',
                color: 'var(--color-text-primary)',
                resize: 'vertical'
              }}
            />
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.75rem',
            color: 'var(--color-text-secondary)',
            backgroundColor: 'var(--color-bg)',
            padding: '0.75rem',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--color-border)'
          }}>
            <ShieldCheck size={16} color="var(--color-accent)" />
            <span>
              <strong>Idempotent Request Enabled</strong>. Safely retry transfer with key:<br />
              <span style={{ fontFamily: 'monospace' }}>{idempotencyKey}</span>
            </span>
          </div>

          <Button
            type="submit"
            variant="primary"
            disabled={loading || (wallet?.status === 'FROZEN')}
            loading={loading}
            fullWidth
          >
            <SendIcon size={16} style={{ marginRight: '0.5rem' }} />
            Send Transfer
          </Button>
        </form>
      </div>
    </div>
  );
};

export default Send;
