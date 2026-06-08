'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useApp, formatDisplayName, Book } from '../../context/AppContext';
type JsonChapter = { title?: string; pages?: string[] };
import dynamic from 'next/dynamic';

const ReaderModal = dynamic(() => import('../../components/ReaderModal'), {
  ssr: false,
});

export default function UserDashboard() {
  const { user, books, series, purchasedBooks, purchasedSeries, downloadedBooks, removePurchasedBook, removePurchasedSeries, removeDownloadedBook, isLoading } = useApp();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'library' | 'downloads' | 'series'>('library');
  const [selectedBookToRead, setSelectedBookToRead] = useState<Book | null>(null);

  const handleShare = async (id: string, title: string, author: string) => {
    const shareData = {
      title: `${title} by ${author}`,
      text: `Read "${title}" by ${author} on Noor Library!`,
      url: `${window.location.origin}/books/${id}`
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

  const handleDownload = async (bookId: string) => {
    try {
      const book = books.find(b => b.id === bookId);
      const res = await fetch(`/api/read/${bookId}`);
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
          let plainText = `${book?.title || 'Book'}\nBy ${book?.author || 'Author'}\n\n`;
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
      const filename = book ? `${book.title.replace(/[^a-zA-Z0-9-_]/g, '_')}.${extension}` : `${bookId}.${extension}`;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      alert('Download failed. Please try again.');
    }
  };

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/');
    }
  }, [user, isLoading, router]);

  if (isLoading || !user) {
    return (
      <div className="loading-container">
        <p className="loading-text">Loading your dashboard...</p>
      </div>
    );
  }

  const myLibrary = books.filter(b => purchasedBooks.includes(b.id));
  const myDownloads = books.filter(b => downloadedBooks.includes(b.id));
  const mySeriesList = series.filter(s => purchasedSeries.includes(s.id));

  return (
    <div className="container dashboard-container">
      <div className="dashboard-welcome">
        <h1 className="dashboard-welcome-h1">
          Welcome back, <span>{formatDisplayName(user)}</span>
        </h1>
        <p className="dashboard-welcome-p">
          Manage your personal library and downloads below.
        </p>
      </div>

      <div className="dashboard-tab-bar">
        <button
          onClick={() => setActiveTab('library')}
          className={`dashboard-tab-btn ${activeTab === 'library' ? 'dashboard-tab-btn-active' : 'dashboard-tab-btn-inactive'}`}
        >
          My Online Library ({myLibrary.length})
        </button>
        <button
          onClick={() => setActiveTab('series')}
          className={`dashboard-tab-btn ${activeTab === 'series' ? 'dashboard-tab-btn-active' : 'dashboard-tab-btn-inactive'}`}
        >
          My Series ({mySeriesList.length})
        </button>
        <button
          onClick={() => setActiveTab('downloads')}
          className={`dashboard-tab-btn ${activeTab === 'downloads' ? 'dashboard-tab-btn-active' : 'dashboard-tab-btn-inactive'}`}
        >
          My Downloads ({myDownloads.length})
        </button>
      </div>

      {activeTab === 'library' && (
        <div>
          {myLibrary.length === 0 ? (
            <div className="glass-card dashboard-empty-card">
              <h3 className="dashboard-empty-h3">Your library is empty</h3>
              <p className="dashboard-empty-p">You haven&apos;t added any books to your online library yet.</p>
              <button className="btn btn-primary" onClick={() => router.push('/books')}>Browse Catalog</button>
            </div>
          ) : (
            <div className="dashboard-grid">
              {myLibrary.map(book => (
                <div key={book.id} className="glass-card dashboard-book-card">
                  {/* Cover Image */}
                  <div className="dashboard-book-cover-container">
                    <Image
                      src={book.coverUrl.startsWith('http') && !book.coverUrl.includes('noorlibrary.b-cdn.net') ? book.coverUrl : `/api/cover/${book.id}`}
                      alt={book.title}
                      fill
                      sizes="(max-width: 768px) 50vw, 33vw"
                      className="dashboard-book-cover-image"
                      onError={(e) => { (e.target as HTMLImageElement).src = '/noor_logo.png'; }}
                    />
                  </div>

                  <div className="dashboard-book-info">
                    <span className="dashboard-book-category">
                      {book.category}
                    </span>
                    <h3 className="dashboard-book-title">
                      {book.title}
                    </h3>
                    <p className="dashboard-book-author">
                      By {book.author}
                    </p>

                    <div className="dashboard-actions-column">
                      <div className="dashboard-actions-row">
                        <button
                          onClick={() => setSelectedBookToRead(book)}
                          className="btn btn-primary dashboard-action-btn-read"
                        >
                          Read Now
                        </button>
                        <button
                          onClick={() => router.push(`/books/${book.id}`)}
                          className="btn btn-secondary dashboard-action-btn-details"
                          title="View Details"
                        >
                          Details
                        </button>
                        <button
                          onClick={() => handleShare(book.id, book.title, book.author)}
                          className="btn btn-secondary dashboard-action-btn-share"
                          title="Share Book"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="18" cy="5" r="3" />
                            <circle cx="6" cy="12" r="3" />
                            <circle cx="18" cy="19" r="3" />
                            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                          </svg>
                        </button>
                      </div>
                      <button
                        onClick={async () => {
                          if (confirm(`Are you sure you want to remove "${book.title}" from your online library?`)) {
                            await removePurchasedBook(book.id);
                          }
                        }}
                        className="btn btn-secondary dashboard-action-btn-remove"
                      >
                        Remove from Library
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'downloads' && (
        <div>
          {myDownloads.length === 0 ? (
            <div className="glass-card dashboard-empty-card">
              <h3 className="dashboard-empty-h3">No downloads yet</h3>
              <p className="dashboard-empty-p">Purchase PDF downloads from the catalog to see them here.</p>
              <button className="btn btn-primary" onClick={() => router.push('/books')}>Browse Catalog</button>
            </div>
          ) : (
            <div className="dashboard-grid">
              {myDownloads.map(book => (
                <div key={book.id} className="glass-card dashboard-book-card-downloads">
                  <h3 className="dashboard-book-title-downloads">{book.title}</h3>
                  <p className="dashboard-book-category-downloads">{book.category}</p>
                  <div className="dashboard-actions-column">
                    <div className="dashboard-actions-row">
                      <button className="btn btn-secondary download-card-actions" onClick={() => handleDownload(book.id)}>
                        Download {book.contentType === 'json' ? 'Text File' : 'PDF'}
                      </button>
                      <button
                        onClick={() => handleShare(book.id, book.title, book.author)}
                        className="btn btn-secondary dashboard-action-btn-share"
                        title="Share Book"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="18" cy="5" r="3" />
                          <circle cx="6" cy="12" r="3" />
                          <circle cx="18" cy="19" r="3" />
                          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                        </svg>
                      </button>
                    </div>
                    <button
                      onClick={async () => {
                        if (confirm(`Are you sure you want to remove "${book.title}" from your downloads?`)) {
                          await removeDownloadedBook(book.id);
                        }
                      }}
                      className="btn btn-secondary dashboard-action-btn-remove"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'series' && (
        <div>
          {mySeriesList.length === 0 ? (
            <div className="glass-card dashboard-empty-card">
              <h3 className="dashboard-empty-h3">No Series yet</h3>
              <p className="dashboard-empty-p">Purchase series access from the catalog to see them here.</p>
              <button className="btn btn-primary" onClick={() => router.push('/books')}>Browse Catalog</button>
            </div>
          ) : (
            <div className="dashboard-grid">
              {mySeriesList.map(s => (
                <div key={s.id} className="glass-card dashboard-book-card">
                  {/* Cover Image */}
                  <div className="dashboard-book-cover-container">
                    <Image
                      src={s.coverUrl && s.coverUrl.includes('b-cdn.net') ? `/api/cover/series/${s.id}` : (s.coverUrl || '/noor_logo.png')}
                      alt={s.title}
                      fill
                      sizes="(max-width: 768px) 50vw, 33vw"
                      className="dashboard-book-cover-image"
                      onError={(e) => { (e.target as HTMLImageElement).src = '/noor_logo.png'; }}
                    />
                  </div>

                  <div className="dashboard-book-info">
                    <span className="dashboard-book-category">{s.category}</span>
                    <h3 className="dashboard-book-title">{s.title}</h3>
                    <p className="dashboard-book-author">By {s.author}</p>

                    <div className="dashboard-actions-column">
                      <div className="dashboard-actions-row">
                        <button
                          onClick={() => router.push(`/series/${s.id}`)}
                          className="btn btn-primary dashboard-action-btn-read"
                        >
                          Read Episodes
                        </button>
                      </div>
                      <button
                        onClick={async () => {
                          if (confirm(`Are you sure you want to remove "${s.title}" from your series collection?`)) {
                            await removePurchasedSeries(s.id);
                          }
                        }}
                        className="btn btn-secondary dashboard-action-btn-remove"
                      >
                        Remove from Library
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {selectedBookToRead && (
        <ReaderModal book={selectedBookToRead} onClose={() => setSelectedBookToRead(null)} />
      )}
    </div>
  );
}
