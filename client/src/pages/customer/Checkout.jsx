import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ShieldCheck, CreditCard, ShoppingBag, ArrowLeft, Wallet, AlertCircle } from 'lucide-react';
import api from '../../services/api';
import { Spinner } from '../../components/ui/Spinner';
import { useToast } from '../../components/ui/Toast';

export const Checkout = () => {
  const { paymentId } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [payment, setPayment] = useState(null);
  const [customerWallet, setCustomerWallet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState('pay'); // 'pay' or 'success'

  useEffect(() => {
    const fetchCheckoutDetails = async () => {
      try {
        setLoading(true);
        const [paymentRes, walletRes] = await Promise.all([
          api.get(`/payments/${paymentId}`),
          api.get('/wallet')
        ]);
        setPayment(paymentRes.data.data);
        setCustomerWallet(walletRes.data.data);
        
        if (paymentRes.data.data.status === 'SUCCEEDED') {
          setCheckoutStep('success');
        }
      } catch (err) {
        showToast('error', err.response?.data?.error?.message || 'Failed to load checkout details');
      } finally {
        setLoading(false);
      }
    };

    if (paymentId) {
      fetchCheckoutDetails();
    }
  }, [paymentId, showToast]);

  const handlePayment = async () => {
    try {
      setPaying(true);
      const res = await api.post(`/payments/${paymentId}/checkout`);
      setPayment(res.data.data);
      setCheckoutStep('success');
      showToast('success', 'Payment executed successfully!');
    } catch (err) {
      showToast('error', err.response?.data?.error?.message || 'Payment execution failed');
    } finally {
      setPaying(false);
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

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: 'var(--color-bg)' }}>
        <Spinner size="lg" />
      </div>
    );
  }

  if (!payment) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: '1rem', backgroundColor: 'var(--color-bg)' }}>
        <AlertCircle size={48} style={{ color: 'var(--color-danger)' }} />
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Invalid Checkout Link</h2>
        <p style={{ color: 'var(--color-text-secondary)' }}>This checkout session could not be found or has expired.</p>
        <button onClick={() => navigate('/wallet')} className="btn btn-primary" style={{ padding: '0.5rem 1rem', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-primary)', color: 'white', border: 'none', cursor: 'pointer' }}>
          Go to Dashboard
        </button>
      </div>
    );
  }

  const paymentAmount = BigInt(payment.amount);
  const availableBalance = customerWallet ? BigInt(customerWallet.available_balance) : 0n;
  const hasSufficientFunds = availableBalance >= paymentAmount;

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f1f5f9',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem 1.5rem'
    }}>
      {/* Checkout Container */}
      <div style={{
        backgroundColor: 'var(--color-surface)',
        borderRadius: 'var(--radius-lg)',
        width: '100%',
        maxWidth: '450px',
        boxShadow: 'var(--shadow-lg)',
        border: '1px solid var(--color-border)',
        overflow: 'hidden'
      }}>
        {checkoutStep === 'pay' ? (
          <div>
            {/* Header / Merchant Brand */}
            <div style={{
              padding: '2rem 1.5rem',
              textAlign: 'center',
              borderBottom: '1px solid var(--color-border)',
              backgroundColor: 'var(--color-primary)',
              color: 'white',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.75rem'
            }}>
              <div style={{
                backgroundColor: 'rgba(255,255,255,0.1)',
                padding: '0.75rem',
                borderRadius: '50%',
                display: 'inline-flex'
              }}>
                <ShoppingBag size={28} />
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', tracking: '0.1em', opacity: 0.8 }}>Pay to</div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>{payment.businessName || 'Sandbox Merchant'}</h2>
              </div>
              <div style={{ fontSize: '1.875rem', fontWeight: 800, marginTop: '0.5rem' }}>
                {formatCentsToUSD(payment.amount)}
              </div>
              {payment.reference && (
                <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>Ref: {payment.reference}</div>
              )}
            </div>

            {/* Body */}
            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* Payment Method Details */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Payment Method</h3>
                
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1rem',
                  backgroundColor: 'var(--color-bg)'
                }}>
                  <Wallet size={24} style={{ color: 'var(--color-secondary)' }} />
                  <div style={{ flexGrow: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>FinCore Sandbox Wallet</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                      Available Balance: {formatCentsToUSD(availableBalance.toString())}
                    </div>
                  </div>
                </div>
              </div>

              {/* Insufficient Funds Warning */}
              {!hasSufficientFunds && (
                <div style={{
                  display: 'flex',
                  gap: '0.75rem',
                  backgroundColor: 'var(--color-danger-bg)',
                  border: '1px solid var(--color-danger)',
                  borderRadius: 'var(--radius-md)',
                  padding: '0.875rem',
                  color: 'var(--color-danger)',
                  fontSize: '0.875rem'
                }}>
                  <AlertCircle size={20} style={{ flexShrink: 0 }} />
                  <div>
                    <div style={{ fontWeight: 700 }}>Insufficient Funds</div>
                    <div>Your sandbox wallet does not have enough balance to cover this check.</div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <button
                  onClick={handlePayment}
                  disabled={paying || !hasSufficientFunds}
                  style={{
                    width: '100%',
                    backgroundColor: paying || !hasSufficientFunds ? 'var(--color-border)' : 'var(--color-accent)',
                    color: paying || !hasSufficientFunds ? 'var(--color-text-secondary)' : 'white',
                    border: 'none',
                    borderRadius: 'var(--radius-md)',
                    padding: '0.875rem',
                    fontSize: '1rem',
                    fontWeight: 700,
                    cursor: paying || !hasSufficientFunds ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    transition: 'var(--transition-fast)'
                  }}
                >
                  {paying ? <Spinner size="sm" /> : <CreditCard size={18} />}
                  {paying ? 'Processing...' : `Pay ${formatCentsToUSD(payment.amount)}`}
                </button>

                <button
                  onClick={() => navigate('/wallet')}
                  disabled={paying}
                  style={{
                    width: '100%',
                    backgroundColor: 'transparent',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    padding: '0.875rem',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color: 'var(--color-text-secondary)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.25rem',
                    transition: 'var(--transition-fast)'
                  }}
                >
                  <ArrowLeft size={16} /> Cancel and return to Wallet
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Payment Success View */
          <div style={{
            padding: '3rem 2rem',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1.5rem'
          }}>
            <div style={{
              backgroundColor: 'var(--color-success-bg)',
              color: 'var(--color-success)',
              padding: '1rem',
              borderRadius: '50%',
              display: 'inline-flex',
              animation: 'scaleIn 0.3s ease'
            }}>
              <ShieldCheck size={48} />
            </div>

            <div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-text-primary)' }}>
                Payment Succeeded
              </h2>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                Your sandbox wallet transfer has been recorded.
              </p>
            </div>

            {/* Recipient details summary */}
            <div style={{
              width: '100%',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              padding: '1rem 1.25rem',
              backgroundColor: 'var(--color-bg)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
              fontSize: '0.875rem',
              textAlign: 'left'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>Merchant:</span>
                <span style={{ fontWeight: 600 }}>{payment.businessName}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>Paid Amount:</span>
                <span style={{ fontWeight: 700, color: 'var(--color-success)' }}>{formatCentsToUSD(payment.amount)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>Payment ID:</span>
                <span style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{payment.id}</span>
              </div>
            </div>

            <button
              onClick={() => navigate('/wallet')}
              style={{
                width: '100%',
                backgroundColor: 'var(--color-primary)',
                color: 'white',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                padding: '0.75rem',
                fontSize: '0.875rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'var(--transition-fast)'
              }}
            >
              Return to Sandbox Wallet
            </button>
          </div>
        )}
      </div>

      <div style={{ marginTop: '1.5rem', fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
        <span>Secure Sandbox Checkout</span>
      </div>
    </div>
  );
};
