'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { useApp } from '../../../context/AppContext';
import AuthModal from '../../../components/AuthModal';
import dynamic from 'next/dynamic';
import { db } from '../../../lib/firebase';
import { doc, onSnapshot, setDoc, deleteDoc, collection, query, where } from 'firebase/firestore';

type JsonChapter = { title?: string; pages?: string[] };

const ReaderModal = dynamic(() => import('../../../components/ReaderModal'), {
  ssr: false,
});

export default function BookDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { books, user, purchasedBooks, downloadedBooks, purchaseBook, courses, enrolledCourses, isLoading } = useApp();

  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isReaderOpen, setIsReaderOpen] = useState(false);

  const [isFollowing, setIsFollowing] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportReason, setReportReason] = useState<'stolen' | 'abusive' | 'inaccurate' | 'other'>('stolen');
  const [reportDetails, setReportDetails] = useState('');
  const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);
  const [messageSubject, setMessageSubject] = useState('');
  const [messageText, setMessageText] = useState('');
  const [isSendingReport, setIsSendingReport] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [followerCount, setFollowerCount] = useState<number>(0);

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

  useEffect(() => {
    if (!user || !book?.creatorId) return;
    const followDocRef = doc(db, 'follows', `${user.uid}_${book.creatorId}`);
    const unsubscribe = onSnapshot(followDocRef, (snapshot) => {
      setIsFollowing(snapshot.exists());
    });
    return unsubscribe;
  }, [user, book?.creatorId]);

  useEffect(() => {
    if (!book?.creatorId) return;
    const q = query(collection(db, 'follows'), where('creatorId', '==', book.creatorId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setFollowerCount(snapshot.size);
    }, (err) => {
      console.warn("Failed to listen to followers snapshot:", err);
    });
    return unsubscribe;
  }, [book?.creatorId]);

  const handleFollowToggle = async () => {
    if (!user) {
      setIsAuthOpen(true);
      return;
    }
    if (!book?.creatorId) return;
    if (user.uid === book.creatorId) {
      alert("You cannot follow yourself.");
      return;
    }
    const followDocRef = doc(db, 'follows', `${user.uid}_${book.creatorId}`);
    try {
      if (isFollowing) {
        await deleteDoc(followDocRef);
      } else {
        await setDoc(followDocRef, {
          userId: user.uid,
          creatorId: book.creatorId,
          createdAt: Date.now()
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!book) return;
    if (!user) {
      setIsAuthOpen(true);
      return;
    }
    setIsSendingReport(true);
    try {
      const reportRef = doc(collection(db, 'reports'));
      await setDoc(reportRef, {
        id: reportRef.id,
        contentId: book.id,
        contentTitle: book.title,
        contentType: 'book',
        reporterId: user.uid,
        reporterEmail: user.email,
        reason: reportReason,
        details: reportDetails,
        createdAt: Date.now(),
        status: 'pending'
      });
      alert('Report submitted successfully.');
      setIsReportModalOpen(false);
      setReportDetails('');
    } catch (err: any) {
      alert(err.message || 'Failed to submit report');
    } finally {
      setIsSendingReport(false);
    }
  };

  const handleMessageSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!book) return;
    if (!user) {
      setIsAuthOpen(true);
      return;
    }
    // M4 fix: validate message text before submitting
    if (!messageText.trim()) {
      alert('Please enter a message before sending.');
      return;
    }
    if (!book.creatorId) return;
    setIsSendingMessage(true);
    try {
      const msgRef = doc(collection(db, 'messages'));
      await setDoc(msgRef, {
        id: msgRef.id,
        senderId: user.uid,
        senderName: user.displayName || user.email.split('@')[0],
        recipientId: book.creatorId,
        messageText: messageText,
        subject: messageSubject || `Inquiry about ${book.title}`,
        createdAt: Date.now()
      });
      
      const notifRef = doc(collection(db, 'notifications'));
      await setDoc(notifRef, {
        id: notifRef.id,
        senderId: user.uid,
        senderName: user.displayName || user.email.split('@')[0],
        title: `New Message regarding: ${book.title}`,
        message: messageText.substring(0, 100),
        type: 'direct',
        targetId: book.creatorId,
        createdAt: Date.now()
      });

      alert('Message sent successfully to the author!');
      setIsMessageModalOpen(false);
      setMessageText('');
      setMessageSubject('');
    } catch (err: any) {
      alert(err.message || 'Failed to send message');
    } finally {
      setIsSendingMessage(false);
    }
  };

  // C6 fix: show loading skeleton while books are still fetching from Firestore
  if (!book && isLoading) {
    return (
      <div className="container" style={{ paddingTop: '8rem', textAlign: 'center', minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
          <div style={{ width: '3rem', height: '3rem', borderRadius: '50%', border: '3px solid var(--border-color)', borderTopColor: 'var(--accent-gold)', animation: 'spin 1s linear infinite' }} />
          <p style={{ color: 'var(--text-muted)' }}>Loading book details...</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

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

  const isSubscription = book.paymentInterval === 'monthly' || book.paymentInterval === 'yearly';
  const isSubActive = (() => {
    if (user?.role === 'admin' || (user?.role === 'creator' && book.creatorId === user?.uid)) return true;
    if (user?.subscriptions && user.subscriptions[book.id]) {
      return user.subscriptions[book.id] > Date.now();
    }
    return false;
  })();
  const hasReadAccess = isFree || (isSubscription ? isSubActive : hasPurchased) || user?.role === 'admin' || (user?.role === 'creator' && book.creatorId === user?.uid);

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
      if (data.url) window.location.assign(data.url); // Redirect to Paystack
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
      if (data.url) window.location.assign(data.url);
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

      const contentType = res.headers.get('content-type') || '';
      let downloadBlob: Blob;
      let extension = book?.contentType === 'json' ? 'txt' : 'pdf';

      if (contentType.includes('application/json')) {
        const data = await res.json();
        if (data.url) {
          // Fetch from CDN directly (CORS must be enabled on Bunny CDN Pull Zone)
          const fileRes = await fetch(data.url);
          downloadBlob = await fileRes.blob();
        } else {
          // JSON text book chapters
          let plainText = `${book.title}\nBy ${book.author}\n\n`;
          const chapters = Array.isArray(data) ? data as JsonChapter[] : (data.chapters as JsonChapter[]) || [];
          chapters.forEach((chapter) => {
            plainText += `\n--- ${chapter.title || 'Chapter'} ---\n\n`;
            if (Array.isArray(chapter.pages)) {
              chapter.pages.forEach((page: string) => {
                plainText += `${page}\n\n`;
              });
            }
          });
          downloadBlob = new Blob([plainText], { type: 'text/plain' });
          extension = 'txt';
        }
      } else {
        const blob = await res.blob();
        downloadBlob = blob;
        if (book?.contentType === 'json') {
          try {
            const textData = await blob.text();
            const parsed = JSON.parse(textData);
              const chapters = Array.isArray(parsed) ? parsed as JsonChapter[] : (parsed.chapters as JsonChapter[]) || [];
            
            let plainText = `${book.title}\nBy ${book.author}\n\n`;
            chapters.forEach((chapter) => {
              plainText += `\n--- ${chapter.title || 'Chapter'} ---\n\n`;
              if (Array.isArray(chapter.pages)) {
                chapter.pages.forEach((page: string) => {
                  plainText += `${page}\n\n`;
                });
              }
            });
            downloadBlob = new Blob([plainText], { type: 'text/plain' });
            extension = 'txt';
          } catch (e) {
            console.error("Failed to parse JSON for text conversion", e);
          }
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
                  <span className="access-row-value">
                    {isFree ? 'Free' : `₦${book.price.toLocaleString()}${isSubscription ? ` / ${book.paymentInterval === 'monthly' ? 'month' : 'year'}` : ''}`}
                  </span>
                </div>
                {hasReadAccess ? (
                  <button className="btn btn-secondary access-btn-full access-btn-purchased" onClick={handleReadNow}>
                    Read Now {isSubscription && isSubActive && '(Subscribed ✓)'}
                  </button>
                ) : (
                  <button 
                    className="btn btn-primary access-btn-full" 
                    onClick={isFree ? handleFreeAccess : handlePurchase} 
                    disabled={isProcessing}
                  >
                    {isProcessing ? 'Processing...' : (isFree ? 'Add to Library (Free)' : (isSubscription ? `Subscribe (${book.paymentInterval})` : 'Purchase to Read'))}
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                <p className="detail-author" style={{ margin: 0 }}>By {book.author}</p>
                {book.creatorId && book.creatorId !== 'admin' && (
                  <span 
                    style={{ 
                      padding: '0.25rem 0.75rem', 
                      fontSize: '0.8rem', 
                      borderRadius: '20px', 
                      background: 'rgba(255, 255, 255, 0.05)', 
                      border: '1px solid var(--border-color)',
                      display: 'inline-flex', 
                      alignItems: 'center', 
                      gap: '0.25rem',
                      color: 'var(--text-secondary)'
                    }}
                  >
                    👤 {followerCount} {followerCount === 1 ? 'follower' : 'followers'}
                  </span>
                )}
                {book.creatorId && book.creatorId !== 'admin' && book.creatorId !== user?.uid && (
                  <button 
                    onClick={handleFollowToggle} 
                    className="btn btn-secondary" 
                    style={{ padding: '0.25rem 0.75rem', fontSize: '0.8rem', borderRadius: '20px', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                  >
                    {isFollowing ? '✓ Following' : '+ Follow'}
                  </button>
                )}
                <button 
                  onClick={() => setIsReportModalOpen(true)} 
                  className="btn btn-secondary" 
                  style={{ padding: '0.25rem 0.75rem', fontSize: '0.8rem', borderRadius: '20px', color: 'var(--accent-red)', borderColor: 'rgba(220, 38, 38, 0.2)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                >
                  ⚠ Report
                </button>
                {(() => {
                  const isEnrolledInCreatorsCourse = courses.some(
                    c => c.creatorId === book.creatorId && enrolledCourses.includes(c.id)
                  );
                  return book.creatorId && book.creatorId !== user?.uid && isEnrolledInCreatorsCourse && (
                    <button 
                      onClick={() => setIsMessageModalOpen(true)} 
                      className="btn btn-secondary" 
                      style={{ padding: '0.25rem 0.75rem', fontSize: '0.8rem', borderRadius: '20px', color: 'var(--accent-gold)', borderColor: 'rgba(212, 163, 89, 0.2)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                    >
                      ✉ Message Author
                    </button>
                  );
                })()}
              </div>
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

      {/* Content Report Modal */}
      {isReportModalOpen && (
        <div className="modal-backdrop">
          <div className="glass-card modal-dialog" style={{ maxWidth: '450px', padding: '2rem', borderRadius: '12px' }}>
            <div className="modal-header">
              <h2 className="modal-title">Report Content</h2>
              <button onClick={() => setIsReportModalOpen(false)} className="modal-close-btn">&times;</button>
            </div>
            <form onSubmit={handleReportSubmit} className="modal-form">
              <div className="form-group">
                <label className="form-label" htmlFor="report-reason">Reason for Reporting</label>
                <select 
                  id="report-reason"
                  className="form-input"
                  value={reportReason}
                  onChange={e => setReportReason(e.target.value as any)}
                >
                  <option value="stolen">Stolen or Plagiarized Content</option>
                  <option value="abusive">Abusive or Inappropriate Content</option>
                  <option value="inaccurate">Inaccurate Teachings or Information</option>
                  <option value="other">Other Violation</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="report-details">Provide Details</label>
                <textarea 
                  id="report-details"
                  className="form-input"
                  rows={4}
                  required
                  placeholder="Explain why this content should be reviewed..."
                  value={reportDetails}
                  onChange={e => setReportDetails(e.target.value)}
                />
              </div>
              <button type="submit" className="btn btn-primary modal-form-submit-btn" disabled={isSendingReport}>
                {isSendingReport ? 'Submitting...' : 'Submit Report'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Message Creator Modal */}
      {isMessageModalOpen && (
        <div className="modal-backdrop">
          <div className="glass-card modal-dialog" style={{ maxWidth: '450px', padding: '2rem', borderRadius: '12px' }}>
            <div className="modal-header">
              <h2 className="modal-title">Message Author</h2>
              <button onClick={() => setIsMessageModalOpen(false)} className="modal-close-btn">&times;</button>
            </div>
            <form onSubmit={handleMessageSubmit} className="modal-form">
              <div className="form-group">
                <label className="form-label" htmlFor="msg-subject">Subject</label>
                <input 
                  id="msg-subject"
                  type="text"
                  className="form-input"
                  required
                  placeholder="e.g. Question about page 24"
                  value={messageSubject}
                  onChange={e => setMessageSubject(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="msg-text">Message</label>
                <textarea 
                  id="msg-text"
                  className="form-input"
                  rows={4}
                  required
                  placeholder="Write your message here..."
                  value={messageText}
                  onChange={e => setMessageText(e.target.value)}
                />
              </div>
              <button type="submit" className="btn btn-primary modal-form-submit-btn" disabled={isSendingMessage}>
                {isSendingMessage ? 'Sending...' : 'Send Message'}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
