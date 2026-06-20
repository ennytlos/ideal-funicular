'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { useApp, Episode } from '../../../context/AppContext';
import AuthModal from '../../../components/AuthModal';
import dynamic from 'next/dynamic';

const ReaderModal = dynamic(() => import('../../../components/ReaderModal'), {
  ssr: false,
});

export default function SeriesDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { series, user, purchasedSeries, purchaseSeries } = useApp();

  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeEpisode, setActiveEpisode] = useState<Episode | null>(null);

  const seriesId = typeof params.id === 'string' ? params.id : Array.isArray(params.id) ? params.id[0] : '';
  const s = series.find(b => b.id === seriesId);

  if (!s) {
    return (
      <div className="container" style={{ paddingTop: '8rem', textAlign: 'center' }}>
        <h1 style={{ fontSize: '2rem', fontFamily: 'Outfit, sans-serif' }}>Series not found</h1>
        <button className="btn btn-secondary" style={{ marginTop: '1rem' }} onClick={() => router.push('/books')}>
          Back to Catalog
        </button>
      </div>
    );
  }

  const isFree = s.price === 0;
  const hasPurchased = purchasedSeries.includes(s.id);

  const handleFreeAccess = async () => {
    if (!user) { setIsAuthOpen(true); return; }
    setIsProcessing(true);
    try {
      await purchaseSeries(s.id);
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePurchase = async () => {
    if (!user) { setIsAuthOpen(true); return; }
    setIsProcessing(true);
    try {
      const res = await fetch('/api/payment/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seriesId: s.id, type: 'series' }),
      });
      const data = await res.json();
      if (data.url) window.location.assign(data.url);
      else throw new Error(data.error ?? 'Payment init failed');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Payment failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const openEpisode = (ep: Episode) => {
    if (!hasPurchased && !isFree) {
      alert("Please purchase the series to read episodes.");
      return;
    }
    setActiveEpisode(ep);
  };

  return (
    <>
      <div className="container" style={{ paddingTop: '8rem', paddingBottom: '6rem' }}>
        <button 
          onClick={() => router.push('/books')}
          className="btn btn-secondary"
          style={{ marginBottom: '2rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
        >
          &larr; Back to Catalog
        </button>

        <div className="responsive-book-details">
          {/* Cover Column */}
          <div>
            <div className="glass-card" style={{ padding: '0.5rem', marginBottom: '2rem' }}>
              <div style={{ width: '100%', paddingBottom: '140%', position: 'relative', borderRadius: '8px', overflow: 'hidden' }}>
                <Image
                  src={s.coverUrl && s.coverUrl.includes('b-cdn.net') ? `/api/cover/series/${s.id}` : (s.coverUrl || '/noor_logo.png')}
                  alt={s.title}
                  fill
                  style={{ objectFit: 'cover' }}
                  sizes="(max-width: 768px) 100vw, 400px"
                  onError={(e) => { (e.target as HTMLImageElement).src = '/noor_logo.png'; }}
                />
                <div style={{ position: 'absolute', top: '1rem', right: '1rem', zIndex: 2 }}>
                  <span className="badge badge-gold">Series</span>
                </div>
              </div>
            </div>

            <div className="accent-card">
              <h3 style={{ fontFamily: 'Outfit', fontSize: '1.25rem', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>Access Details</h3>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Format</span>
                <span style={{ fontWeight: 600 }}>Multi-part Series</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Total Episodes</span>
                <span style={{ fontWeight: 600 }}>{s.episodes?.length || 0}</span>
              </div>

              {hasPurchased || isFree ? (
                <div style={{ background: 'rgba(34, 197, 94, 0.1)', color: '#166534', padding: '0.75rem', borderRadius: '8px', textAlign: 'center', fontWeight: 600 }}>
                  You have access!
                </div>
              ) : (
                <button
                  onClick={handlePurchase}
                  className="btn btn-primary"
                  style={{ width: '100%', padding: '1rem' }}
                  disabled={isProcessing}
                >
                  {isProcessing ? 'Processing...' : `Purchase Access • ₦${s.price.toLocaleString()}`}
                </button>
              )}
            </div>
          </div>

          {/* Info Column */}
          <div>
            <span style={{ color: 'var(--accent-red)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.85rem' }}>{s.category}</span>
            <h1 style={{ fontFamily: 'Outfit', fontSize: '3.5rem', lineHeight: 1.1, margin: '0.5rem 0', color: 'var(--text-primary)' }}>{s.title}</h1>
            <p style={{ fontSize: '1.25rem', color: 'var(--text-secondary)', marginBottom: '2rem' }}>By {s.author}</p>

            <div style={{ display: 'flex', gap: '2rem', padding: '1.5rem', background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border-color)', marginBottom: '2.5rem' }}>
              <div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Status</div>
                <div style={{ fontWeight: 600, color: 'var(--accent-red)' }}>{hasPurchased ? 'Purchased' : isFree ? 'Free' : 'Premium'}</div>
              </div>
              <div style={{ width: '1px', background: 'var(--border-color)' }} />
              <div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Price</div>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{isFree ? 'Free' : `₦${s.price.toLocaleString()}`}</div>
              </div>
              <div style={{ width: '1px', background: 'var(--border-color)' }} />
              <div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Episodes</div>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{s.episodes?.length || 0} available</div>
              </div>
            </div>

            <div style={{ marginBottom: '3rem' }}>
              <h3 style={{ fontFamily: 'Outfit', fontSize: '1.75rem', marginBottom: '1rem' }}>About this Series</h3>
              <p style={{ lineHeight: 1.7, color: 'var(--text-secondary)', fontSize: '1.05rem' }}>{s.description || 'No description provided.'}</p>
            </div>
            
            <div>
              <h3 style={{ fontFamily: 'Outfit', fontSize: '1.75rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>
                Episodes
              </h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {(s.episodes || []).sort((a,b) => a.episodeNumber - b.episodeNumber).map(ep => (
                  <div key={ep.id} className="glass-card" style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'all 0.2s ease', cursor: 'pointer' }} onClick={() => openEpisode(ep)}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <div style={{ background: 'var(--accent-red-gradient)', color: 'white', width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontFamily: 'Outfit' }}>
                        {ep.episodeNumber}
                      </div>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)' }}>{ep.title}</h4>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{ep.contentType.toUpperCase()} Format</span>
                      </div>
                    </div>
                    <button 
                      className="btn btn-secondary" 
                      onClick={(e) => { e.stopPropagation(); openEpisode(ep); }}
                      style={{ padding: '0.5rem 1rem' }}
                    >
                      {hasPurchased || isFree ? 'Read' : 'Locked'}
                    </button>
                  </div>
                ))}
                
                {(!s.episodes || s.episodes.length === 0) && (
                  <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', border: '1px dashed var(--border-color)', borderRadius: '12px' }}>
                    No episodes have been published for this series yet.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {isAuthOpen && <AuthModal onClose={() => setIsAuthOpen(false)} />}
      {activeEpisode && (
        <ReaderModal 
          book={activeEpisode} 
          seriesId={s.id}
          onClose={() => setActiveEpisode(null)} 
        />
      )}
    </>
  );
}
