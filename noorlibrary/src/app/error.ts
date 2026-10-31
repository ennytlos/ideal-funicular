'use client';

export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1.5rem', textAlign: 'center', padding: '2rem' }}>
      <h1 style={{ fontFamily: 'Outfit', fontSize: '2.5rem', color: 'var(--text-primary)' }}>Something went wrong</h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', maxWidth: '480px' }}>
        An unexpected error occurred. Please try refreshing the page.
      </p>
      <button
        onClick={reset}
        className="btn btn-primary"
        style={{ minWidth: '160px' }}
      >
        Try Again
      </button>
    </div>
  );
}
