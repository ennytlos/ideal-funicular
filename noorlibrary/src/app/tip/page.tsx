'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useApp } from '../../context/AppContext';

const CURRENCY = 'NGN';
const SYMBOL = '₦';
const PREDEFINED_AMOUNTS = [5000, 10000, 25000, 50000];
const MIN_AMOUNT = 2000;

export default function TipPage() {
  const { user } = useApp();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [amount, setAmount] = useState<number>(5000);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [donorEmail, setDonorEmail] = useState('');
  const [message, setMessage] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [successAmount, setSuccessAmount] = useState<number>(5000);

  // Check URL params for success/failure redirects from Paystack
  useEffect(() => {
    const paymentStatus = searchParams.get('payment');
    if (paymentStatus === 'success') {
      setSuccess(true);
      const amt = searchParams.get('amount');
      if (amt) setSuccessAmount(parseFloat(amt));
      router.replace('/tip', { scroll: false });
    } else if (paymentStatus === 'failed') {
      alert('Tipping payment was unsuccessful. Please try again.');
      router.replace('/tip', { scroll: false });
    } else if (paymentStatus === 'error') {
      alert('An error occurred during payment verification.');
      router.replace('/tip', { scroll: false });
    }
  }, [searchParams, router]);

  const handleAmountSelect = (val: number) => {
    setAmount(val);
    setCustomAmount('');
  };

  const handleCustomAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCustomAmount(val);
    const num = parseInt(val, 10);
    if (!isNaN(num)) {
      setAmount(num);
    } else {
      setAmount(0);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amount < MIN_AMOUNT) {
      alert(`The minimum tipping amount is ${SYMBOL}${MIN_AMOUNT.toLocaleString()}.`);
      return;
    }
    if (!user && !donorEmail) {
      alert("Please provide an email address so we can process your payment receipt.");
      return;
    }

    setIsProcessing(true);
    try {
      const res = await fetch('/api/payment/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'tip',
          amount,
          message,
          email: user?.email || donorEmail,
          currency: CURRENCY,
        }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data.error ?? 'Payment initialization failed');
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Payment initialization failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (success) {
    return (
      <div className="container" style={{ paddingTop: '10rem', paddingBottom: '6rem', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="glass-card" style={{ maxWidth: '500px', width: '100%', textAlign: 'center', padding: '2.5rem 1.5rem' }}>
          <div style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            background: 'rgba(34, 197, 94, 0.1)',
            color: '#16a34a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 2rem auto'
          }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
          <h2 style={{ fontFamily: 'Outfit', fontSize: '2.5rem', marginBottom: '1rem', color: 'var(--text-primary)' }}>Jazakallah Khair!</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', marginBottom: '2rem', lineHeight: '1.6' }}>
            Thank you so much for your generous support of {SYMBOL}{successAmount.toLocaleString()}. Your contribution helps us continue maintaining the library and sharing authentic Islamic knowledge globally.
          </p>
          <button className="btn btn-primary" onClick={() => { setSuccess(false); setMessage(''); setAmount(5000); setCustomAmount(''); setDonorEmail(''); }}>
            Support Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ paddingTop: '8rem', paddingBottom: '6rem', flex: 1 }}>
      <div style={{ maxWidth: '600px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <h1 style={{ fontFamily: 'Outfit', fontSize: '2.5rem', marginBottom: '1rem', color: 'var(--text-primary)' }}>
            Support the <span style={{ color: 'var(--accent-red)' }}>Library</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', lineHeight: '1.6' }}>
            If you&apos;ve found value in Noor Library, consider supporting us. Your contributions help maintain our platform, acquire new authentic texts, and spread Islamic knowledge.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="glass-card" style={{ padding: '2.5rem 1.5rem' }}>
          {/* Guest Email Field */}
          {!user && (
            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label className="form-label" htmlFor="tip-email">Your Email Address</label>
              <input
                id="tip-email"
                type="email"
                className="form-input"
                required
                placeholder="name@example.com"
                value={donorEmail}
                onChange={(e) => setDonorEmail(e.target.value)}
              />
            </div>
          )}

          {/* Currency display — fixed Naira */}
          <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
            <span style={{ fontSize: '1.5rem' }}>₦</span>
            <div>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'Outfit' }}>Nigerian Naira (NGN)</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>All transactions are processed in Naira via Paystack</div>
            </div>
          </div>

          <div style={{ marginBottom: '2rem' }}>
            <label style={{ display: 'block', fontFamily: 'Outfit', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '1rem' }}>
              Select Amount
            </label>
            <div className="tip-predefined-grid">
              {PREDEFINED_AMOUNTS.map(val => (
                <button
                  key={val}
                  type="button"
                  onClick={() => handleAmountSelect(val)}
                  style={{
                    padding: '1rem',
                    borderRadius: 'var(--radius-md)',
                    border: `2px solid ${amount === val && customAmount === '' ? 'var(--accent-red)' : 'var(--border-color)'}`,
                    background: amount === val && customAmount === '' ? 'rgba(220, 38, 38, 0.05)' : 'var(--bg-secondary)',
                    color: amount === val && customAmount === '' ? 'var(--accent-red)' : 'var(--text-primary)',
                    fontFamily: 'Outfit',
                    fontSize: '1.25rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'var(--transition-fast)'
                  }}
                >
                  {SYMBOL}{val.toLocaleString()}
                </button>
              ))}
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <input
                type="number"
                placeholder={`Or enter a custom amount (min ₦${MIN_AMOUNT.toLocaleString()})`}
                className="form-input"
                value={customAmount}
                onChange={handleCustomAmountChange}
                min={MIN_AMOUNT}
              />
              {customAmount && amount < MIN_AMOUNT && (
                <div style={{ color: 'var(--accent-red)', fontSize: '0.85rem', marginTop: '0.5rem' }}>
                  Minimum amount is {SYMBOL}{MIN_AMOUNT.toLocaleString()}
                </div>
              )}
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '2rem' }}>
            <label className="form-label">Message (Optional)</label>
            <textarea
              className="form-input"
              rows={4}
              placeholder="Leave a note of encouragement..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              style={{ resize: 'vertical' }}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', fontSize: '1.1rem', padding: '1rem' }}
            disabled={isProcessing || amount <= 0}
          >
            {isProcessing ? 'Redirecting to checkout...' : `Support with ${SYMBOL}${amount.toLocaleString()}`}
          </button>
        </form>
      </div>
    </div>
  );
}
