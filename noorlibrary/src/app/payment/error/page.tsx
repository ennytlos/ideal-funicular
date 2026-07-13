'use client';

import { useSearchParams, useRouter } from 'next/navigation';

export default function PaymentErrorPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reason = searchParams.get('reason') || 'error'; // 'failed' or 'error'
  const bookId = searchParams.get('bookId');
  const seriesId = searchParams.get('seriesId');
  const type = searchParams.get('type');

  const errorTitle = reason === 'failed' ? 'Payment Failed' : 'Payment Error';
  const errorMessage =
    reason === 'failed'
      ? 'Your payment could not be processed. Please check your card details and try again.'
      : 'An unexpected error occurred during payment. Please try again or contact support.';

  const handleRetry = () => {
    // Go back to the book/series page to retry
    if (type === 'series' && seriesId) {
      router.push(`/series/${seriesId}`);
    } else if (bookId) {
      router.push(`/books/${bookId}`);
    } else {
      router.push('/books');
    }
  };

  const handleBackToCatalog = () => {
    router.push('/books');
  };

  return (
    <div
      className="container"
      style={{
        textAlign: 'center',
        paddingTop: '3rem',
        paddingBottom: '3rem',
        minHeight: '60vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <h1 style={{ fontSize: '2.5rem', marginBottom: '1rem', color: '#e74c3c' }}>
        ❌ {errorTitle}
      </h1>
      <p style={{ fontSize: '1.2rem', marginBottom: '2rem', color: '#555', maxWidth: '500px' }}>
        {errorMessage}
      </p>

      <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
        <button
          className="btn btn-primary"
          onClick={handleRetry}
          style={{ padding: '0.75rem 2rem', fontSize: '1rem' }}
        >
          🔄 Try Again
        </button>
        <button
          className="btn btn-secondary"
          onClick={handleBackToCatalog}
          style={{ padding: '0.75rem 2rem', fontSize: '1rem' }}
        >
          Back to Catalog
        </button>
      </div>

      <p style={{ marginTop: '2rem', fontSize: '0.9rem', color: '#888' }}>
        Need help?{' '}
        <a href="mailto:support@noorlibrary.com" style={{ color: '#3498db', textDecoration: 'none' }}>
          Contact support
        </a>
      </p>
    </div>
  );
}
