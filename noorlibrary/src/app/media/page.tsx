'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import Navbar from '../../components/Navbar';
import AuthModal from '../../components/AuthModal';
import { db } from '../../lib/firebase';
import { doc, collection, getDocs, updateDoc, increment } from 'firebase/firestore';

interface MediaClip {
  id: string;
  title: string;
  description: string;
  videoUrl: string;
  videoPath: string;
  creatorId: string;
  creatorName: string;
  reactions?: Record<string, boolean>;
  bookmarks?: Record<string, boolean>;
  sharesCount?: number;
  viewsCount?: number;
  createdAt: number;
}

export default function MediaFeedPage() {
  const { user } = useApp();
  const [clips, setClips] = useState<MediaClip[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [mutedMap, setMutedMap] = useState<Record<string, boolean>>({});
  const clipsPerPage = 5;

  // Stable refs for videos and observer
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});
  const observerRef = useRef<IntersectionObserver | null>(null);

  // 1. Fetch media collection once on mount
  useEffect(() => {
    const fetchClips = async () => {
      try {
        const q = collection(db, 'media');
        const snapshot = await getDocs(q);
        // C7 fix: only show published clips to public viewers
        const allClips = snapshot.docs
          .map(d => ({ id: d.id, ...d.data() } as MediaClip))
          .filter(c => (c as any).isPublished !== false);
        setClips(allClips);
        setLoading(false);
      } catch (err) {
        console.error('Failed to fetch short media clips:', err);
        setLoading(false);
      }
    };
    fetchClips();
  }, []);

  // 2. Algorithm: score = (likes*3) + (bookmarks*2) + views + (createdAt/10^8)
  const sortedClips = useMemo(() => {
    return [...clips].sort((a, b) => {
      const scoreA = (Object.keys(a.reactions || {}).length * 3)
        + (Object.keys(a.bookmarks || {}).length * 2)
        + (a.viewsCount || 0)
        + (a.createdAt / 100000000);
      const scoreB = (Object.keys(b.reactions || {}).length * 3)
        + (Object.keys(b.bookmarks || {}).length * 2)
        + (b.viewsCount || 0)
        + (b.createdAt / 100000000);
      return scoreB - scoreA;
    });
  }, [clips]);

  // 3. Paginate
  const paginatedClips = useMemo(() => {
    return sortedClips.slice(0, currentPage * clipsPerPage);
  }, [sortedClips, currentPage]);

  // 4. Stable IntersectionObserver — created once, updated via callback
  const handleIntersection = useCallback((entries: IntersectionObserverEntry[]) => {
    entries.forEach(entry => {
      const id = entry.target.getAttribute('data-clip-id');
      if (!id) return;
      const video = videoRefs.current[id];

      if (entry.isIntersecting) {
        // Pause all other videos first
        Object.keys(videoRefs.current).forEach(key => {
          if (key !== id) {
            const other = videoRefs.current[key];
            if (other && !other.paused) other.pause();
          }
        });

        // Auto-play the visible video (muted by default to satisfy browser policy)
        if (video) {
          video.play().catch(() => {
            // Autoplay blocked — user must interact first; this is normal
          });
        }

        // Increment view count once per session
        const sessionKey = `viewed_${id}`;
        if (!sessionStorage.getItem(sessionKey)) {
          sessionStorage.setItem(sessionKey, '1');
          updateDoc(doc(db, 'media', id), { viewsCount: increment(1) }).catch(console.error);
        }
      } else {
        if (video && !video.paused) video.pause();
      }
    });
  }, []);

  // Create/recreate observer only when handler changes (stable)
  useEffect(() => {
    if (loading) return;

    // Disconnect previous observer
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    observerRef.current = new IntersectionObserver(handleIntersection, {
      root: null,
      rootMargin: '0px',
      threshold: 0.6,
    });

    // Observe all currently rendered clip cards
    paginatedClips.forEach(clip => {
      const el = document.getElementById(`clip-card-${clip.id}`);
      if (el) observerRef.current!.observe(el);
    });

    return () => {
      observerRef.current?.disconnect();
    };
  }, [paginatedClips, loading, handleIntersection]);

  // Cleanup all video refs on unmount
  useEffect(() => {
    return () => {
      Object.values(videoRefs.current).forEach(v => {
        if (v) v.pause();
      });
      videoRefs.current = {};
    };
  }, []);

  // 5. Interaction handlers
  const handleLike = async (clip: MediaClip) => {
    if (!user) { setIsAuthOpen(true); return; }
    const reactions = { ...(clip.reactions || {}) };
    if (reactions[user.uid]) delete reactions[user.uid];
    else reactions[user.uid] = true;
    try { await updateDoc(doc(db, 'media', clip.id), { reactions }); }
    catch (err) { console.error('Like failed:', err); }
  };

  const handleBookmark = async (clip: MediaClip) => {
    if (!user) { setIsAuthOpen(true); return; }
    const bookmarks = { ...(clip.bookmarks || {}) };
    if (bookmarks[user.uid]) delete bookmarks[user.uid];
    else bookmarks[user.uid] = true;
    try { await updateDoc(doc(db, 'media', clip.id), { bookmarks }); }
    catch (err) { console.error('Bookmark failed:', err); }
  };

  const handleShare = async (clip: MediaClip) => {
    const shareUrl = `${window.location.origin}/media?id=${clip.id}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: clip.title, text: `"${clip.title}" by ${clip.creatorName} on Noor Library`, url: shareUrl });
      } catch { /* cancelled */ }
    } else {
      try {
        await navigator.clipboard.writeText(shareUrl);
        alert('Clip link copied to clipboard!');
      } catch { alert('Failed to copy link.'); }
    }
    // Increment share count
    try { await updateDoc(doc(db, 'media', clip.id), { sharesCount: increment(1) }); }
    catch { /* non-critical */ }
  };

  const toggleMute = (clipId: string) => {
    setMutedMap(prev => ({ ...prev, [clipId]: !prev[clipId] }));
    const video = videoRefs.current[clipId];
    if (video) video.muted = !video.muted;
  };

  return (
    <>
      {/* Inject keyframe for loading spinner via a real style tag */}
      <style>{`@keyframes noor-spin { to { transform: rotate(360deg); } }`}</style>

      <div style={{ background: '#000', minHeight: '100vh', color: '#fff' }}>
        <Navbar />

        {/* Feed container — fixed height equals viewport minus navbar, scrolls internally with snap */}
        <main
          style={{
            position: 'fixed',
            top: '4rem', // Navbar height
            left: 0,
            right: 0,
            bottom: 0,
            overflowY: 'scroll',
            scrollSnapType: 'y mandatory',
          }}
        >
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
              <span style={{
                width: '3rem', height: '3rem',
                border: '3px solid var(--accent-gold)', borderRightColor: 'transparent',
                borderRadius: '50%', display: 'inline-block',
                animation: 'noor-spin 1s linear infinite'
              }} />
            </div>
          ) : paginatedClips.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100%', padding: '2rem', textAlign: 'center' }}>
              <span style={{ fontSize: '3.5rem' }}>🎬</span>
              <h2 style={{ fontFamily: 'Outfit', marginTop: '1rem', color: '#fff' }}>No Islamic Clips Yet</h2>
              <p style={{ color: 'rgba(255,255,255,0.6)', maxWidth: '400px' }}>Admins and creators haven&apos;t uploaded any vertical clips yet.</p>
            </div>
          ) : (
            <>
              {paginatedClips.map((clip) => {
                const likesCount = Object.keys(clip.reactions || {}).length;
                const bookmarksCount = Object.keys(clip.bookmarks || {}).length;
                const hasLiked = user ? !!clip.reactions?.[user.uid] : false;
                const hasBookmarked = user ? !!clip.bookmarks?.[user.uid] : false;
                const isMuted = mutedMap[clip.id] !== false; // default muted

                return (
                  <div
                    key={clip.id}
                    id={`clip-card-${clip.id}`}
                    data-clip-id={clip.id}
                    style={{
                      height: '100vh',
                      scrollSnapAlign: 'start',
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      position: 'relative',
                      backgroundColor: '#050505',
                    }}
                  >
                    {/* Vertical video wrapper */}
                    <div style={{
                      height: '100%',
                      aspectRatio: '9/16',
                      maxHeight: '100%',
                      position: 'relative',
                      backgroundColor: '#000',
                      overflow: 'hidden',
                      borderRadius: '8px',
                    }}>
                      {/* Video — muted by default for autoplay policy compliance */}
                      <video
                        ref={el => { videoRefs.current[clip.id] = el; }}
                        src={clip.videoUrl}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        loop={false}
                        muted={isMuted}
                        playsInline
                        preload="metadata"
                      />

                      {/* Bottom gradient overlay */}
                      <div style={{
                        position: 'absolute', left: 0, right: 0, bottom: 0, height: '40%',
                        background: 'linear-gradient(transparent, rgba(0,0,0,0.92))',
                        pointerEvents: 'none', zIndex: 1,
                      }} />

                      {/* Creator & clip info (bottom-left) */}
                      <div style={{
                        position: 'absolute', left: '1rem', bottom: '1.75rem', right: '4.5rem',
                        zIndex: 2, pointerEvents: 'none',
                      }}>
                        <h4 style={{ margin: '0 0 0.35rem 0', fontFamily: 'Outfit', fontSize: '1rem', color: 'var(--accent-gold)' }}>
                          @{clip.creatorName}
                        </h4>
                        <p style={{ margin: '0 0 0.2rem 0', fontWeight: 700, fontSize: '0.95rem', color: '#fff' }}>
                          {clip.title}
                        </p>
                        <p style={{ margin: 0, fontSize: '0.82rem', color: 'rgba(255,255,255,0.7)', lineHeight: 1.4 }}>
                          {clip.description}
                        </p>
                      </div>

                      {/* Right interaction bar */}
                      <div style={{
                        position: 'absolute', right: '0.75rem', bottom: '2rem',
                        display: 'flex', flexDirection: 'column', gap: '1.1rem',
                        alignItems: 'center', zIndex: 2,
                      }}>
                        {/* Mute/Unmute toggle */}
                        <button
                          onClick={() => toggleMute(clip.id)}
                          title={isMuted ? 'Unmute' : 'Mute'}
                          style={actionBtnStyle}
                        >
                          <span style={{ fontSize: '1.1rem' }}>{isMuted ? '🔇' : '🔊'}</span>
                          <span style={actionLabelStyle}>Sound</span>
                        </button>

                        {/* Like */}
                        <button onClick={() => handleLike(clip)} style={{ ...actionBtnStyle, color: hasLiked ? '#ff4d6d' : '#fff' }}>
                          <span style={{ fontSize: '1.25rem' }}>❤️</span>
                          <span style={actionLabelStyle}>{likesCount}</span>
                        </button>

                        {/* Bookmark */}
                        <button onClick={() => handleBookmark(clip)} style={{ ...actionBtnStyle, color: hasBookmarked ? 'var(--accent-gold)' : '#fff' }}>
                          <span style={{ fontSize: '1.25rem' }}>🔖</span>
                          <span style={actionLabelStyle}>{bookmarksCount}</span>
                        </button>

                        {/* Share */}
                        <button onClick={() => handleShare(clip)} style={actionBtnStyle}>
                          <span style={{ fontSize: '1.25rem' }}>🔗</span>
                          <span style={actionLabelStyle}>Share</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Load More */}
              {sortedClips.length > paginatedClips.length ? (
                <div style={{ textAlign: 'center', padding: '3rem 1.5rem', backgroundColor: '#050505', scrollSnapAlign: 'start' }}>
                  <button
                    onClick={() => setCurrentPage(p => p + 1)}
                    className="btn btn-secondary"
                    style={{ padding: '0.75rem 2rem', borderRadius: '30px', border: '1px solid rgba(255,255,255,0.1)' }}
                  >
                    Load More Clips
                  </button>
                </div>
              ) : sortedClips.length > 0 ? (
                <div style={{ textAlign: 'center', padding: '3.5rem 1.5rem', backgroundColor: '#050505', color: 'rgba(255,255,255,0.5)', scrollSnapAlign: 'start', fontFamily: 'Outfit' }}>
                  <span style={{ display: 'block', fontSize: '1.5rem', marginBottom: '0.5rem' }}>✨</span>
                  <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 500 }}>You&apos;re all caught up for today!</p>
                </div>
              ) : null}
            </>
          )}
        </main>

        {isAuthOpen && <AuthModal onClose={() => setIsAuthOpen(false)} />}
      </div>
    </>
  );
}

// Shared styles for interaction buttons
const actionBtnStyle: React.CSSProperties = {
  background: 'rgba(0,0,0,0.45)',
  border: '1px solid rgba(255,255,255,0.12)',
  color: '#fff',
  width: '44px',
  height: '44px',
  borderRadius: '50%',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  backdropFilter: 'blur(8px)',
  transition: 'transform 0.15s, background 0.15s',
  padding: 0,
};

const actionLabelStyle: React.CSSProperties = {
  fontSize: '0.7rem',
  color: 'rgba(255,255,255,0.75)',
  marginTop: '0.1rem',
  fontWeight: 600,
  lineHeight: 1,
};
