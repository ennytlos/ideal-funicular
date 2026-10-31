'use client';

import React, { useState, useEffect, useRef } from 'react';
import Navbar from '../../components/Navbar';
import { ReportContentButton } from '../../components/ReportContentModal';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';

interface MediaClip {
  id: string;
  title: string;
  description: string;
  videoUrl: string;
  creatorName: string;
  likesCount?: number;
  bookmarksCount?: number;
  sharesCount?: number;
  createdAt?: number;
}

export default function MediaFeedPage() {
  const [clips, setClips] = useState<MediaClip[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const q = query(collection(db, 'media'), orderBy('createdAt', 'desc'), limit(10));
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const fetched = snapshot.docs
            .map((d) => ({ id: d.id, ...d.data() } as MediaClip))
            .filter((c: any) => c.isPublished !== false);
          setClips(fetched);
          setLoading(false);
        },
        (err) => {
          console.warn('Firestore fetch media clips error:', err);
          setLoading(false);
        }
      );
      return () => unsubscribe();
    } catch (e) {
      console.warn('Media query error:', e);
      setLoading(false);
    }
  }, []);

  const triggerDisabledAction = (actionName: string) => {
    setNotice(`${actionName} is disabled during the preview. Coming soon!`);
    setTimeout(() => setNotice(null), 3000);
  };

  return (
    <div style={{ background: '#0B0F19', minHeight: '100vh', color: '#fff' }}>
      <Navbar />

      {/* Floating Notice Toast */}
      {notice && (
        <div
          style={{
            position: 'fixed',
            top: '5rem',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 9999,
            background: 'rgba(15, 23, 42, 0.95)',
            border: '1px solid var(--accent-gold)',
            color: '#fff',
            padding: '0.65rem 1.5rem',
            borderRadius: '30px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
            fontSize: '0.85rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span>✨</span>
          <span>{notice}</span>
        </div>
      )}

      <main
        style={{
          paddingTop: '5.5rem',
          paddingBottom: '3rem',
          minHeight: 'calc(100vh - 4rem)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        {/* Top Coming Soon Banner */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 18px',
            borderRadius: '24px',
            background: 'rgba(212, 175, 55, 0.12)',
            border: '1px solid rgba(212, 175, 55, 0.35)',
            color: 'var(--accent-gold)',
            fontSize: '0.8rem',
            fontWeight: 700,
            marginBottom: '1.5rem',
            letterSpacing: '0.05em',
          }}
        >
          <span>✦ SHORT CLIPS FEED</span>
          <span>•</span>
          <span>COMING SOON (PREVIEW MODE)</span>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '4rem 1rem' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                border: '3px solid rgba(212, 175, 55, 0.2)',
                borderTopColor: 'var(--accent-gold)',
                animation: 'spin 1s linear infinite',
                margin: '0 auto 1rem auto',
              }}
            />
            <p style={{ color: '#94A3B8', fontSize: '0.9rem' }}>Loading clips...</p>
          </div>
        ) : clips.length === 0 ? (
          <div
            className="glass-card"
            style={{
              maxWidth: '520px',
              width: '90%',
              textAlign: 'center',
              padding: '3rem 2rem',
              borderRadius: '24px',
              border: '1px solid rgba(212, 175, 55, 0.25)',
              background: 'rgba(22, 31, 48, 0.75)',
            }}
          >
            <div
              style={{
                width: '76px',
                height: '76px',
                borderRadius: '50%',
                background: 'rgba(212, 175, 55, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '2.25rem',
                margin: '0 auto 1.5rem auto',
                border: '1px solid rgba(212, 175, 55, 0.25)',
              }}
            >
              🎬
            </div>
            <h2 style={{ fontFamily: 'Outfit', fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.75rem' }}>
              Short Clips Coming Soon
            </h2>
            <p style={{ color: '#94A3B8', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '1.75rem' }}>
              Distraction-free, bite-sized Islamic reminders and scholar lectures will appear here when published.
            </p>
            <button
              className="btn btn-secondary"
              disabled
              style={{ opacity: 0.65, cursor: 'not-allowed', padding: '0.65rem 1.5rem', fontSize: '0.85rem' }}
            >
              🔒 Video Feed Disabled (Coming Soon)
            </button>
          </div>
        ) : (
          <div
            ref={containerRef}
            style={{
              width: '100%',
              maxWidth: '460px',
              height: '76vh',
              maxHeight: '760px',
              borderRadius: '20px',
              overflow: 'hidden',
              position: 'relative',
              background: '#000',
              boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            {clips.map((clip, idx) => {
              if (idx !== activeIndex) return null;
              return (
                <div key={clip.id} style={{ width: '100%', height: '100%', position: 'relative' }}>
                  <video
                    src={clip.videoUrl}
                    playsInline
                    autoPlay
                    loop
                    muted={isMuted}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />

                  {/* Sound Toggle Button */}
                  <button
                    onClick={() => setIsMuted((prev) => !prev)}
                    style={{
                      position: 'absolute',
                      top: '16px',
                      right: '16px',
                      background: 'rgba(0,0,0,0.55)',
                      border: '1px solid rgba(255,255,255,0.2)',
                      color: '#fff',
                      borderRadius: '50%',
                      width: '38px',
                      height: '38px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1rem',
                      zIndex: 10,
                    }}
                    title={isMuted ? 'Unmute' : 'Mute'}
                  >
                    {isMuted ? '🔇' : '🔊'}
                  </button>

                  {/* Right Action Sidebar (Disabled with Feedback) */}
                  <div
                    style={{
                      position: 'absolute',
                      right: '12px',
                      bottom: '80px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '16px',
                      alignItems: 'center',
                      zIndex: 10,
                    }}
                  >
                    <button
                      onClick={() => triggerDisabledAction('Liking clips')}
                      style={{
                        background: 'rgba(0,0,0,0.5)',
                        border: '1px solid rgba(255,255,255,0.2)',
                        color: '#fff',
                        width: '46px',
                        height: '46px',
                        borderRadius: '50%',
                        cursor: 'not-allowed',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        opacity: 0.85,
                      }}
                      title="Like (Coming Soon)"
                    >
                      <span style={{ fontSize: '1.25rem' }}>🤍</span>
                    </button>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>{clip.likesCount || 0}</span>

                    <button
                      onClick={() => triggerDisabledAction('Bookmarking clips')}
                      style={{
                        background: 'rgba(0,0,0,0.5)',
                        border: '1px solid rgba(255,255,255,0.2)',
                        color: '#fff',
                        width: '46px',
                        height: '46px',
                        borderRadius: '50%',
                        cursor: 'not-allowed',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        opacity: 0.85,
                      }}
                      title="Bookmark (Coming Soon)"
                    >
                      <span style={{ fontSize: '1.25rem' }}>🔖</span>
                    </button>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>{clip.bookmarksCount || 0}</span>

                    <button
                      onClick={() => triggerDisabledAction('Sharing clips')}
                      style={{
                        background: 'rgba(0,0,0,0.5)',
                        border: '1px solid rgba(255,255,255,0.2)',
                        color: '#fff',
                        width: '46px',
                        height: '46px',
                        borderRadius: '50%',
                        cursor: 'not-allowed',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        opacity: 0.85,
                      }}
                      title="Share (Coming Soon)"
                    >
                      <span style={{ fontSize: '1.25rem' }}>↗</span>
                    </button>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>{clip.sharesCount || 0}</span>

                    <ReportContentButton
                      contentId={clip.id}
                      contentTitle={clip.title}
                      contentType="media"
                      compact
                      label="Flag"
                    />
                  </div>

                  {/* Bottom Metadata Panel */}
                  <div
                    style={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      bottom: 0,
                      padding: '1.5rem 1.25rem',
                      background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0) 100%)',
                      paddingRight: '70px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <div
                        style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          background: 'var(--accent-red)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                        }}
                      >
                        {clip.creatorName ? clip.creatorName.charAt(0).toUpperCase() : 'U'}
                      </div>
                      <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{clip.creatorName || 'Scholar'}</span>
                      <span
                        style={{
                          fontSize: '0.65rem',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          background: 'rgba(14, 165, 233, 0.2)',
                          color: '#38bdf8',
                          fontWeight: 700,
                        }}
                      >
                        VERIFIED
                      </span>
                    </div>

                    <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 4px 0' }}>{clip.title}</h3>
                    <p
                      style={{
                        fontSize: '0.8rem',
                        color: '#cbd5e1',
                        margin: 0,
                        lineHeight: 1.4,
                        overflow: 'hidden',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                      }}
                    >
                      {clip.description}
                    </p>
                  </div>
                </div>
              );
            })}

            {/* Navigation Dots if Multiple Clips */}
            {clips.length > 1 && (
              <div
                style={{
                  position: 'absolute',
                  top: '16px',
                  left: '16px',
                  display: 'flex',
                  gap: '4px',
                  zIndex: 10,
                }}
              >
                {clips.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveIndex(i)}
                    style={{
                      width: i === activeIndex ? '20px' : '8px',
                      height: '6px',
                      borderRadius: '3px',
                      background: i === activeIndex ? 'var(--accent-gold)' : 'rgba(255,255,255,0.4)',
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
