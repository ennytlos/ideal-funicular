'use client';

import { useSearchParams, useRouter } from 'next/navigation';

export default function PaymentSuccessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const bookId = searchParams.get('bookId');
  const seriesId = searchParams.get('seriesId');
  const type = searchParams.get('type'); // 'read', 'download', or 'series'

  const handleNavigateToPurchase = () => {
    if (seriesId) {
      router.push(`/series/${seriesId}`);
    } else if (bookId) {
      router.push(`/books/${bookId}`);
    }
  };

  const handleBackToCatalog = () => {
    router.push('/books');
  };

  const displayText = seriesId 
    ? 'Your purchase is confirmed. You now have access to this series.'
    : `Your purchase is confirmed. You now have access to this ${type === 'download' ? 'download' : 'book'}.`;

  const buttonText = seriesId
    ? '📚 View Series'
    : (type === 'download' ? '📥 Download Now' : '📖 Read Book');

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
      <h1 style={{ fontSize: '2.5rem', marginBottom: '1rem', color: '#2ecc71' }}>
        ✅ Payment Successful!
      </h1>
      <p style={{ fontSize: '1.2rem', marginBottom: '2rem', color: '#555' }}>
        {displayText}
      </p>

      {(bookId || seriesId) && (
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
          <button
            className="btn btn-primary"
            onClick={handleNavigateToPurchase}
            style={{ padding: '0.75rem 2rem', fontSize: '1rem' }}
          >
            {buttonText}
          </button>
          <button
            className="btn btn-secondary"
            onClick={handleBackToCatalog}
            style={{ padding: '0.75rem 2rem', fontSize: '1rem' }}
          >
            Back to Catalog
          </button>
        </div>
      )}
    </div>
  );
}
