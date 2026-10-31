import Link from 'next/link';

export default function NotFound() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1.5rem', textAlign: 'center', padding: '2rem' }}>
      <p style={{ fontFamily: 'Outfit', fontSize: '7rem', fontWeight: 700, color: 'var(--accent-red)', lineHeight: 1, margin: 0 }}>404</p>
      <h1 style={{ fontFamily: 'Outfit', fontSize: '2rem', color: 'var(--text-primary)', margin: 0 }}>Page Not Found</h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', maxWidth: '400px' }}>
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <Link href="/" className="btn btn-primary" style={{ minWidth: '160px', textDecoration: 'none' }}>
        Back to Home
      </Link>
    </div>
  );
}
