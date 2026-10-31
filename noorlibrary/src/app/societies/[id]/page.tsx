'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import Navbar from '../../../components/Navbar';
import AuthModal from '../../../components/AuthModal';
import { ReportContentButton } from '../../../components/ReportContentModal';
import { useApp } from '../../../context/AppContext';
import { db } from '../../../lib/firebase';
import { getSocietyUrl } from '../../../lib/links';
import { doc, getDoc, collection, query, where, getDocs, onSnapshot, setDoc, deleteDoc } from 'firebase/firestore';
import { FEATURE_FLAGS } from '../../../constants/features';
import dynamic from 'next/dynamic';

const ReaderModal = dynamic(() => import('../../../components/ReaderModal'), {
  ssr: false,
});

interface Society {
  id: string;
  displayName: string;
  description?: string;
  leaderName?: string;
  email: string;
  socialProfile?: string;
  bankName?: string;
  accountName?: string;
  accountNumber?: string;
}

interface WeeklyProgram {
  id: string;
  title: string;
  dayOfWeek: string;
  time: string;
  description: string;
  attachedPrayers?: string;
}

interface Book {
  id: string;
  title: string;
  author: string;
  coverUrl: string;
  pdfPath: string;
  contentType?: 'pdf' | 'json';
  jsonPath?: string;
  category: string;
  price: number;
}

interface SocietyPost {
  id: string;
  title: string;
  content: string;
  createdAt: number;
}

