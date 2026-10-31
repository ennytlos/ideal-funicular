'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Navbar from '../../components/Navbar';
import { db } from '../../lib/firebase';
import { collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';

interface Society {
  id: string;
  displayName: string;
  description?: string;
  leaderName?: string;
  email: string;
  socialProfile?: string;
}

export default function SocietiesDirectory() {
  const [societies, setSocieties] = useState<Society[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [followerCounts, setFollowerCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    setLoading(true);
    // Fetch all users with role 'society'
    const q = query(collection(db, 'users'), where('role', '==', 'society'));
    
    const unsubscribe = onSnapshot(q, async (snap) => {
      const fetched: Society[] = snap.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          displayName: data.displayName || data.societyName || doc.id,
          description: data.description || '',
          leaderName: data.leaderName || '',
          email: data.email || '',
          socialProfile: data.socialProfile || ''
        };
      });
      setSocieties(fetched);
      setLoading(false);

      // Fetch follower counts for each society
      fetched.forEach(async (soc) => {
        const followQuery = query(collection(db, 'follows'), where('creatorId', '==', soc.id));
        const followSnap = await getDocs(followQuery);
        setFollowerCounts(prev => ({
          ...prev,
          [soc.id]: followSnap.size
        }));
      });
    }, (err) => {
      console.error("Failed to load societies:", err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const filteredSocieties = societies.filter(soc => 
    soc.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (soc.description && soc.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <Navbar />
      
      <div className="container" style={{ paddingTop: '100px', paddingBottom: '5rem' }}>
        {/* Banner Section */}
        <section className="glass-card" style={{ padding: '3rem 2rem', borderRadius: 'var(--radius-lg)', marginBottom: '2.5rem', background: 'var(--accent-card-bg)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: '-50px', right: '-50px', width: '200px', height: '200px', borderRadius: '50%', background: 'rgba(212, 175, 55, 0.08)', filter: 'blur(40px)' }} />
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '4px 12px', borderRadius: '20px', background: 'rgba(212, 175, 55, 0.18)', color: 'var(--accent-gold)', fontSize: '0.8rem', fontWeight: 700, marginBottom: '1rem' }}>
            <span>COMING SOON</span>
            <span>•</span>
            <span>COMMUNITY NETWORK</span>
            <span>•</span>
            <span>VERIFIED DIRECTORY</span>
          </div>
          <h1 style={{ fontFamily: 'Outfit', fontSize: '2.5rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.5rem 0' }}>Islamic Societies</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', maxWidth: '640px', margin: 0, lineHeight: 1.6 }}>
            Explore authentic Islamic organizations, student chapters, and recognized associations. Stay connected with weekly programs, guides, audio lectures, and community updates.
          </p>
        </section>

        {/* Society Registration Callout */}
        <div className="glass-card" style={{ padding: '2rem 2.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem', marginBottom: '2.5rem', border: '1px solid rgba(212, 175, 55, 0.25)' }}>
          <div>
            <h2 style={{ fontFamily: 'Outfit', fontSize: '1.35rem', fontWeight: 700, marginBottom: '0.35rem', color: 'var(--text-primary)' }}>
              Are you an Islamic Society or Student Chapter?
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', maxWidth: '600px', margin: 0, lineHeight: 1.5 }}>
              Register your organization to publish weekly halaqahs, official study guides, audio lectures, and announcements to the Noor Library community.
            </p>
          </div>
          <Link href="/dashboard">
            <button className="btn btn-secondary" style={{ borderColor: 'var(--accent-gold)', color: 'var(--accent-gold)' }}>
              Register Your Society
            </button>
          </Link>
        </div>

        {/* Societies Grid */}
        {loading ? (
          <p style={{ color: 'var(--text-secondary)', textAlign: 'center' }}>Loading societies...</p>
        ) : filteredSocieties.length === 0 ? (
          <div className="glass-card" style={{ padding: '4rem 2rem', textAlign: 'center' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '1.2rem', margin: 0 }}>No societies found matching your query.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
            {filteredSocieties.map(soc => (
              <div 
                key={soc.id} 
                className="glass-card" 
                style={{ 
                  padding: '2rem', 
                  borderRadius: 'var(--radius-md)', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  justifyContent: 'space-between',
                  height: '100%',
                  border: '1px solid var(--border-color)',
                  transition: 'transform 0.3s ease, box-shadow 0.3s ease'
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(212, 175, 55, 0.1)', color: 'var(--accent-gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '1.25rem', fontFamily: 'Outfit' }}>
                      {soc.displayName.charAt(0).toUpperCase()}
                    </div>
                    <span className="badge badge-gold" style={{ fontSize: '0.75rem' }}>
                      👤 {followerCounts[soc.id] || 0} followers
                    </span>
                  </div>

                  <h3 style={{ fontFamily: 'Outfit', fontSize: '1.35rem', color: 'var(--text-primary)', margin: '0 0 0.5rem 0' }}>{soc.displayName}</h3>
                  {soc.leaderName && <p style={{ fontSize: '0.85rem', color: 'var(--accent-gold)', margin: '0 0 1rem 0' }}>Leader: {soc.leaderName}</p>}
                  
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', lineHeight: 1.5, margin: '0 0 1.5rem 0', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {soc.description || 'Dedicated to authentic Islamic teachings and community building programs.'}
                  </p>
                </div>

                <Link href={`/societies/${soc.id}`} style={{ width: '100%' }}>
                  <button className="btn btn-primary" style={{ width: '100%', padding: '0.6rem 0' }}>
                    View Profile & Programs
                  </button>
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
