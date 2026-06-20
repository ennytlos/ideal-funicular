'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Book, useApp } from '../context/AppContext';

interface BookCardProps {
  book: Book;
}

export default function BookCard({ book }: BookCardProps) {
  const { purchasedBooks } = useApp();
  const isFree = book.price === 0;
  const isPurchased = purchasedBooks.includes(book.id);

  return (
    <div className="glass-card book-card-item">
      {/* Cover Image */}
      <div className="book-card-cover-container">
        <Image
          src={book.coverUrl.startsWith('http') && !book.coverUrl.includes('noorlibrary.b-cdn.net') ? book.coverUrl : `/api/cover/${book.id}`}
          alt={book.title}
          fill
          sizes="(max-width: 768px) 50vw, 33vw"
          className="book-card-cover-img"
          onError={(e) => { (e.target as HTMLImageElement).src = '/noor_logo.png'; }}
        />
        
        {/* Status Badge */}
        <div className="book-card-badge-container">
          {isFree ? (
            <span className="badge badge-free">Free Read</span>
          ) : isPurchased ? (
            <span className="badge badge-gold">Purchased</span>
          ) : (
            <span className="badge badge-premium">Premium</span>
          )}
        </div>
      </div>

      {/* Book details */}
      <div className="book-card-details">
        <span className="book-card-category">{book.category}</span>
        <h3 className="book-card-title">{book.title}</h3>
        <p className="book-card-author">By {book.author}</p>

        <div className="book-card-meta-row">
          <span className="book-card-pages">{book.pages} pages</span>
          <span className="book-card-price">
            {isFree ? <span style={{ color: 'var(--accent-gold)' }}>Free</span> : `₦${book.price.toLocaleString()}`}
          </span>
        </div>

        {(() => {
          const handleShare = async (e: React.MouseEvent) => {
            e.preventDefault();
            const shareData = {
              title: `${book.title} by ${book.author}`,
              text: `Read "${book.title}" by ${book.author} on Noor Library!`,
              url: `${window.location.origin}/books/${book.id}`
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
                alert('Book link copied to clipboard!');
              } catch {
                // Clipboard not available
              }
            }
          };

          return (
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              <Link href={`/books/${book.id}`} className="btn btn-secondary book-card-btn" style={{ flex: 1, marginTop: 0 }}>
                View Details
              </Link>
              <button
                onClick={handleShare}
                className="btn btn-secondary"
                style={{ padding: '0.6rem', aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                title="Share Book"
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
