'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useApp, ShortRead } from '../../context/AppContext';
import { generateReminderBlob } from '../../lib/canvas-helper';

const CATEGORIES = ['All', 'Reflection', 'Hadith', 'Quran', 'Spiritual', 'Other'];

export default function ReminderPage() {
  const { shortReads } = useApp();
  const searchParams = useSearchParams();
  const initialCategory = searchParams?.get('category') || 'All';
  const initialId = searchParams?.get('id');

  const [activeCategory, setActiveCategory] = useState<string>(initialCategory);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [sharingId, setSharingId] = useState<string | null>(null);
  const [shareSuccessId, setShareSuccessId] = useState<string | null>(null);
  const [pageSize, setPageSize] = useState(6);

  const handleCategoryChange = (cat: string) => {
    setActiveCategory(cat);
    setPageSize(6);
  };

  // If a specific ID is requested, we can filter or scroll to it
  const [selectedReminder, setSelectedReminder] = useState<ShortRead | null>(null);

  useEffect(() => {
    if (initialId && shortReads.length > 0) {
      const found = shortReads.find(r => r.id === initialId);
      if (found) {
        setSelectedReminder(found);
        setActiveCategory('All'); // Show it, override category filter if needed
      }
    }
  }, [initialId, shortReads]);

  const filteredReminders = shortReads.filter((r) => {
    if (selectedReminder) {
      return r.id === selectedReminder.id;
    }
    if (activeCategory === 'All') return true;
    return r.category.toLowerCase() === activeCategory.toLowerCase();
  });

  // C5 fix: apply pageSize so not all reminders render at once (was missing .slice)
  const displayedReminders = filteredReminders.slice(0, pageSize);

  const getFontSize = (text: string) => {
    const len = text.length;
    if (len < 80) return 'clamp(1rem, 2.5vw, 1.4rem)';
    if (len < 160) return 'clamp(0.9rem, 2.2vw, 1.2rem)';
    if (len < 300) return 'clamp(0.8rem, 1.9vw, 1.0rem)';
    return 'clamp(0.7rem, 1.6vw, 0.85rem)';
  };

  const handleDownload = async (reminder: ShortRead) => {
    try {
      setDownloadingId(reminder.id);
      const blob = await generateReminderBlob(reminder.content);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `noor-reminder-${reminder.category.toLowerCase()}-${reminder.id.slice(0, 6)}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download failed:', err);
      alert('Failed to generate image download. Please try again.');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleShare = async (reminder: ShortRead) => {
    try {
      setSharingId(reminder.id);
      
      const shareUrl = `${window.location.origin}/reminder?id=${reminder.id}`;
      const libraryUrl = window.location.origin;
      const shareText = `"${reminder.content.trim()}"\n\n— Noor Library\n\nSee more reminders: ${shareUrl}\nExplore the library for more rewarding contents: ${libraryUrl}`;

      // Try native Web Share API
      if (navigator.share) {
        try {
          const blob = await generateReminderBlob(reminder.content);
          const file = new File([blob], 'noor-reminder.jpg', { type: 'image/jpeg' });
          
          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
              files: [file],
              title: 'Noor Library Reminder',
              text: shareText,
            });
            triggerShareFeedback(reminder.id);
            return;
          }
        } catch (fileShareErr) {
          console.warn('File sharing not supported or failed, falling back to link share:', fileShareErr);
          setSharingId(null); // M2 fix: clear loading state so button is not stuck
        }

        // Fallback to text/url sharing
        await navigator.share({
          title: 'Noor Library Reminder',
          text: shareText,
        });
        triggerShareFeedback(reminder.id);
      } else {
        // Fallback: clipboard copying
        await navigator.clipboard.writeText(shareText);
        triggerShareFeedback(reminder.id);
      }
    } catch (err) {
      console.error('Sharing failed:', err);
    } finally {
      setSharingId(null);
    }
  };

  const triggerShareFeedback = (id: string) => {
    setShareSuccessId(id);
    setTimeout(() => setShareSuccessId(null), 2500);
  };

  return (
    <div className="container" style={{ paddingTop: '8rem', paddingBottom: '5rem', flex: 1, minHeight: '80vh' }}>
      
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
        <h1 style={{ fontFamily: 'Outfit', fontSize: '3rem', marginBottom: '1rem', color: 'var(--text-primary)' }}>
          Daily <span style={{ color: 'var(--accent-red)' }}>Reminders</span>
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', maxWidth: '600px', margin: '0 auto' }}>
          Beautiful, downloadable and shareable cards of authentic Islamic wisdom, quotes, and reflections.
        </p>

        {selectedReminder ? (
          <button 
            onClick={() => setSelectedReminder(null)}
            className="btn btn-secondary"
            style={{ marginTop: '1.5rem', padding: '0.5rem 1.25rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
          >
            ← View All Reminders
          </button>
        ) : (
          <div className="dashboard-tab-bar" style={{ justifyContent: 'center', marginTop: '2.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => handleCategoryChange(cat)}
                className={`dashboard-tab-btn ${activeCategory === cat ? 'dashboard-tab-btn-active' : 'dashboard-tab-btn-inactive'}`}
                style={{ padding: '0.5rem 1.25rem', fontSize: '0.95rem' }}
              >
                {cat}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Grid of Reminder Cards */}
      {filteredReminders.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem 1.5rem', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📿</div>
          <p>No reminders found in this category.</p>
        </div>
      ) : (
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 360px))', 
          gap: '2.5rem', 
          justifyContent: 'center' 
        }}>
          {filteredReminders.slice(0, pageSize).map((reminder) => (
            <div 
              key={reminder.id}
              className="glass-card"
              style={{
                display: 'flex',
                flexDirection: 'column',
                borderRadius: 'var(--radius-lg)',
                overflow: 'hidden',
                boxShadow: '0 8px 30px rgba(0, 0, 0, 0.05)',
                transition: 'transform 0.3s ease, box-shadow 0.3s ease',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = '0 12px 40px rgba(0,0,0,0.08)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 8px 30px rgba(0,0,0,0.05)';
              }}
            >
              {/* Category Badge overlay */}
              <div style={{ position: 'relative' }}>
                <span style={{
                  position: 'absolute',
                  top: '1rem',
                  right: '1rem',
                  backgroundColor: 'rgba(255, 255, 255, 0.85)',
                  backdropFilter: 'blur(5px)',
                  color: 'var(--text-primary)',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  padding: '0.25rem 0.75rem',
                  borderRadius: 'var(--radius-full)',
                  zIndex: 2,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                  border: '1px solid var(--border-color)'
                }}>
                  {reminder.category}
                </span>

                {/* Templated Preview Canvas Area */}
                <div style={{
                  position: 'relative',
                  width: '100%',
                  aspectRatio: '2 / 3',
                  backgroundImage: 'url("/images/short-read-template.jpg")',
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}>
                  {/* Text Overlay Section */}
                  <div style={{
                    position: 'absolute',
                    top: '38%',
                    bottom: '18%',
                    left: '8%',
                    right: '8%',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    textAlign: 'center',
                    pointerEvents: 'none',
                  }}>
                    <p style={{
                      fontFamily: 'Georgia, serif',
                      fontSize: getFontSize(reminder.content),
                      lineHeight: 1.5,
                      color: '#221e1a', // Rich branding warm charcoal
                      fontWeight: 500,
                      wordBreak: 'break-word',
                      whiteSpace: 'pre-wrap',
                      maxHeight: '100%',
                      overflow: 'hidden',
                    }}>
                      {reminder.content}
                    </p>
                  </div>
                </div>
              </div>

              {/* Actions Footer */}
              <div style={{
                display: 'flex',
                gap: '0.75rem',
                padding: '1.25rem',
                borderTop: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-primary)',
              }}>
                <button
                  onClick={() => handleDownload(reminder)}
                  disabled={downloadingId !== null}
                  className="btn btn-secondary"
                  style={{
                    flex: 1,
                    padding: '0.625rem',
                    fontSize: '0.875rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    borderRadius: 'var(--radius-md)',
                  }}
                >
                  {downloadingId === reminder.id ? (
                    <>
                      <span className="spinner-border spinner-border-sm" style={{ width: '1rem', height: '1rem', border: '2px solid currentColor', borderRightColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'spin 1s linear infinite' }}></span>
                      Saving...
                    </>
                  ) : (
                    <>
                      <span>📥</span> Download Image
                    </>
                  )}
                </button>

                <button
                  onClick={() => handleShare(reminder)}
                  disabled={sharingId !== null}
                  className="btn btn-primary"
                  style={{
                    padding: '0.625rem 1rem',
                    fontSize: '0.875rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    borderRadius: 'var(--radius-md)',
                  }}
                >
                  {sharingId === reminder.id ? (
                    '...'
                  ) : shareSuccessId === reminder.id ? (
                    'Copied! ✓'
                  ) : (
                    <>
                      <span>🔗</span> Share
                    </>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {filteredReminders.length > pageSize && (
        <div style={{ textAlign: 'center', marginTop: '2.5rem', marginBottom: '2.5rem' }}>
          <button onClick={() => setPageSize(prev => prev + 6)} className="btn btn-secondary" style={{ padding: '0.75rem 2rem', borderRadius: '30px' }}>
            Load More Reminders
          </button>
        </div>
      )}

      {/* Inline styles for custom spinning animation */}
      {/* C1 fix: plain <style> tag — styled-jsx not supported in Next.js App Router */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
