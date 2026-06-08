'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Series, useApp } from '../context/AppContext';

interface SeriesCardProps {
  series: Series;
}

export default function SeriesCard({ series }: SeriesCardProps) {
  const { purchasedSeries } = useApp();
  const isFree = series.price === 0;
  const isPurchased = purchasedSeries.includes(series.id);

  return (
    <div className="glass-card book-card-item">
      {/* Cover Image */}
      <div className="book-card-cover-container">
        <Image
          src={series.coverUrl && series.coverUrl.includes('b-cdn.net') ? `/api/cover/series/${series.id}` : (series.coverUrl || '/noor_logo.png')}
          alt={series.title}
          fill
          sizes="(max-width: 768px) 50vw, 33vw"
          className="book-card-cover-img"
          onError={(e) => { (e.target as HTMLImageElement).src = '/noor_logo.png'; }}
        />
        
        {/* Status Badge */}
        <div className="book-card-badge-container">
          <span className="badge badge-gold" style={{ marginBottom: '0.25rem' }}>Series</span>
          {isFree ? (
            <span className="badge badge-free">Free Access</span>
          ) : isPurchased ? (
            <span className="badge badge-gold">Purchased</span>
          ) : (
            <span className="badge badge-premium">Premium</span>
          )}
        </div>
      </div>

      {/* Series details */}
      <div className="book-card-details">
        <span className="book-card-category">{series.category}</span>
        <h3 className="book-card-title">{series.title}</h3>
        <p className="book-card-author">By {series.author}</p>

        <div className="book-card-meta-row">
          <span className="book-card-pages">{series.episodes?.length || 0} episodes</span>
          <span className="book-card-price">
            {isFree ? <span style={{ color: 'var(--accent-gold)' }}>Free</span> : `₦${series.price.toLocaleString()}`}
          </span>
        </div>

        {(() => {
          const handleShare = async (e: React.MouseEvent) => {
            e.preventDefault();
            const shareData = {
              title: `${series.title} by ${series.author}`,
              text: `Read the series "${series.title}" by ${series.author} on Noor Library!`,
              url: `${window.location.origin}/series/${series.id}`
            };

            if (navigator.share) {
              try {
                await navigator.share(shareData);
              } catch {
                // Share cancelled or failed silently
              }
            } else {
              try {
                await navigator.clipboard.writeText(shareData.url);
                alert('Series link copied to clipboard!');
              } catch {
                // Clipboard not available
              }
            }
          };

          return (
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              <Link href={`/series/${series.id}`} className="btn btn-secondary book-card-btn" style={{ flex: 1, marginTop: 0 }}>
                View Series
              </Link>
              <button
                onClick={handleShare}
                className="btn btn-secondary"
                style={{ padding: '0.6rem', aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                title="Share Series"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="18" cy="5" r="3" />
                  <circle cx="6" cy="12" r="3" />
                  <circle cx="18" cy="19" r="3" />
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                  <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                </svg>
              </button>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
