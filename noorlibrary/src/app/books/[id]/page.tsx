'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { useApp } from '../../../context/AppContext';
import AuthModal from '../../../components/AuthModal';
import dynamic from 'next/dynamic';

const ReaderModal = dynamic(() => import('../../../components/ReaderModal'), {
  ssr: false,
});

export default function BookDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { books, user, purchasedBooks, downloadedBooks, purchaseBook } = useApp();

  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isReaderOpen, setIsReaderOpen] = useState(false);
  const [paymentNotice, setPaymentNotice] = useState<'success' | 'failed' | 'error' | null>(null);

  // Show payment result banner from Paystack redirect
  useEffect(() => {
    const status = searchParams.get('payment') as 'success' | 'failed' | 'error' | null;
    if (status) {
      setPaymentNotice(status);
      // Remove from URL without re-render
      router.replace(window.location.pathname, { scroll: false });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleShare = async () => {
    if (!book) return;
    const shareData = {
      title: `${book.title} by ${book.author}`,
      text: `Read "${book.title}" by ${book.author} on Noor Library!`,
      url: window.location.href
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

  // In Next.js, params.id could be string | string[]
  const bookId = typeof params.id === 'string' ? params.id : Array.isArray(params.id) ? params.id[0] : '';
  const book = books.find(b => b.id === bookId);

  if (!book) {
    return (
      <div className="container not-found-container">
        <h1 className="not-found-title">Book not found</h1>
        <button className="btn btn-secondary not-found-btn" onClick={() => router.push('/books')}>
          Back to Catalog
        </button>
      </div>
    );
  }

  const isFree = book.price === 0;
  const hasPurchased = purchasedBooks.includes(book.id);
  const hasDownloaded = downloadedBooks.includes(book.id);

  /** For free books — grant access directly via Firestore */
  const handleFreeAccess = async () => {
    if (!user) { setIsAuthOpen(true); return; }
    setIsProcessing(true);
    try {
      await purchaseBook(book.id);
    } finally {
      setIsProcessing(false);
    }
  };

  /** For paid books — redirect to Paystack checkout */
  const handlePurchase = async () => {
    if (!user) { setIsAuthOpen(true); return; }
    setIsProcessing(true);
    try {
      const res = await fetch('/api/payment/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookId: book.id, type: 'read' }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url; // Redirect to Paystack
      else throw new Error(data.error ?? 'Payment init failed');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Payment failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  /** For paid PDF downloads — redirect to Paystack */
  const handleDownloadPurchase = async () => {
    if (!user) { setIsAuthOpen(true); return; }
    setIsProcessing(true);
    try {
      const res = await fetch('/api/payment/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookId: book.id, type: 'download' }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else throw new Error(data.error ?? 'Payment init failed');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Payment failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReadNow = () => {
    if (!user) { setIsAuthOpen(true); return; }
    setIsReaderOpen(true);
  };

  /** Download purchased PDF via server-side proxy */
  const handleDownload = async () => {
    if (!user) { setIsAuthOpen(true); return; }
    try {
      const res = await fetch(`/api/read/${book.id}`);
      if (!res.ok) {
        let errMsg = 'Download failed. Please try again.';
        try {
          const data = await res.json();
          errMsg = data.error || errMsg;
        } catch {}
        alert(errMsg);
        return;
      }
      const blob = await res.blob();
      let downloadBlob = blob;
      let extension = book?.contentType === 'json' ? 'txt' : 'pdf';

      if (book?.contentType === 'json') {
        try {
          const textData = await blob.text();
          const parsed = JSON.parse(textData);
          const chapters = Array.isArray(parsed) ? parsed : parsed.chapters || [];
          
          let plainText = `${book.title}\nBy ${book.author}\n\n`;
          chapters.forEach((chapter: any) => {
            plainText += `\n--- ${chapter.title || 'Chapter'} ---\n\n`;
            if (Array.isArray(chapter.pages)) {
              chapter.pages.forEach((page: string) => {
                plainText += `${page}\n\n`;
              });
            }
          });
          downloadBlob = new Blob([plainText], { type: 'text/plain' });
        } catch (e) {
          console.error("Failed to parse JSON for text conversion", e);
        }
      }

      const url = window.URL.createObjectURL(downloadBlob);
      const a = document.createElement('a');
      a.href = url;
      const safeTitle = book.title.replace(/[^a-zA-Z0-9-_]/g, '_');
      a.download = `${safeTitle}.${extension}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      alert('Download failed. Please try again.');
    }
  };

  return (
    <>
      <div className="container detail-container">
        <button 
          onClick={() => router.push('/books')}
          className="detail-back-btn"
        >
          &larr; Back to Catalog
        </button>

        {paymentNotice === 'success' && (
          <div className="alert alert-success">
            <strong>Payment Successful!</strong> The book has been added to your library.
          </div>
        )}
        {paymentNotice === 'failed' && (
          <div className="alert alert-danger">
            <strong>Payment Failed.</strong> Please check your payment details or try again.
          </div>
        )}
        {paymentNotice === 'error' && (
          <div className="alert alert-danger">
            <strong>Payment Error.</strong> An unexpected error occurred during verification.
          </div>
        )}

        <div className="responsive-book-details">
          
          {/* Left Column: Cover & Actions */}
          <div className="detail-left-column">
            <div className="detail-cover-wrapper">
              <Image 
                src={book.coverUrl.startsWith('http') && !book.coverUrl.includes('noorlibrary.b-cdn.net') ? book.coverUrl : `/api/cover/${book.id}`} 
                alt={book.title}
                fill
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                className="cover-fit"
                priority
                onError={(e) => { (e.target as HTMLImageElement).src = '/noor_logo.png'; }}
              />
            </div>

            <div className="glass-card access-card-container">
              <h3 className="access-card-title">
                Access this Book
              </h3>

              {/* Online Reading Access */}
              <div className="access-section">
                <div className="access-row">
                  <span className="access-row-label">Online Access</span>
                  <span className="access-row-value">{isFree ? 'Free' : `₦${book.price.toLocaleString()}`}</span>
                </div>
                {hasPurchased ? (
                  <button className="btn btn-secondary access-btn-full access-btn-purchased" onClick={handleReadNow}>
                    Read Now
                  </button>
                ) : (
                  <button 
                    className="btn btn-primary access-btn-full" 
                    onClick={isFree ? handleFreeAccess : handlePurchase} 
                    disabled={isProcessing}
                  >
                    {isProcessing ? 'Processing...' : (isFree ? 'Add to Library (Free)' : 'Purchase to Read')}
                  </button>
                )}
              </div>

              <div className="access-divider" />

              {/* File Download Access */}
              <div className="access-section">
                <div className="access-row">
                  <span className="access-row-label">{book.contentType === 'json' ? 'Text File Download' : 'PDF Download'}</span>
                  <span className="access-row-value">₦{book.downloadPrice.toLocaleString()}</span>
                </div>
                {hasDownloaded ? (
                  <button className="btn btn-secondary access-btn-full" onClick={handleDownload}>
                    Download {book.contentType === 'json' ? 'Text File' : 'PDF'}
                  </button>
                ) : (
                  <button className="btn btn-gold access-btn-full" onClick={handleDownloadPurchase} disabled={isProcessing}>
                    {isProcessing ? 'Processing...' : 'Purchase Download'}
                  </button>
                )}
              </div>

              <div className="access-divider" />

              <button 
                className="btn btn-secondary access-btn-full" 
                onClick={handleShare}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="18" cy="5" r="3" />
                  <circle cx="6" cy="12" r="3" />
                  <circle cx="18" cy="19" r="3" />
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                  <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                </svg>
                Share this Book
              </button>
            </div>
          </div>

          {/* Right Column: Details */}
          <div className="detail-right-column">
            <div>
              <span className="badge badge-premium detail-badge">{book.category}</span>
              <h1 className="detail-title">
                {book.title}
              </h1>
              <p className="detail-author">By {book.author}</p>
            </div>

            <div className="info-pill-container">
              <div>
                <p className="info-pill-label">Pages</p>
                <p className="info-pill-value">{book.pages}</p>
              </div>
              <div className="info-pill-divider" />
              <div>
                <p className="info-pill-label">Language</p>
                <p className="info-pill-value">{book.language}</p>
              </div>
              <div className="info-pill-divider" />
              <div>
                <p className="info-pill-label">Status</p>
                <p className="info-pill-value-status">{isFree ? 'Free to Read' : 'Premium'}</p>
              </div>
            </div>

            <div>
              <h2 className="detail-about-title">About this Book</h2>
              <p className="detail-about-text">
                {book.description}
              </p>
            </div>
          </div>
        </div>
      </div>

      {isAuthOpen && <AuthModal onClose={() => setIsAuthOpen(false)} />}
      {isReaderOpen && <ReaderModal book={book} onClose={() => setIsReaderOpen(false)} />}
    </>
  );
}