export default function SocietyProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useApp();
  const societyId = params.id as string;

  const [society, setSociety] = useState<Society | null>(null);
  const [loadingSoc, setLoadingSoc] = useState(true);

  // Tabs
  const [activeTab, setActiveTab] = useState<'programs' | 'books' | 'updates'>('programs');

  // Content states
  const [programs, setPrograms] = useState<WeeklyProgram[]>([]);
  const [booksList, setBooksList] = useState<Book[]>([]);
  const [posts, setPosts] = useState<SocietyPost[]>([]);
  const [loadingContent, setLoadingContent] = useState(true);

  // Follow states
  const [isFollowing, setIsFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);

  // Reader / Audio Player states
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [playingAudio, setPlayingAudio] = useState<string | null>(null); // URL of playing audio
  const [playingAudioTitle, setPlayingAudioTitle] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Modal Auth
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  // 1. Fetch Society Profile
  useEffect(() => {
    if (!societyId) return;
    const fetchSoc = async () => {
      try {
        const docSnap = await getDoc(doc(db, 'users', societyId));
        if (docSnap.exists() && docSnap.data().role === 'society') {
          const data = docSnap.data();
          setSociety({
            id: docSnap.id,
            displayName: data.displayName || data.societyName || docSnap.id,
            description: data.description || '',
            leaderName: data.leaderName || '',
            email: data.email || '',
            socialProfile: data.socialProfile || '',
            bankName: data.bankName || '',
            accountName: data.accountName || '',
            accountNumber: data.accountNumber || ''
          });
        } else {
          router.push('/societies');
        }
      } catch (err) {
        console.error("Error loading society profile:", err);
      } finally {
        setLoadingSoc(false);
      }
    };
    fetchSoc();
  }, [societyId, router]);

  // 2. Real-time follow states
  useEffect(() => {
    if (!societyId) return;

    // Follower count query
    const countQuery = query(collection(db, 'follows'), where('creatorId', '==', societyId));
    const unsubscribeCount = onSnapshot(countQuery, (snap) => {
      setFollowerCount(snap.size);
    }, (err) => console.error("Followers load failed:", err));

    // Current user follow status
    let unsubscribeUser = () => {};
    if (user) {
      const followDocRef = doc(db, 'follows', `${user.uid}_${societyId}`);
      unsubscribeUser = onSnapshot(followDocRef, (snap) => {
        setIsFollowing(snap.exists());
      });
    } else {
      setIsFollowing(false);
    }

    return () => {
      unsubscribeCount();
      unsubscribeUser();
    };
  }, [societyId, user]);

  // 3. Load Tab Content
  useEffect(() => {
    if (!societyId) return;
    setLoadingContent(true);

    let unsubPrograms = () => {};
    let unsubBooks = () => {};
    let unsubPosts = () => {};

    if (activeTab === 'programs') {
      const q = query(collection(db, 'weekly_programs'), where('societyId', '==', societyId));
      unsubPrograms = onSnapshot(q, (snap) => {
        setPrograms(snap.docs.map(d => ({ id: d.id, ...d.data() } as WeeklyProgram)));
        setLoadingContent(false);
      });
    } else if (activeTab === 'books') {
      const q = query(collection(db, 'books'), where('creatorId', '==', societyId));
      unsubBooks = onSnapshot(q, (snap) => {
        setBooksList(snap.docs.map(d => ({ id: d.id, ...d.data() } as Book)));
        setLoadingContent(false);
      });
    } else if (activeTab === 'updates') {
      const q = query(collection(db, 'society_posts'), where('societyId', '==', societyId));
      unsubPosts = onSnapshot(q, (snap) => {
        const fetched = snap.docs.map(d => ({ id: d.id, ...d.data() } as SocietyPost));
        fetched.sort((a, b) => b.createdAt - a.createdAt);
        setPosts(fetched);
        setLoadingContent(false);
      });
    }

    return () => {
      unsubPrograms();
      unsubBooks();
      unsubPosts();
    };
  }, [societyId, activeTab]);

  // Handle Follow Toggle
  const handleFollowToggle = async () => {
    if (!user) {
      setIsAuthOpen(true);
      return;
    }
    if (user.uid === societyId) {
      alert("You cannot follow your own society.");
      return;
    }

    const followDocRef = doc(db, 'follows', `${user.uid}_${societyId}`);
    try {
      if (isFollowing) {
        await deleteDoc(followDocRef);
      } else {
        await setDoc(followDocRef, {
          id: `${user.uid}_${societyId}`,
          userId: user.uid,
          creatorId: societyId,
          createdAt: Date.now()
        });
      }
    } catch (err: any) {
      alert("Failed to update follow: " + (err.message || String(err)));
    }
  };

  const handleShare = async () => {
    if (!society) return;
    const shareUrl = getSocietyUrl(society.id);
    const shareData = {
      title: society.displayName,
      text: `Connect with ${society.displayName} on Noor Library!`,
      url: shareUrl,
    };

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {
        // Cancelled
      }
    } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(shareUrl);
        alert('Society link copied to clipboard!');
      } catch {
        // Clipboard error
      }
    }
  };

  // Play Audio file helper (Bunny CDN url mapping)
  const togglePlayAudio = (filePath: string, title: string) => {
    const fullUrl = filePath.startsWith('http') ? filePath : `https://noorlibrary.b-cdn.net/${filePath}`;
    
    if (playingAudio === fullUrl) {
      // Pause
      audioRef.current?.pause();
      setPlayingAudio(null);
      setPlayingAudioTitle(null);
    } else {
      // Play new
      if (audioRef.current) {
        audioRef.current.pause();
      }
      const newAudio = new Audio(fullUrl);
      newAudio.play().catch(e => console.error("Audio block:", e));
      audioRef.current = newAudio;
      setPlayingAudio(fullUrl);
      setPlayingAudioTitle(title);
      
      // Auto reset on finish
      newAudio.onended = () => {
        setPlayingAudio(null);
        setPlayingAudioTitle(null);
      };
    }
  };

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  if (!FEATURE_FLAGS.SOCIETIES_PORTAL) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
        <Navbar />
        <div className="container" style={{ paddingTop: '120px', paddingBottom: '5rem', textAlign: 'center' }}>
          <div
            className="glass-card"
            style={{
              maxWidth: '580px',
              margin: '0 auto',
              padding: '3.5rem 2rem',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid rgba(212, 175, 55, 0.25)',
            }}
          >
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🕌</div>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '4px 14px',
                borderRadius: '20px',
                background: 'rgba(212, 175, 55, 0.15)',
                color: 'var(--accent-gold)',
                fontSize: '0.8rem',
                fontWeight: 700,
                marginBottom: '1rem',
              }}
            >
              COMING SOON
            </div>
            <h1 style={{ fontFamily: 'Outfit', fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
              Society Portals In Preparation
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', lineHeight: 1.6, marginBottom: '2rem' }}>
              Individual organization portals, verified weekly programs, and community schedules are currently being curated for authentic publication.
            </p>
            <Link href="/societies" className="btn btn-primary" style={{ padding: '0.75rem 1.75rem', borderRadius: '10px' }}>
              ← Return to Societies Directory
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (loadingSoc) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Loading society profile...</p>
      </div>
    );
  }

  if (!society) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Society not found.</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <Navbar />

      <div className="container" style={{ paddingTop: '100px', paddingBottom: '7rem' }}>
        {/* Profile Card Header */}
        <section className="glass-card" style={{ padding: '2.5rem 2rem', borderRadius: 'var(--radius-lg)', marginBottom: '2.5rem', display: 'flex', gap: '2rem', flexWrap: 'wrap', alignItems: 'center', border: '1px solid var(--border-color)' }}>
          <div style={{ width: '80px', height: '80px', borderRadius: '20px', background: 'rgba(212, 175, 55, 0.1)', color: 'var(--accent-gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '2rem', fontFamily: 'Outfit' }}>
            {society.displayName.charAt(0).toUpperCase()}
          </div>

          <div style={{ flex: 1, minWidth: '250px' }}>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.25rem' }}>
              <h1 style={{ fontFamily: 'Outfit', fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>{society.displayName}</h1>
              <span className="badge badge-gold">Society</span>
            </div>
            {society.leaderName && <p style={{ fontSize: '0.95rem', color: 'var(--accent-gold)', margin: '0 0 0.5rem 0' }}>Leader / Imam: {society.leaderName}</p>}
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.98rem', lineHeight: 1.5, margin: 0 }}>{society.description || 'Welcome to our official page. Follow us to stay updated with weekly litanies, adhkar, and programs.'}</p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', minWidth: '120px' }}>
            <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>{followerCount}</span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.5rem' }}>Followers</span>
            <button 
              onClick={handleFollowToggle} 
              className={`btn ${isFollowing ? 'btn-secondary' : 'btn-primary'}`} 
              style={{ width: '100%', padding: '0.5rem 1.2rem', fontSize: '0.9rem', borderRadius: '18px' }}
            >
              {isFollowing ? '✓ Following' : '+ Follow'}
            </button>
            <button
              onClick={handleShare}
              className="btn btn-secondary"
              style={{ width: '100%', padding: '0.45rem 1rem', fontSize: '0.85rem', borderRadius: '18px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="18" cy="5" r="3" />
                <circle cx="6" cy="12" r="3" />
                <circle cx="18" cy="19" r="3" />
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
              </svg>
              Share
            </button>
            <ReportContentButton
              contentId={society.id}
              contentTitle={society.displayName}
              contentType="society"
              compact
              label="Report Society"
            />
          </div>
        </section>

        {/* Tab Headers */}
        <div className="dashboard-tab-bar" style={{ marginBottom: '2rem' }}>
          <button 
            onClick={() => setActiveTab('programs')} 
            className={`dashboard-tab-btn ${activeTab === 'programs' ? 'dashboard-tab-btn-active' : 'dashboard-tab-btn-inactive'}`}
          >
            Weekly Programs
          </button>
          <button 
            onClick={() => setActiveTab('books')} 
            className={`dashboard-tab-btn ${activeTab === 'books' ? 'dashboard-tab-btn-active' : 'dashboard-tab-btn-inactive'}`}
          >
            Prayer Books & Audio
          </button>
          <button 
            onClick={() => setActiveTab('updates')} 
            className={`dashboard-tab-btn ${activeTab === 'updates' ? 'dashboard-tab-btn-active' : 'dashboard-tab-btn-inactive'}`}
          >
            Updates & Announcements
          </button>
        </div>

        {/* Tab Contents */}
        {loadingContent ? (
          <p style={{ color: 'var(--text-secondary)', textAlign: 'center' }}>Loading content...</p>
        ) : (
          <div>
            {/* 1. WEEKLY PROGRAMS TAB */}
            {activeTab === 'programs' && (
              programs.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '3rem' }}>No weekly programs scheduled yet.</p>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
                  {programs.map(prog => (
                    <div key={prog.id} className="glass-card" style={{ padding: '1.75rem', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: '1rem', border: '1px solid var(--border-color)' }}>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', gap: '0.5rem' }}>
                          <span className="badge badge-premium" style={{ background: 'rgba(212, 175, 55, 0.1)', color: 'var(--accent-gold)' }}>
                            ⏰ Every {prog.dayOfWeek} • {prog.time}
                          </span>
                          <ReportContentButton
                            contentId={prog.id}
                            contentTitle={`${society.displayName} — ${prog.title}`}
                            contentType="society_program"
                            compact
                            label="Flag"
                          />
                        </div>
                        <h3 style={{ fontFamily: 'Outfit', fontSize: '1.3rem', color: 'var(--text-primary)', margin: '0 0 0.5rem 0' }}>{prog.title}</h3>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5, margin: 0 }}>{prog.description}</p>
                      </div>

                      {prog.attachedPrayers && (
                        <div style={{ background: 'var(--bg-secondary)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                          <h5 style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Prayers & Adhkar</h5>
                          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.5, margin: 0, whiteSpace: 'pre-wrap' }}>{prog.attachedPrayers}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )
            )}

            {/* 2. PRAYER BOOKS & AUDIO TAB */}
            {activeTab === 'books' && (
              booksList.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '3rem' }}>No prayer books or audio guides uploaded yet.</p>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
                  {booksList.map(book => {
                    const isAudioFile = book.pdfPath && (book.pdfPath.endsWith('.mp3') || book.pdfPath.endsWith('.wav') || book.pdfPath.includes('/audio/'));
                    return (
                      <div key={book.id} className="glass-card" style={{ padding: '1.5rem', borderRadius: 'var(--radius-md)', display: 'flex', gap: '1rem', alignItems: 'center', border: '1px solid var(--border-color)' }}>
                        <div style={{ position: 'relative', width: '60px', height: '80px', borderRadius: '6px', overflow: 'hidden', flexShrink: 0, background: 'var(--bg-tertiary)' }}>
                          {book.coverUrl ? (
                            <img src={book.coverUrl} alt={book.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>
                              📖
                            </div>
                          )}
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <h4 style={{ margin: '0 0 0.25rem 0', fontFamily: 'Outfit', fontSize: '1.05rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{book.title}</h4>
                          <span className="badge badge-free" style={{ fontSize: '0.75rem', marginBottom: '0.5rem' }}>{isAudioFile ? '🎵 Audio Lecture' : '📄 PDF Book'}</span>
                          
                          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                            {isAudioFile ? (
                              <button 
                                onClick={() => togglePlayAudio(book.pdfPath, book.title)} 
                                className="btn btn-primary"
                                style={{ padding: '0.35rem 0.8rem', fontSize: '0.8rem', borderRadius: '4px' }}
                              >
                                {playingAudio === (book.pdfPath.startsWith('http') ? book.pdfPath : `https://noorlibrary.b-cdn.net/${book.pdfPath}`) ? '⏸ Pause' : '▶ Play'}
                              </button>
                            ) : (
                              <button 
                                onClick={() => {
                                  if (!user) {
                                    setIsAuthOpen(true);
                                  } else {
                                    setSelectedBook(book);
                                  }
                                }} 
                                className="btn btn-primary"
                                style={{ padding: '0.35rem 0.8rem', fontSize: '0.8rem', borderRadius: '4px' }}
                              >
                                Read PDF
                              </button>
                            )}
                            <ReportContentButton
                              contentId={book.id}
                              contentTitle={book.title}
                              contentType="book"
                              compact
                              label="Flag"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            )}

            {/* 3. SOCIETY UPDATES TAB */}
            {activeTab === 'updates' && (
              posts.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '3rem' }}>No updates or announcements posted yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  {posts.map(post => (
                    <div key={post.id} className="glass-card" style={{ padding: '1.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <h3 style={{ fontFamily: 'Outfit', fontSize: '1.25rem', color: 'var(--text-primary)', margin: 0 }}>{post.title}</h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            {new Date(post.createdAt).toLocaleDateString()} {new Date(post.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <ReportContentButton
                            contentId={post.id}
                            contentTitle={`${society.displayName} — ${post.title}`}
                            contentType="society_post"
                            compact
                            label="Flag"
                          />
                        </div>
                      </div>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.6, whiteSpace: 'pre-wrap', margin: 0 }}>
                        {post.content}
                      </p>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        )}
      </div>

      {/* Persistent Bottom Floating Audio Player */}
      {playingAudio && (
        <div style={{ position: 'fixed', bottom: '1.5rem', left: '50%', transform: 'translateX(-50%)', width: '90%', maxWidth: '500px', padding: '1rem 1.5rem', borderRadius: '16px', background: 'var(--glass-bg)', border: '1px solid var(--accent-gold)', boxShadow: '0 10px 30px rgba(0,0,0,0.3)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 100 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(212, 175, 55, 0.15)', color: 'var(--accent-gold)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              🎵
            </div>
            <div style={{ minWidth: 0 }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0 }}>Now Streaming</p>
              <p style={{ color: 'var(--text-primary)', fontSize: '0.9rem', fontWeight: 600, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{playingAudioTitle}</p>
            </div>
          </div>
          <button 
            onClick={() => {
              if (audioRef.current) {
                audioRef.current.pause();
              }
              setPlayingAudio(null);
              setPlayingAudioTitle(null);
            }} 
            className="btn btn-secondary" 
            style={{ padding: '0.3rem 0.8rem', fontSize: '0.75rem', borderRadius: '8px', border: '1px solid var(--accent-red)', color: 'var(--accent-red)' }}
          >
            Stop
          </button>
        </div>
      )}

      {/* Reader Modal */}
      {selectedBook && (
        <ReaderModal 
          book={selectedBook as any} 
          onClose={() => setSelectedBook(null)} 
        />
      )}

      {/* Auth Modal fallback */}
      {isAuthOpen && <AuthModal onClose={() => setIsAuthOpen(false)} />}
    </div>
  );
}
